import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import cors from "cors";
import multer from "multer";
import { dataRoot, downloadsDir } from "./config/paths.js";
import { createJob, getJob, updateJob } from "./store/jobStore.js";
import { getOutput, removeOutput, saveOutput } from "./store/outputStore.js";
import { saveUpload, takeUpload } from "./store/uploadStore.js";
import { runCmsAutomationJob } from "./services/cmsAutomationService.js";
import { prepareCmsUploadPayload } from "./services/cmsUploadService.js";
import {
  closeCmsSession,
  confirmCmsLogin,
  getCmsSessionState,
  isCmsReady,
  openCmsSession
} from "./services/cmsSessionService.js";
import { runVisaJob } from "./services/visaProcessor.js";

const app = express();
const api = express.Router();
const port = Number(process.env.PORT || 3001);

await fs.mkdir(dataRoot, { recursive: true });
await fs.mkdir(downloadsDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage()
});

function toUploadDescriptor(file) {
  const saved = saveUpload({
    originalname: file.originalname,
    buffer: file.buffer,
    mimeType: file.mimetype
  });

  return {
    id: saved.id,
    originalname: saved.originalname,
    size: saved.size
  };
}

function materializeOutputs(outputs) {
  return outputs.map((file) => {
    const saved = saveOutput({
      fileName: file.fileName,
      buffer: file.buffer
    });

    return {
      downloadId: saved.id,
      fileName: saved.fileName,
      recordCount: file.count
    };
  });
}

const route = {
  get(path, ...handlers) {
    app.get(path, ...handlers);
    api.get(path, ...handlers);
  },
  post(path, ...handlers) {
    app.post(path, ...handlers);
    api.post(path, ...handlers);
  }
};

app.use(cors());
app.use(express.json());
app.use("/api", api);

route.get("/health", (_req, res) => {
  res.json({ ok: true });
});

route.post(
  "/upload",
  upload.fields([
    { name: "template", maxCount: 1 },
    { name: "pdfs", maxCount: 100 }
  ]),
  (req, res) => {
    const template = req.files?.template?.[0];
    const pdfs = req.files?.pdfs ?? [];

    if (!template) {
      return res.status(400).json({
        message: "Can upload template.xlsx"
      });
    }

    if (path.extname(template.originalname).toLowerCase() !== ".xlsx") {
      return res.status(400).json({
        message: "Template phai la file .xlsx de giu dung dinh dang"
      });
    }

    return res.json({
      uploadId: `upload-${Date.now()}`,
      files: {
        template: toUploadDescriptor(template),
        pdfs: pdfs.map(toUploadDescriptor)
      }
    });
  }
);

