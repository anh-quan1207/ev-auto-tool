import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const backendRoot = path.resolve(__dirname, "..", "..");
export const dataRoot = path.join(backendRoot, "data");
export const uploadsDir = path.join(dataRoot, "uploads");
export const downloadsDir = path.join(dataRoot, "downloads");
export const outputsDir = path.join(dataRoot, "outputs");
