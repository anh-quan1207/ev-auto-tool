import { parseVisaPdf } from "./pdfParser.js";
import { exportGroupedResults } from "./excelExporter.js";

function parseComparableDate(value) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/-/g, "/").replace(/\./g, "/");
  const parts = normalized.split("/").map((part) => part.trim());
  if (parts.length !== 3) {
    return null;
  }

  const [day, month, year] = parts;
  const date = new Date(`${year}-${month}-${day}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isFutureIssueDate(value) {
  const issueDate = parseComparableDate(value);
  if (!issueDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return issueDate > today;
}

function groupRecords(records) {
  const groups = new Map();

  for (const record of records) {
    const key = `${record.entryType}|${record.expiryDate}`;
    if (!groups.has(key)) {
      groups.set(key, {
        entryType: record.entryType,
        expiryDate: record.expiryDate,
        records: []
      });
    }

    groups.get(key).records.push(record);
  }

  return [...groups.values()];
}

export async function runVisaJob({ templateBuffer, pdfFiles, onProgress }) {
  const parsedRecords = [];
  const skippedRecords = [];

  for (let index = 0; index < pdfFiles.length; index += 1) {
    const pdfFile = pdfFiles[index];
    const record = await parseVisaPdf(pdfFile.buffer, pdfFile.originalname);

    onProgress({
      progress: Math.round(((index + 1) / pdfFiles.length) * 70),
      currentPassport: record.passport || null,
      status: "processing"
    });

    if (isFutureIssueDate(record.issueDate)) {
      skippedRecords.push({
        sourceName: record.sourceName,
        passport: record.passport,
        reason: "Issue date lon hon ngay hien tai"
      });
      continue;
    }

    if (!record.entryType || !record.expiryDate) {
      skippedRecords.push({
        sourceName: record.sourceName,
        passport: record.passport,
        reason: "Thieu Entry type hoac Expiry date"
      });
      continue;
    }

    parsedRecords.push(record);
  }

  const groupedRecords = groupRecords(parsedRecords);
  onProgress({
    progress: 85,
    currentPassport: null,
    status: "exporting"
  });

  const outputs = await exportGroupedResults(templateBuffer, groupedRecords);

  return {
    parsedRecords,
    skippedRecords,
    groupedRecords,
    outputs
  };
}
