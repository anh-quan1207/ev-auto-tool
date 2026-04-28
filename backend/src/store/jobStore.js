const jobs = new Map();

export function createJob(payload = {}) {
  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    progress: 0,
    done: false,
    status: "queued",
    currentPassport: null,
    results: [],
    errors: [],
    createdAt: new Date().toISOString(),
    ...payload
  };

  jobs.set(id, job);
  return job;
}

export function getJob(id) {
  return jobs.get(id) ?? null;
}

export function updateJob(id, patch) {
  const current = jobs.get(id);
  if (!current) {
    return null;
  }

  const next = { ...current, ...patch };
  jobs.set(id, next);
  return next;
}
