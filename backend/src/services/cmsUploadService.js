import { parsePassportText } from "./passportService.js";

export async function prepareCmsUploadPayload({ passportFile, templateName }) {
  const passportContent = passportFile.buffer.toString("utf8");
  const passports = parsePassportText(passportContent);

  return {
    files: {
      passport: {
        id: passportFile.id,
        originalname: passportFile.originalname,
        size: passportFile.buffer.length
      }
    },
    summary: {
      passportCount: passports.length,
      templateName
    },
    passports
  };
}
