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

function stripDiacritics(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function findEntryType(text) {
  if (/\bmultiple\b/i.test(text) || /\bnhieu lan\b/i.test(text)) {
    return "NL";
  }

  if (/\bsingle\b/i.test(text) || /\bmot lan\b/i.test(text)) {
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

function parseFromText(text, sourceName) {
  const plainText = stripDiacritics(text).toLowerCase();

  return {
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
