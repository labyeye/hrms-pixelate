// One-off: encrypts every legacy plaintext vault/KYC file in place. Safe to re-run (already-encrypted files are skipped).
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { encryptFile } = require("../utils/docVault");

const root = path.resolve(__dirname, "../uploads");
let n = 0;
for (const dir of [
  "employee-docs",
  "employee-aadhaar",
  "employee-pan",
  "employee-resume",
]) {
  const d = path.join(root, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isFile()) {
      encryptFile(p);
      n++;
    }
  }
}
console.log(`Checked ${n} files`);
