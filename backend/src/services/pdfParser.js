import pdf from "pdf-parse";

function normalizeText(value) {
  return value.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
}

function extractByPatterns(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return normalizeText(match[1]);
    }
  }

  return "";
}

function normalizeDate(value) {
  if (!value) {
    return "";
  }

  const raw = value
    .replace(/\./g, "/")
    .replace(/-/g, "/")
    .replace(/[^\d/]/g, "")
    .trim();
  const parts = raw.split("/").map((part) => part.trim());
  if (parts.length !== 3) {
    return value.trim();
  }

  const [a, b, c] = parts;
  if (c.length === 4) {
    return `${a.padStart(2, "0")}/${b.padStart(2, "0")}/${c}`;
  }

  return value.trim();
}

function extractDates(value) {
  return [...String(value ?? "").matchAll(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}/g)].map((match) =>
    normalizeDate(match[0])
  );
}

function stripDiacritics(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isLabelValue(value) {
  const normalized = stripDiacritics(String(value ?? "")).toLowerCase().trim();
  if (!normalized) {
    return true;
  }

  return [
    "full name",
    "date of birth",
    "passport",
    "passport number",
    "good for entry valid from",
    "until",
    "date of expiry"
  ].includes(normalized);
}

function findEntryType(text) {
  const normalized = stripDiacritics(text).toLowerCase();
  const valueText = normalized
    .replace(/good for single\/multiple entries/g, " ")
    .replace(/single\/multiple/g, " ");

  const entryValueMatch = valueText.match(/su dung mot\/nhieu lan\s*(single|multiple)/i);
  if (entryValueMatch?.[1]) {
    return entryValueMatch[1].toLowerCase() === "single" ? "1L" : "NL";
  }

  if (/\bsingle\b/i.test(valueText)) {
    return "1L";
  }

  if (
    /\bmultiple\b/i.test(valueText) ||
    /\bnhieu lan\b/i.test(valueText)
  ) {
    return "NL";
  }

  if (/\bmot lan\b/i.test(valueText)) {
    return "1L";
  }

  const match = text.match(/\b(1L|NL)\b/i);
  return match ? match[1].toUpperCase() : "";
}

function extractEvNumber(text) {
  return extractByPatterns(text, [
    /S(?:ố|á»‘)\s*[:\-]?\s*([A-Z0-9./-]+\/EV)\b/i,
    /(?:E-?Visa|EV)\s*(?:number|no\.?)?\s*[:\-]?\s*([A-Z0-9./-]+)\b/i,
    /Registration\s*number\s*[:\-]?\s*([A-Z0-9./-]+)\b/i,
    /M(?:ã|Ã£)\s*[:\-]?\s*([A-Z0-9./-]+)\b/i
  ]).toUpperCase();
}

function parseTrailingValueBlock(text) {
  const lines = text
    .split("\n")
    .map((line) => normalizeText(line))
    .filter(Boolean);

  const evIndex = lines.findIndex((line) => /\d+\/EV\b/i.test(line));
  if (evIndex < 0) {
    return {};
  }

  const evNumber = lines[evIndex].match(/\d+\/EV\b/i)?.[0] ?? "";
  const codeIndex = lines.findIndex((line, index) => index > evIndex && /^E\d{6}[A-Z0-9]+$/i.test(line));
  const dateIndex = lines.findIndex((line, index) => index > codeIndex && extractDates(line).length >= 2);
  const entryIndex = lines.findIndex((line, index) => index > dateIndex && /\b(single|multiple)\b/i.test(line));

  const validDates = dateIndex >= 0 ? extractDates(lines[dateIndex]) : [];
  const passportExpiryLine = entryIndex >= 0 ? lines[entryIndex + 4] ?? "" : "";
  const passportExpiryMatch = passportExpiryLine.match(/^([A-Z0-9]+?)(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})$/i);

  return {
    evNumber: evNumber.toUpperCase(),
    issueDate: validDates[0] ?? "",
    expiryDate: validDates[1] ?? "",
    entryType: entryIndex >= 0 ? findEntryType(lines[entryIndex]) : "",
    name: entryIndex >= 0 ? lines[entryIndex + 1] ?? "" : "",
    dob: entryIndex >= 0 ? normalizeDate(lines[entryIndex + 2] ?? "") : "",
    passport: passportExpiryMatch ? passportExpiryMatch[1].toUpperCase() : ""
  };
}

