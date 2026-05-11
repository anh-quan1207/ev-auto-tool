<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import axios from "axios";
import { PDFDocument } from "pdf-lib";

const currentView = ref("cms");

const pdfFiles = ref([]);
const uploadPayload = ref(null);
const job = ref(null);

const cmsPassportText = ref("");
const cmsUploadPayload = ref(null);
const cmsJob = ref(null);
const cmsStatus = ref({
  status: "idle",
  cmsUrl: "about:blank",
  lastError: null,
  readyAt: null,
  openedAt: null
});

const loading = ref(false);
const printing = ref(false);
const errorMessage = ref("");
const statusTimer = ref(null);
const cmsStatusTimer = ref(null);
const cmsJobTimer = ref(null);

const hasPdfs = computed(() => pdfFiles.value.length > 0);
const canUpload = computed(() => hasPdfs.value && !loading.value);
const canPrintPdfs = computed(() => hasPdfs.value && !printing.value);
const canStart = computed(() => Boolean(uploadPayload.value?.files?.pdfs?.length) && !loading.value);

const hasCmsPassport = computed(() => Boolean(cmsPassportText.value.trim()));
const canUploadCms = computed(() => hasCmsPassport.value && !loading.value);
const canOpenCms = computed(() => Boolean(cmsUploadPayload.value?.files?.passport?.id) && !loading.value);
const canConfirmLogin = computed(
  () => cmsStatus.value.status === "awaiting_login" || cmsStatus.value.status === "opening"
);
const canStartCmsJob = computed(
  () =>
    Boolean(cmsUploadPayload.value?.files?.passport?.id) &&
    cmsStatus.value.status === "ready" &&
    !loading.value
);

const cmsDownloadedFiles = computed(() =>
  (cmsJob.value?.cmsResults ?? []).filter((item) => item.downloadName)
);

function goTo(view) {
  currentView.value = view;
  errorMessage.value = "";
}

