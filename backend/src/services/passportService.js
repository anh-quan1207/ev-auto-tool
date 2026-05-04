export function parsePassportText(content) {
  return content
    .split(/\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}
