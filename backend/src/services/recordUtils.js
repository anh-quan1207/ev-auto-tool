export function normalizeRecordKey(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function dedupeRecordsByEvNumber(records) {
  const seen = new Set();
  const uniqueRecords = [];
  const duplicateRecords = [];

  for (const record of records) {
    const key = normalizeRecordKey(record.evNumber);

    if (!key) {
      uniqueRecords.push(record);
      continue;
    }

    if (seen.has(key)) {
      duplicateRecords.push(record);
      continue;
    }

    seen.add(key);
    uniqueRecords.push(record);
  }

  return {
    uniqueRecords,
    duplicateRecords
  };
}
