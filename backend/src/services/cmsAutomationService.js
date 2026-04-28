import fs from "node:fs/promises";
import path from "node:path";
import { downloadsDir } from "../config/paths.js";
import { exportGroupedResults } from "./excelExporter.js";
import { parsePassportText } from "./passportService.js";
import { parseVisaPdf } from "./pdfParser.js";
import { getCmsPageOrThrow } from "./cmsSessionService.js";

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

async function saveBlobPageToFile(popupPage, targetPath) {
  await popupPage.waitForLoadState("domcontentloaded").catch(() => {});
  await popupPage.waitForTimeout(1200);

  const bytes = await popupPage.evaluate(async () => {
    const response = await fetch(window.location.href);
    const buffer = await response.arrayBuffer();
    return Array.from(new Uint8Array(buffer));
  });

  await fs.writeFile(targetPath, Buffer.from(bytes));
}

async function searchAndDownloadOnePassport(page, passport) {
  const input = page.locator("input.ant-input.ant-input-sm").first();
  const searchButton = page.locator("form .ant-btn-primary").first();
  const tableBody = page.locator("tbody.ant-table-tbody");
  const dataRows = tableBody.locator("tr.ant-table-row");
  const emptyRow = tableBody.locator("tr.ant-table-placeholder");

  await input.fill("");
  await input.fill(passport);
  await searchButton.click();
  await page.waitForTimeout(1800);

  const rowCount = await dataRows.count();
  const hasEmpty = (await emptyRow.count()) > 0;

  if (rowCount === 0 || hasEmpty) {
    return {
      passport,
      status: "not_found",
      resultCount: 0,
      rowText: "",
      downloadName: null
    };
  }

  const matchedRows = dataRows.filter({ hasText: passport });
  const firstRow = (await matchedRows.count()) > 0 ? matchedRows.first() : dataRows.first();
  const rowText = await firstRow.innerText();
  const downloadIcon = firstRow.locator("span.anticon-download").first();

  await fs.mkdir(downloadsDir, { recursive: true });
  const downloadPromise = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
  const popupPromise = page.context().waitForEvent("page", { timeout: 8000 }).catch(() => null);
  await downloadIcon.click();
  const downloadPath = path.join(downloadsDir, `${passport}.pdf`);
  const download = await downloadPromise;

  if (download) {
    await download.saveAs(downloadPath);
  } else {
    const popupPage = await popupPromise;
    if (!popupPage) {
      throw new Error(`Khong bat duoc file PDF cho passport ${passport}`);
    }

    await saveBlobPageToFile(popupPage, downloadPath);
    await popupPage.close().catch(() => {});
  }

  return {
    passport,
    status: "downloaded",
    resultCount: rowCount,
    rowText,
    downloadPath,
    downloadName: path.basename(downloadPath)
  };
}

export async function runCmsAutomationJob({ passportContent, templateBuffer, onProgress }) {
  const page = getCmsPageOrThrow();
  const passports = parsePassportText(passportContent);
  const searchResults = [];
  const parsedRecords = [];
  const skippedRecords = [];

  for (let index = 0; index < passports.length; index += 1) {
    const passport = passports[index];
    onProgress({
      progress: Math.max(5, Math.round(((index + 1) / passports.length) * 55)),
      currentPassport: passport,
      status: "searching"
    });

    const searchResult = await searchAndDownloadOnePassport(page, passport);

    if (!searchResult.downloadPath) {
      searchResults.push(searchResult);
      skippedRecords.push({
        sourceName: passport,
        passport,
        reason: "Khong tim thay ho so tren CMS"
      });
      continue;
    }

    onProgress({
      progress: Math.max(56, Math.round(((index + 1) / passports.length) * 80)),
      currentPassport: passport,
      status: "parsing"
    });

    try {
      const buffer = await fs.readFile(searchResult.downloadPath);
      const record = await parseVisaPdf(buffer, path.basename(searchResult.downloadPath));

      searchResults.push({
        passport: searchResult.passport,
        status: searchResult.status,
        resultCount: searchResult.resultCount,
        rowText: searchResult.rowText,
        downloadName: searchResult.downloadName
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
    } finally {
      await fs.unlink(searchResult.downloadPath).catch(() => {});
    }
  }

  const groupedRecords = groupRecords(parsedRecords);
  onProgress({
    progress: 90,
    currentPassport: null,
    status: "exporting"
  });

  const outputs = await exportGroupedResults(templateBuffer, groupedRecords);

  return {
    passports,
    searchResults,
    parsedRecords,
    skippedRecords,
    groupedRecords,
    outputs,
    found: searchResults.filter((item) => item.status === "downloaded").length,
    notFound: searchResults.filter((item) => item.status === "not_found").length
  };
}
