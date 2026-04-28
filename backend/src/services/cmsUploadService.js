import path from "node:path";
import { parsePassportText } from "./passportService.js";

export async function prepareCmsUploadPayload({ passportFile, templateFile }) {
  const passportContent = passportFile.buffer.toString("utf8");
  const passports = parsePassportText(passportContent);

  if (path.extname(templateFile.originalname).toLowerCase() !== ".xlsx") {
    throw new Error("Template phai la file .xlsx de giu dung dinh dang");
  }

  return {
    files: {
      passport: {
        id: passportFile.id,
        originalname: passportFile.originalname,
        size: passportFile.buffer.length
      },
      template: {
        id: templateFile.id,
        originalname: templateFile.originalname,
        size: templateFile.buffer.length
      }
    },
    summary: {
      passportCount: passports.length,
      templateName: templateFile.originalname
    },
    passports
  };
}