function mergeFallbackRecord(record, fallback) {
  const merged = { ...record };
  for (const field of ["name", "dob", "passport", "issueDate", "expiryDate", "entryType"]) {
    if (isLabelValue(merged[field]) && fallback[field]) {
      merged[field] = fallback[field];
    }
  }

  if (fallback.entryType) {
    merged.entryType = fallback.entryType;
  }

  if (fallback.evNumber && !/\/EV\b/i.test(merged.evNumber)) {
    merged.evNumber = fallback.evNumber;
  }

  return merged;
}

function parseFromText(text, sourceName) {
  const plainText = stripDiacritics(text).toLowerCase();

  const record = {
    sourceName,
    name: extractByPatterns(text, [
      /HỌ TÊN\s*[:\-]?\s*(.+)/i,
      /Há»Œ TÃŠN\s*[:\-]?\s*(.+)/i,
      /Full\s*name\s*[:\-]?\s*(.+)/i,
      /Name\s*[:\-]?\s*(.+)/i,
      /Surname and given name\s*[:\-]?\s*(.+)/i
    ]),
    dob: normalizeDate(
      extractByPatterns(text, [
        /NGÀY THÁNG NĂM SINH\s*[:\-]?\s*(.+)/i,
        /NGÃ€Y THÃNG NÄ‚M SINH\s*[:\-]?\s*(.+)/i,
        /Date\s*of\s*birth\s*[:\-]?\s*(.+)/i,
        /DOB\s*[:\-]?\s*(.+)/i,
        /Birth\s*date\s*[:\-]?\s*(.+)/i
      ])
    ),
    passport: extractByPatterns(text, [
      /SỐ HỘ CHIẾU\s*[:\-]?\s*([A-Z0-9]+)/i,
      /Sá» Há»˜ CHIáº¾U\s*[:\-]?\s*([A-Z0-9]+)/i,
      /Passport(?:\s*No\.?|\s*number)?\s*[:\-]?\s*([A-Z0-9]+)/i,
      /Document\s*number\s*[:\-]?\s*([A-Z0-9]+)/i
    ]).toUpperCase(),
    evNumber: extractEvNumber(text),
    issueDate: normalizeDate(
      extractByPatterns(text, [
        /THỊ THỰC CÓ GIÁ TRỊ TỪ NGÀY\s*(.+)/i,
        /THá»Š THá»°C CÃ“ GIÃ TRá»Š Tá»ª NGÃ€Y\s*(.+)/i,
        /Issue\s*date\s*[:\-]?\s*(.+)/i,
        /Valid\s*from\s*[:\-]?\s*(.+)/i
      ])
    ),
    expiryDate: normalizeDate(
      extractByPatterns(text, [
        /ĐẾN NGÀY\s*(.+)/i,
        /Äáº¾N NGÃ€Y\s*(.+)/i,
        /Expiry\s*date\s*[:\-]?\s*(.+)/i,
        /Valid\s*until\s*[:\-]?\s*(.+)/i,
        /Date\s*of\s*expiry\s*[:\-]?\s*(.+)/i
      ])
    ),
    entryType: findEntryType(plainText)
  };

  return mergeFallbackRecord(record, parseTrailingValueBlock(text));
}

export async function parseVisaPdf(buffer, sourceName) {
  const parsed = await pdf(buffer);
  const text = normalizeText(parsed.text ?? "");
  const record = parseFromText(text, sourceName);

  if (!record.name && !record.passport && !record.evNumber) {
    throw new Error(`Khong doc duoc du lieu visa tu file ${sourceName}`);
  }

  return record;
}
