const outputs = new Map();
const timers = new Map();
const OUTPUT_TTL_MS = 30 * 60 * 1000;

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function saveOutput({ fileName, buffer, contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) {
  const id = createId("output");
  const timer = setTimeout(() => {
    outputs.delete(id);
    timers.delete(id);
  }, OUTPUT_TTL_MS);

  outputs.set(id, {
    id,
    fileName,
    buffer,
    contentType,
    createdAt: new Date().toISOString()
  });
  timers.set(id, timer);

  return {
    id,
    fileName,
    size: buffer.length
  };
}

export function takeOutput(id) {
  const file = outputs.get(id) ?? null;
  if (file) {
    outputs.delete(id);
    clearTimeout(timers.get(id));
    timers.delete(id);
  }

  return file;
}

export function getOutput(id) {
  return outputs.get(id) ?? null;
}

export function removeOutput(id) {
  outputs.delete(id);
  clearTimeout(timers.get(id));
  timers.delete(id);
}