function onMultiFiles(event) {
  pdfFiles.value = [...(event.target.files ?? [])];
  uploadPayload.value = null;
  job.value = null;
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function downloadOutput(fileId) {
  return `/api/download/${encodeURIComponent(fileId)}`;
}

function resultFileName(file) {
  return file?.fileName || file?.filename || "";
}

function resultRecordCount(file) {
  return file?.recordCount ?? file?.count ?? 0;
}

function resultDownloadId(file) {
  return file?.downloadId || resultFileName(file);
}

function refreshPage() {
  window.location.reload();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function printSelectedPdfs() {
  if (!hasPdfs.value) {
    errorMessage.value = "Cần chọn ít nhất 1 file PDF để in.";
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    errorMessage.value = "Trình duyệt đang chặn cửa sổ in. Hãy cho phép popup cho trang này rồi bấm in lại.";
    return;
  }

  printing.value = true;
  errorMessage.value = "";
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Đang chuẩn bị in PDF</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: Arial, sans-serif;
            color: #17324d;
            background: #f4f7fb;
          }
        </style>
      </head>
      <body>
        <strong>Đang gộp ${pdfFiles.value.length} PDF để in...</strong>
      </body>
    </html>
  `);
  printWindow.document.close();

  try {
    const mergedPdf = await PDFDocument.create();

    for (const file of pdfFiles.value) {
      const sourcePdf = await PDFDocument.load(await file.arrayBuffer(), {
        ignoreEncryption: true
      });
      const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save();
    const pdfUrl = URL.createObjectURL(new Blob([mergedBytes], { type: "application/pdf" }));

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>In ${pdfFiles.value.length} file PDF</title>
          <style>
            html, body { margin: 0; width: 100%; height: 100%; }
            iframe { width: 100%; height: 100%; border: 0; }
          </style>
        </head>
        <body>
          <iframe id="pdf-frame" src="${pdfUrl}" title="${escapeHtml(`In ${pdfFiles.value.length} file PDF`)}"></iframe>
          <script>
            var frame = document.getElementById("pdf-frame");
            frame.addEventListener("load", function () {
              setTimeout(function () {
                setTimeout(function () {
                  window.focus();
                  window.print();
                }, 500);
              }, 300);
            });
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 120000);
  } catch (error) {
    printWindow.close();
    errorMessage.value = `Không thể gộp PDF để in: ${error.message}`;
  } finally {
    printing.value = false;
  }
}

async function uploadFiles() {
  if (!hasPdfs.value) {
    errorMessage.value = "Cần chọn ít nhất 1 file PDF visa trước khi upload.";
    return;
  }

  loading.value = true;
  errorMessage.value = "";

  try {
    const formData = new FormData();
    pdfFiles.value.forEach((file) => formData.append("pdfs", file));
    const response = await axios.post("/api/upload", formData);
    uploadPayload.value = response.data;
  } catch (error) {
    errorMessage.value = error.response?.data?.message ?? "Upload thất bại.";
  } finally {
    loading.value = false;
  }
}

async function uploadCmsFiles() {
  if (!hasCmsPassport.value) {
    errorMessage.value = "Cần nhập danh sách passport trước.";
    return;
  }

  loading.value = true;
  errorMessage.value = "";

  try {
    const formData = new FormData();
    formData.append("passportText", cmsPassportText.value);
    const response = await axios.post("/api/cms/upload", formData);
    cmsUploadPayload.value = response.data;
  } catch (error) {
    errorMessage.value = error.response?.data?.message ?? "Upload dữ liệu CMS thất bại.";
  } finally {
    loading.value = false;
  }
}

async function startJob() {
  if (!canStart.value) {
    errorMessage.value = "Cần upload ít nhất 1 file PDF visa.";
    return;
  }

  loading.value = true;
  errorMessage.value = "";

  try {
    const response = await axios.post("/api/start-job", {
      files: uploadPayload.value.files
    });

    job.value = {
      id: response.data.jobId,
      progress: 0,
      done: false,
      parsedRecords: [],
      results: [],
      errors: []
    };

    pollStatus(response.data.jobId);
  } catch (error) {
    loading.value = false;
    errorMessage.value = error.response?.data?.message ?? "Không thể bắt đầu job.";
  }
}

async function openCms() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const response = await axios.post("/api/open-cms");
    cmsStatus.value = response.data;
  } catch (error) {
    errorMessage.value = error.response?.data?.message ?? "Không mở được CMS.";
  } finally {
    loading.value = false;
  }
}

async function confirmLogin() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const response = await axios.post("/api/confirm-login");
    cmsStatus.value = response.data;
  } catch (error) {
    errorMessage.value = error.response?.data?.message ?? "Không xác nhận được trạng thái đăng nhập.";
  } finally {
    loading.value = false;
  }
}

async function startCmsJob() {
  if (!canStartCmsJob.value) {
    errorMessage.value = "Cần upload dữ liệu CMS và xác nhận đã đăng nhập xong.";
    return;
  }

  loading.value = true;
  errorMessage.value = "";

  try {
    const response = await axios.post("/api/start-cms-job", {
      files: cmsUploadPayload.value.files
    });

    cmsJob.value = {
      id: response.data.jobId,
      progress: 0,
      done: false,
      cmsResults: [],
      parsedRecords: [],
      results: [],
      errors: []
    };

    pollCmsJob(response.data.jobId);
  } catch (error) {
    loading.value = false;
    errorMessage.value = error.response?.data?.message ?? "Chưa thể bắt đầu job CMS.";
  }
}

async function fetchCmsStatus() {
  try {
    const response = await axios.get("/api/cms-status");
    cmsStatus.value = response.data;
  } catch (_error) {
    // Ignore background polling failures.
  }
}

function stopPolling() {
  if (statusTimer.value) {
    clearInterval(statusTimer.value);
    statusTimer.value = null;
  }
}

function stopCmsPolling() {
  if (cmsStatusTimer.value) {
    clearInterval(cmsStatusTimer.value);
    cmsStatusTimer.value = null;
  }
}

function stopCmsJobPolling() {
  if (cmsJobTimer.value) {
    clearInterval(cmsJobTimer.value);
    cmsJobTimer.value = null;
  }
}

function pollStatus(jobId) {
  stopPolling();
  statusTimer.value = setInterval(async () => {
    try {
      const response = await axios.get(`/api/status/${jobId}`);
      job.value = response.data;

      if (response.data.done) {
        loading.value = false;
        stopPolling();
      }
    } catch (_error) {
      loading.value = false;
      stopPolling();
      errorMessage.value = "Không đọc được trạng thái job.";
    }
  }, 1200);
}

function pollCmsJob(jobId) {
  stopCmsJobPolling();
  cmsJobTimer.value = setInterval(async () => {
    try {
      const response = await axios.get(`/api/status/${jobId}`);
      cmsJob.value = response.data;

      if (response.data.done) {
        loading.value = false;
        stopCmsJobPolling();
      }
    } catch (_error) {
      loading.value = false;
      stopCmsJobPolling();
      errorMessage.value = "Không đọc được trạng thái job CMS.";
    }
  }, 1200);
}

onMounted(() => {
  fetchCmsStatus();
  cmsStatusTimer.value = setInterval(fetchCmsStatus, 3000);
});

onBeforeUnmount(() => {
  stopPolling();
  stopCmsPolling();
  stopCmsJobPolling();
});
</script>

<template>
  <div class="app-shell">
    <aside class="method-sidebar">
      <div class="sidebar-card">
        <p class="sidebar-label">Đổi phương thức</p>
        <button
          class="sidebar-btn"
          :class="{ active: currentView === 'guide' }"
          type="button"
          @click="goTo('guide')"
        >
          Hướng dẫn sử dụng
        </button>
        <button
          class="sidebar-btn"
          :class="{ active: currentView === 'manual' }"
          type="button"
          @click="goTo('manual')"
        >
          Xử lý từ PDF
        </button>
        <button
          class="sidebar-btn"
          :class="{ active: currentView === 'cms' }"
          type="button"
          @click="goTo('cms')"
        >
          Tự động từ CMS
        </button>
      </div>
    </aside>

    <main class="page-shell">
      <template v-if="currentView === 'guide'">
        <section class="page-intro panel">
          <div class="compact-head">
            <h1>Hướng dẫn sử dụng</h1>
            <span>Chọn đúng luồng theo nhu cầu công việc. Luồng PDF phù hợp khi đã có sẵn PDF visa. Luồng CMS phù hợp khi cần hệ thống tự tra cứu và tải PDF.</span>
          </div>
        </section>

        <section class="stack-layout">
          <div class="panel">
            <div class="panel-head">
              <h2>1. Luồng xử lý từ PDF</h2>
              <span>Dùng khi bạn đã có sẵn các file PDF visa.</span>
            </div>

            <div class="guide-list">
              <article>
                <strong>Bước 1</strong>
                <span>Chuẩn bị 1 hoặc nhiều file PDF visa cần xử lý.</span>
              </article>
              <article>
                <strong>Bước 2</strong>
                <span>Hệ thống sẽ tự dùng template Excel cố định đã chốt sẵn.</span>
              </article>
              <article>
                <strong>Bước 3</strong>
                <span>Vào mục <code>Xử lý từ PDF</code> và chọn các file PDF.</span>
              </article>
              <article>
                <strong>Bước 4</strong>
                <span>Bấm <code>Upload dữ liệu</code>.</span>
              </article>
              <article>
                <strong>Bước 5</strong>
                <span>Bấm <code>Bắt đầu xử lý</code> và chờ hệ thống parse dữ liệu.</span>
              </article>
              <article>
                <strong>Bước 6</strong>
                <span>Kiểm tra mục <code>Dữ liệu parse</code> và <code>Visa bị bỏ qua</code>.</span>
              </article>
              <article>
                <strong>Bước 7</strong>
                <span>Tải file Excel ở mục <code>File kết quả</code>.</span>
              </article>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <h2>2. Luồng tự động từ CMS</h2>
              <span>Dùng khi cần hệ thống tự tra cứu passport trên CMS và tải PDF.</span>
            </div>

            <div class="guide-list">
              <article>
                <strong>Bước 1</strong>
                <span>Chuẩn bị danh sách số passport, mỗi passport nhập trên một dòng.</span>
              </article>
              <article>
                <strong>Bước 2</strong>
                <span>Hệ thống sẽ tự dùng template Excel cố định đã chốt sẵn.</span>
              </article>
              <article>
                <strong>Bước 3</strong>
                <span>Vào mục <code>Tự động từ CMS</code> và nhập danh sách passport.</span>
              </article>
              <article>
                <strong>Bước 4</strong>
                <span>Bấm <code>Upload dữ liệu CMS</code>.</span>
              </article>
              <article>
                <strong>Bước 5</strong>
                <span>Bấm <code>Mở CMS</code>, sau đó tự đăng nhập và nhập captcha trên cửa sổ CMS.</span>
              </article>
              <article>
                <strong>Bước 6</strong>
                <span>Sau khi đăng nhập xong, quay lại web và bấm <code>Tôi đã đăng nhập xong</code>.</span>
              </article>
              <article>
                <strong>Bước 7</strong>
                <span>Bấm <code>Bắt đầu xử lý CMS</code>. Hệ thống sẽ tự search passport, tải PDF, parse dữ liệu và xuất Excel.</span>
              </article>
              <article>
                <strong>Bước 8</strong>
                <span>Kiểm tra các mục <code>PDF đã tải từ CMS</code>, <code>Dữ liệu parse từ PDF CMS</code>, <code>File Excel kết quả</code> và <code>Visa bị bỏ qua</code>.</span>
              </article>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <h2>3. Lưu ý quan trọng</h2>
              <span>Đây là các điểm cần nhớ khi dùng hệ thống.</span>
            </div>

            <div class="guide-list">
              <article>
                <strong>Template</strong>
                <span>Template Excel đã được chốt cố định trong hệ thống, người dùng không cần upload lại.</span>
              </article>
              <article>
                <strong>File tạm</strong>
                <span>Upload, PDF tải từ CMS và file Excel kết quả đều chỉ được giữ tạm thời để tránh đầy bộ nhớ.</span>
              </article>
              <article>
                <strong>Kiểm tra dữ liệu</strong>
                <span>Nên xem kỹ phần preview trước khi tải file kết quả.</span>
              </article>
              <article>
                <strong>CMS automation</strong>
                <span>Luồng CMS hiện phù hợp nhất khi có 1 người vận hành tại một thời điểm.</span>
              </article>
            </div>
          </div>
        </section>
      </template>

      <template v-else-if="currentView === 'manual'">
        <section class="page-intro panel">
          <div class="compact-head">
            <h1>Xử lý từ PDF</h1>
            <span>Upload PDF visa, kiểm tra dữ liệu và xuất file Excel theo đúng nhóm.</span>
          </div>
        </section>

        <section class="stack-layout">
          <div class="panel">
            <div class="panel-head">
              <h2>1. Chuẩn bị file</h2>
              <span>Chọn các file PDF visa cần xử lý. Template Excel đã được cấu hình cố định.</span>
            </div>

            <div class="form-stack">
              <label class="file-field">
                <span>PDF visa</span>
                <input type="file" accept=".pdf" multiple @change="onMultiFiles" />
                <small>{{ pdfFiles.length ? `${pdfFiles.length} file đã chọn` : "Có thể chọn nhiều file PDF" }}</small>
              </label>
            </div>

            <div class="action-row">
              <button class="ghost-btn action-btn" :disabled="!canPrintPdfs" @click="printSelectedPdfs">
                {{ printing ? "Đang mở PDF..." : "In PDF đã chọn" }}
              </button>
              <button class="primary-btn action-btn" :disabled="!canUpload" @click="uploadFiles">
                Upload dữ liệu
              </button>
            </div>

            <p v-if="!uploadPayload" class="hint-text">
              Chọn ít nhất 1 PDF, sau đó bấm <strong>Upload dữ liệu</strong>. Template Excel sẽ được lấy tự động.
            </p>

            <p v-if="uploadPayload" class="success-box">Đã nhận file đầu vào. Có thể bắt đầu xử lý ngay.</p>
          </div>

          <div class="panel">
            <div class="panel-head">
              <h2>2. Chạy xử lý</h2>
              <span>Theo dõi tiến độ parse và xuất file.</span>
            </div>

            <div class="run-block">
              <button class="primary-btn action-btn run-btn" :disabled="!canStart" @click="startJob">
                Bắt đầu xử lý
              </button>
            </div>

            <div class="progress-card">
              <div class="progress-label">
                <strong>{{ job?.status || "idle" }}</strong>
                <span>{{ job?.progress || 0 }}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-value" :style="{ width: `${job?.progress || 0}%` }"></div>
              </div>
              <p>
                File đang xử lý:
                <strong>{{ job?.currentPassport || "Chưa bắt đầu" }}</strong>
              </p>
            </div>

            <div v-if="job?.summary" class="summary-grid">
              <article>
                <strong>{{ job.summary.totalPassports }}</strong>
                <span>PDF</span>
              </article>
              <article>
                <strong>{{ job.summary.parsed }}</strong>
                <span>Hợp lệ</span>
              </article>
              <article>
                <strong>{{ job.summary.skipped }}</strong>
                <span>Bỏ qua</span>
              </article>
              <article>
                <strong>{{ job.summary.groups }}</strong>
                <span>Nhóm xuất file</span>
              </article>
            </div>

            <p v-if="errorMessage" class="error-box">{{ errorMessage }}</p>
          </div>

          <div v-if="job?.parsedRecords?.length" class="panel">
            <div class="panel-head">
              <h2>3. Dữ liệu parse</h2>
              <span>Kiểm tra nhanh dữ liệu đã đọc được từ các PDF thủ công.</span>
            </div>

            <div class="table-shell">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Ngày sinh</th>
                    <th>Passport</th>
                    <th>Số EV</th>
                    <th>Ngày hiệu lực</th>
                    <th>Ngày hết hạn</th>
                    <th>Loại entry</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in job.parsedRecords" :key="`${item.passport}-${item.evNumber}`">
                    <td>{{ item.name || "-" }}</td>
                    <td>{{ item.dob || "-" }}</td>
                    <td>{{ item.passport || "-" }}</td>
                    <td>{{ item.evNumber || "-" }}</td>
                    <td>{{ item.issueDate || "-" }}</td>
                    <td>{{ item.expiryDate || "-" }}</td>
                    <td>{{ item.entryType || "-" }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="job?.errors?.length" class="panel">
            <div class="panel-head">
              <h2>4. Visa bị bỏ qua</h2>
              <span>Các PDF không hợp lệ hoặc bị loại sẽ hiện ở đây.</span>
            </div>

            <div class="error-list">
              <article v-for="item in job.errors" :key="`${item.passport}-${item.reason}`">
                <div>
                  <strong>{{ item.passport || item.sourceName }}</strong>
                  <span>{{ item.reason }}</span>
                </div>
              </article>
            </div>
          </div>

          <div v-if="job?.results?.length" class="panel">
            <div class="panel-head">
              <h2>5. File kết quả</h2>
              <span>Tải các file Excel đã xuất. Có thể làm mới trang ở cuối danh sách.</span>
            </div>

            <div class="result-list">
              <article v-for="file in job.results" :key="resultFileName(file)" class="result-item">
                <div class="result-copy">
                  <strong>{{ resultFileName(file) }}</strong>
                  <span>{{ resultRecordCount(file) }} dòng dữ liệu</span>
                </div>
                <a class="download-chip" :href="downloadOutput(resultDownloadId(file))">Tải file</a>
              </article>
            </div>

            <div class="panel-actions-bottom">
              <button class="ghost-btn result-refresh-btn" type="button" @click="refreshPage()">
                Làm mới trang
              </button>
            </div>
          </div>
        </section>
      </template>

      <template v-else>
        <section class="page-intro panel">
          <div class="compact-head">
            <h1>Tự động từ CMS</h1>
            <span>Upload danh sách passport, mở CMS, đăng nhập thủ công rồi để hệ thống tự tải PDF và xuất Excel.</span>
          </div>
        </section>

        <section class="stack-layout">
          <div class="panel">
            <div class="panel-head">
              <h2>1. Chuẩn bị dữ liệu CMS</h2>
              <span>Nhập danh sách passport dùng cho luồng tự động. Template Excel đã được cấu hình cố định.</span>
            </div>

            <div class="form-stack">
              <label class="file-field">
                <span>Danh sách passport</span>
                <textarea
                  v-model="cmsPassportText"
                  rows="7"
                  placeholder="Mỗi dòng nhập 1 số hộ chiếu, ví dụ:&#10;EQ1506876&#10;ER7943628"
                  @input="cmsUploadPayload = null; cmsJob = null"
                ></textarea>
                <small>{{ hasCmsPassport ? `${cmsPassportText.trim().split(/\s+/).length} passport đã nhập` : "Chưa nhập passport" }}</small>
              </label>
            </div>

            <div class="action-row">
              <button class="primary-btn action-btn" :disabled="!canUploadCms" @click="uploadCmsFiles">
                Upload dữ liệu CMS
              </button>
            </div>

            <p v-if="!cmsUploadPayload" class="hint-text">
              Nhập danh sách passport, sau đó upload để mở các bước tiếp theo. Template Excel sẽ được lấy tự động.
            </p>

            <div v-if="cmsUploadPayload" class="success-box cms-summary">
              <strong>Sẵn sàng cho luồng CMS</strong>
              <span>{{ cmsUploadPayload.summary.passportCount }} passport đã nhận.</span>
              <span>Template: {{ cmsUploadPayload.summary.templateName }}</span>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <h2>2. Mở CMS và đăng nhập</h2>
              <span>Hệ thống mở browser. Bạn tự đăng nhập và nhập captcha, sau đó xác nhận đã xong.</span>
            </div>

            <div class="action-row">
              <button class="ghost-btn action-btn" :disabled="!canOpenCms" @click="openCms">
                Mở CMS
              </button>
              <button class="primary-btn action-btn" :disabled="!canConfirmLogin" @click="confirmLogin">
                Tôi đã đăng nhập xong
              </button>
            </div>

            <div class="status-card">
              <div class="status-row">
                <span>Trạng thái CMS</span>
                <strong>{{ cmsStatus.status }}</strong>
              </div>
              <div class="status-row">
                <span>URL</span>
                <strong>{{ cmsStatus.cmsUrl }}</strong>
              </div>
              <div class="status-row" v-if="cmsStatus.openedAt">
                <span>Đã mở lúc</span>
                <strong>{{ formatDate(cmsStatus.openedAt) }}</strong>
              </div>
              <div class="status-row" v-if="cmsStatus.readyAt">
                <span>Sẵn sàng lúc</span>
                <strong>{{ formatDate(cmsStatus.readyAt) }}</strong>
              </div>
              <div class="status-row" v-if="cmsStatus.lastError">
                <span>Lỗi gần nhất</span>
                <strong class="danger-text">{{ cmsStatus.lastError }}</strong>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <h2>3. Chạy tra cứu CMS</h2>
              <span>Hệ thống sẽ search từng passport, tải PDF, parse dữ liệu và xuất file Excel.</span>
            </div>

            <div class="action-row">
              <button class="primary-btn action-btn run-btn" :disabled="!canStartCmsJob" @click="startCmsJob">
                Bắt đầu xử lý CMS
              </button>
            </div>

            <div class="progress-card">
              <div class="progress-label">
                <strong>{{ cmsJob?.status || "idle" }}</strong>
                <span>{{ cmsJob?.progress || 0 }}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-value" :style="{ width: `${cmsJob?.progress || 0}%` }"></div>
              </div>
              <p>
                Passport đang xử lý:
                <strong>{{ cmsJob?.currentPassport || "Chưa bắt đầu" }}</strong>
              </p>
            </div>

            <div v-if="cmsJob?.summary" class="summary-grid">
              <article>
                <strong>{{ cmsJob.summary.totalPassports }}</strong>
                <span>Tổng passport</span>
              </article>
              <article>
                <strong>{{ cmsJob.summary.found }}</strong>
                <span>Tải được PDF</span>
              </article>
              <article>
                <strong>{{ cmsJob.summary.parsed }}</strong>
                <span>Parse hợp lệ</span>
              </article>
              <article>
                <strong>{{ cmsJob.summary.groups }}</strong>
                <span>Nhóm Excel</span>
              </article>
            </div>

            <p v-if="errorMessage" class="error-box">{{ errorMessage }}</p>
          </div>

          <div v-if="cmsDownloadedFiles.length" class="panel">
            <div class="panel-head">
              <h2>4. PDF đã tải từ CMS</h2>
              <span>Xem tên các PDF hệ thống đã tải và xử lý tạm thời.</span>
            </div>

            <div class="result-list">
              <article v-for="item in cmsDownloadedFiles" :key="`${item.passport}-${item.downloadName}`" class="result-item">
                <div class="result-copy">
                  <strong>{{ item.downloadName }}</strong>
                  <span>Passport: {{ item.passport }}</span>
                  <span>File PDF chỉ tồn tại tạm trong lúc parse và đã được xóa sau xử lý.</span>
                </div>
              </article>
            </div>
          </div>

          <div v-if="cmsJob?.parsedRecords?.length" class="panel">
            <div class="panel-head">
              <h2>5. Dữ liệu parse từ PDF CMS</h2>
              <span>Kiểm tra nhanh dữ liệu đã đọc được từ các PDF vừa tải.</span>
            </div>

            <div class="table-shell">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Ngày sinh</th>
                    <th>Passport</th>
                    <th>Số EV</th>
                    <th>Ngày hiệu lực</th>
                    <th>Ngày hết hạn</th>
                    <th>Loại entry</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in cmsJob.parsedRecords" :key="`${item.passport}-${item.evNumber}`">
                    <td>{{ item.name || "-" }}</td>
                    <td>{{ item.dob || "-" }}</td>
                    <td>{{ item.passport || "-" }}</td>
                    <td>{{ item.evNumber || "-" }}</td>
                    <td>{{ item.issueDate || "-" }}</td>
                    <td>{{ item.expiryDate || "-" }}</td>
                    <td>{{ item.entryType || "-" }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="cmsJob?.results?.length" class="panel">
            <div class="panel-head">
              <h2>6. File Excel kết quả</h2>
              <span>Tải file Excel ngay trong màn CMS. Có thể làm mới trang ở cuối danh sách.</span>
            </div>

            <div class="result-list">
              <article v-for="file in cmsJob.results" :key="resultFileName(file)" class="result-item">
                <div class="result-copy">
                  <strong>{{ resultFileName(file) }}</strong>
                  <span>{{ resultRecordCount(file) }} dòng dữ liệu</span>
                </div>
                <a class="download-chip" :href="downloadOutput(resultDownloadId(file))">Tải file</a>
              </article>
            </div>

            <div class="panel-actions-bottom">
              <button class="ghost-btn result-refresh-btn" type="button" @click="refreshPage()">
                Làm mới trang
              </button>
            </div>
          </div>

          <div v-if="cmsJob?.errors?.length" class="panel">
            <div class="panel-head">
              <h2>7. Visa bị bỏ qua</h2>
              <span>Các hồ sơ không lấy được hoặc không hợp lệ sẽ hiện ở đây.</span>
            </div>

            <div class="error-list">
              <article v-for="item in cmsJob.errors" :key="`${item.passport}-${item.reason}`">
                <div>
                  <strong>{{ item.passport || item.sourceName }}</strong>
                  <span>{{ item.reason }}</span>
                </div>
              </article>
            </div>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
