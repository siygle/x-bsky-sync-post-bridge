// Writes the Chrome extension to ./extension so it can be loaded via "Load unpacked" or web-ext.
import fs from "fs";
import path from "path";
import { buildExtensionFiles } from "../extension";

const outDir = path.resolve(import.meta.dirname, "..", "extension");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
for (const [name, content] of Object.entries(buildExtensionFiles())) {
  fs.writeFileSync(path.join(outDir, name), content);
}
console.log(`Chrome extension written to ${outDir}`);
