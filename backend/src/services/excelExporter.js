import XLSX from "xlsx";

const HEADER_MAP = {
  name: "Họ tên (tiếng Anh)",
  dob: "Ngày sinh",
  passport: "Số giấy tờ",
  evNumber: "Số Visa điện tử",
  expiryDate: "Ngày hết hạn",
  issueDate: "Ngày hiệu lực"
};

function padPeopleCount(value) {
  return String(value).padStart(2, "0");
}

function toFilenameDate(value) {
  return value.replace(/\//g, "-");
}

function getLastThree(value) {
  const digits = value.replace(/\D/g, "");
  return digits.slice(-3) || "000";
}

function formatEvForExcel(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  const match = normalized.match(/^(\d+)\/EV$/);
  return match ? `EV ${match[1]}` : normalized;
}

function formatDobForExcel(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "";
  }

  return normalized.startsWith("'") ? normalized : `'${normalized}`;
}

function resolveCellMap(headerRow) {
  const cellMap = {};

  Object.entries(HEADER_MAP).forEach(([key, header]) => {
    const indexes = headerRow
      .map((value, index) => ({ value: String(value).trim(), index }))
      .filter((entry) => entry.value === header)
      .map((entry) => entry.index);

    if (indexes.length > 0) {
      cellMap[key] = key === "expiryDate" ? indexes[indexes.length - 1] : indexes[0];
    }
  });

  return cellMap;
}

function setCellValue(worksheet, rowIndexZeroBased, columnIndexZeroBased, value) {
  if (columnIndexZeroBased === undefined) {
    return;
  }

  const address = XLSX.utils.encode_cell({
    r: rowIndexZeroBased,
    c: columnIndexZeroBased
  });

  const existing = worksheet[address] ?? {};
  worksheet[address] = {
    ...existing,
    t: "s",
    v: value ?? "",
    w: value ?? ""
  };
}

function loadWorkbookForExport(templateBuffer) {
  return XLSX.read(templateBuffer, {
    type: "buffer",
    cellStyles: true,
    cellNF: true,
    cellDates: false
  });
}

function createWorkbookBuffer(templateBuffer, records) {
  const workbook = loadWorkbookForExport(templateBuffer);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  const headerRow = rows[0] ?? [];
  const cellMap = resolveCellMap(headerRow);

  records.forEach((record, index) => {
    const rowIndex = index + 1;
    setCellValue(worksheet, rowIndex, cellMap.name, record.name);
    setCellValue(worksheet, rowIndex, cellMap.dob, formatDobForExcel(record.dob));
    setCellValue(worksheet, rowIndex, cellMap.passport, record.passport);
    setCellValue(worksheet, rowIndex, cellMap.evNumber, formatEvForExcel(record.evNumber));
    setCellValue(worksheet, rowIndex, cellMap.expiryDate, record.expiryDate);
    setCellValue(worksheet, rowIndex, cellMap.issueDate, record.issueDate);
  });

  return XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx"
  });
}

export async function exportGroupedResults(templateBuffer, groupedRecords) {
  const outputs = [];
  const allRecords = groupedRecords.flatMap((group) => group.records);

  for (const group of groupedRecords) {
    const fileName = `EV ${group.entryType} ${padPeopleCount(group.records.length)}K (DY) ${getLastThree(group.records[0].evNumber)} - ${toFilenameDate(group.expiryDate)}.xlsx`;
    const buffer = createWorkbookBuffer(templateBuffer, group.records);

    outputs.push({
      fileName,
      buffer,
      entryType: group.entryType,
      expiryDate: group.expiryDate,
      count: group.records.length
    });
  }

  if (allRecords.length > 0) {
    outputs.push({
      fileName: `EV TONG HOP ${padPeopleCount(allRecords.length)}K (DY) ${getLastThree(allRecords[0].evNumber)}.xlsx`,
      buffer: createWorkbookBuffer(templateBuffer, allRecords),
      entryType: "ALL",
      expiryDate: "",
      count: allRecords.length
    });
  }

  return outputs;
}