route.post(
  "/cms/upload",
  upload.fields([
    { name: "passport", maxCount: 1 },
    { name: "template", maxCount: 1 }
  ]),
  async (req, res) => {
    const rawPassportFile = req.files?.passport?.[0];
    const rawTemplateFile = req.files?.template?.[0];

    if (!rawPassportFile || !rawTemplateFile) {
      return res.status(400).json({
        message: "Can upload passport.txt va template.xlsx"
      });
    }

    if (path.extname(rawPassportFile.originalname).toLowerCase() !== ".txt") {
      return res.status(400).json({
        message: "Passport phai la file .txt"
      });
    }

    if (path.extname(rawTemplateFile.originalname).toLowerCase() !== ".xlsx") {
      return res.status(400).json({
        message: "Template phai la file .xlsx de giu dung dinh dang"
      });
    }

    const passportFile = {
      ...toUploadDescriptor(rawPassportFile),
      buffer: rawPassportFile.buffer
    };
    const templateFile = {
      ...toUploadDescriptor(rawTemplateFile),
      buffer: rawTemplateFile.buffer
    };

    try {
      const payload = await prepareCmsUploadPayload({ passportFile, templateFile });
      return res.json(payload);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }
);

route.get("/cms-status", (_req, res) => {
  res.json(getCmsSessionState());
});

route.post("/open-cms", async (_req, res) => {
  try {
    const state = await openCmsSession();
    res.json(state);
  } catch (error) {
    res.status(500).json({
      message: `Khong mo duoc CMS: ${error.message}`
    });
  }
});

route.post("/confirm-login", async (_req, res) => {
  try {
    const state = await confirmCmsLogin();
    res.json(state);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

route.post("/close-cms", async (_req, res) => {
  const state = await closeCmsSession();
  res.json(state);
});

route.post("/start-job", async (req, res) => {
  const { files } = req.body ?? {};
  if (!files?.template?.id) {
    return res.status(400).json({
      message: "Thieu thong tin file upload"
    });
  }

  if (!Array.isArray(files.pdfs) || files.pdfs.length === 0) {
    return res.status(400).json({
      message: "MVP hien tai can upload it nhat 1 file PDF visa"
    });
  }

  const templateFile = takeUpload(files.template.id);
  const pdfFiles = files.pdfs
    .map((file) => takeUpload(file.id))
    .filter(Boolean);

  if (!templateFile || pdfFiles.length !== files.pdfs.length) {
    return res.status(400).json({
      message: "File tam da het han. Hay upload lai."
    });
  }

  const job = createJob();
  res.json({ jobId: job.id });

  try {
    updateJob(job.id, { status: "processing", progress: 5 });
    const result = await runVisaJob({
      templateBuffer: templateFile.buffer,
      pdfFiles,
      onProgress: (patch) => updateJob(job.id, patch)
    });

    updateJob(job.id, {
      status: "done",
      progress: 100,
      done: true,
      currentPassport: null,
      parsedRecords: result.parsedRecords,
      results: materializeOutputs(result.outputs),
      errors: result.skippedRecords,
      summary: {
        totalPassports: pdfFiles.length,
        parsed: result.parsedRecords.length,
        skipped: result.skippedRecords.length,
        groups: result.groupedRecords.length
      }
    });
  } catch (error) {
    updateJob(job.id, {
      status: "failed",
      done: true,
      progress: 100,
      errorMessage: error.message
    });
  }
});

route.post("/start-cms-job", async (req, res) => {
  const { files } = req.body ?? {};

  if (!files?.passport?.id || !files?.template?.id) {
    return res.status(400).json({
      message: "Thieu passport.txt hoac template.xlsx cho luong CMS"
    });
  }

  if (!isCmsReady()) {
    return res.status(400).json({
      message: "CMS chua san sang. Hay mo CMS va xac nhan da dang nhap."
    });
  }

  const passportFile = takeUpload(files.passport.id);
  const templateFile = takeUpload(files.template.id);

  if (!passportFile || !templateFile) {
    return res.status(400).json({
      message: "File tam da het han. Hay upload lai."
    });
  }

  const job = createJob({ mode: "cms" });
  res.json({ jobId: job.id });

  try {
    updateJob(job.id, { status: "queued", progress: 3 });
    const result = await runCmsAutomationJob({
      passportContent: passportFile.buffer.toString("utf8"),
      templateBuffer: templateFile.buffer,
      onProgress: (patch) => updateJob(job.id, patch)
    });

    updateJob(job.id, {
      status: "done",
      done: true,
      progress: 100,
      currentPassport: null,
      cmsResults: result.searchResults,
      parsedRecords: result.parsedRecords,
      results: materializeOutputs(result.outputs),
      errors: result.skippedRecords,
      summary: {
        totalPassports: result.passports.length,
        found: result.found,
        notFound: result.notFound,
        parsed: result.parsedRecords.length,
        groups: result.groupedRecords.length
      }
    });
  } catch (error) {
    updateJob(job.id, {
      status: "failed",
      done: true,
      progress: 100,
      errorMessage: error.message
    });
  }
});

route.get("/status/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ message: "Khong tim thay job" });
  }

  return res.json(job);
});

route.get("/download/:fileId", (req, res) => {
  const file = getOutput(req.params.fileId);
  if (!file) {
    return res.status(404).json({
      message: "File da het han hoac da duoc tai truoc do"
    });
  }

  res.setHeader("Content-Type", file.contentType);
  res.attachment(file.fileName);
  res.on("finish", () => {
    removeOutput(req.params.fileId);
  });
  return res.send(file.buffer);
});

app.listen(port, () => {
  console.log(`EV auto backend listening on http://localhost:${port}`);
});
