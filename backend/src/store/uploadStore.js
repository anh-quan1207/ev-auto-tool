const uploads = new Map();
const timers = new Map();
const UPLOAD_TTL_MS = 30 * 60 * 1000;

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function saveUpload({ originalname, buffer, mimeType }) {
  const id = createId("upload");
  const timer = setTimeout(() => {
    uploads.delete(id);
    timers.delete(id);
  }, UPLOAD_TTL_MS);

  uploads.set(id, {
    id,
    originalname,
    buffer,
    mimeType,
    createdAt: new Date().toISOString()
  });
  timers.set(id, timer);

  return {
    id,
    originalname,
    size: buffer.length
  };
}

export function takeUpload(id) {
  const file = uploads.get(id) ?? null;
  if (file) {
    uploads.delete(id);
    clearTimeout(timers.get(id));
    timers.delete(id);
  }

  return file;
}

export function removeUpload(id) {
  uploads.delete(id);
  clearTimeout(timers.get(id));
  timers.delete(id);
}
