// Task attachment helpers: content sniffing, allow-list and signed links.
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { fromFile } = require("file-type");

const DIR = path.join(__dirname, "../uploads/task-files");

// Detected content type -> stored extension + kind. SVG/HTML/scripts are deliberately absent.
const TYPES = {
  "image/jpeg": ["jpg", "image"],
  "image/png": ["png", "image"],
  "image/webp": ["webp", "image"],
  "image/gif": ["gif", "image"],
  "image/heic": ["heic", "image"],
  "image/heif": ["heif", "image"],
  "video/mp4": ["mp4", "video"],
  "video/quicktime": ["mov", "video"],
  "video/webm": ["webm", "video"],
  "video/3gpp": ["3gp", "video"],
  "application/pdf": ["pdf", "document"],
  "application/x-cfb": ["doc", "document"], // legacy .doc / .xls / .ppt
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx", "document"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx", "document"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx", "document"],
};
const TEXT_EXT = { txt: "text/plain", csv: "text/csv" };

const drop = (f) => fs.promises.unlink(f.path).catch(() => {});

// Returns attachment records for the files that pass; deletes the ones that don't. Throws if none are valid.
async function vetTaskFiles(files, uploadedBy, purpose) {
  const ok = [];
  const bad = [];
  for (const f of files || []) {
    const origName = path.basename(f.originalname || "file").slice(0, 200);
    let mime;
    let ext;
    let kind;
    const det = await fromFile(f.path).catch(() => null);
    if (det && TYPES[det.mime]) {
      mime = det.mime;
      [ext, kind] = TYPES[det.mime];
    } else if (!det) {
      // plain text / csv have no magic bytes: accept by extension only if it really is text (no NUL bytes)
      const e = path.extname(origName).slice(1).toLowerCase();
      const head = Buffer.alloc(4096);
      const fd = await fs.promises.open(f.path, "r");
      const { bytesRead } = await fd.read(head, 0, 4096, 0);
      await fd.close();
      if (TEXT_EXT[e] && !head.subarray(0, bytesRead).includes(0)) {
        mime = TEXT_EXT[e];
        ext = e;
        kind = "document";
      }
    }
    if (!mime) {
      bad.push(origName);
      await drop(f);
      continue;
    }
    const stored = f.filename.replace(/\.upload$/, `.${ext}`);
    await fs.promises.rename(f.path, path.join(DIR, stored));
    ok.push({ name: origName, file: stored, mime, size: f.size, kind, purpose, uploadedBy });
  }
  if (!ok.length && bad.length)
    throw new Error(`Unsupported file type: ${bad.join(", ")}. Allowed: images, videos (MP4/MOV/WEBM), PDF, Word, Excel, PowerPoint, TXT, CSV`);
  return { ok, bad };
}

const dropAll = (files) => (files || []).forEach((f) => fs.unlink(f.path, () => {}));
const removeStored = (names) => (names || []).forEach((n) => fs.unlink(path.join(DIR, path.basename(n)), () => {}));

const signLink = (file, mime, name) =>
  jwt.sign({ purpose: "task-file", file, mime, name }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "10m" });

function verifyLink(token) {
  const d = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  if (d.purpose !== "task-file") throw new Error("Invalid link");
  return d;
}

module.exports = { DIR, vetTaskFiles, dropAll, removeStored, signLink, verifyLink };
