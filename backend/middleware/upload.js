const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { fromFile } = require("file-type");

// Allowed MIME types matched against actual file magic bytes
const ALLOWED_MAGIC_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

async function validateMagicBytes(filePath) {
  const result = await fromFile(filePath);
  // result is undefined for plain text files — reject those too
  if (!result || !ALLOWED_MAGIC_MIME.has(result.mime)) {
    fs.unlinkSync(filePath);
    throw new Error(
      "File content does not match allowed types (PDF, JPG, PNG, WEBP)",
    );
  }
}

module.exports.validateMagicBytes = validateMagicBytes;

const UPLOAD_BASE = path.join(__dirname, "../uploads");

// Ensure upload dirs exist on startup
[
  "employee-aadhaar",
  "employee-pan",
  "employee-resume",
  "company-logos",
  "employee-docs",
].forEach((dir) => {
  const p = path.join(UPLOAD_BASE, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

// Extensions come from the (magic-byte checked) type, never from the client's file name; SVG is not accepted
// because it can carry script.
const IMAGE_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const DOC_EXT = { ...IMAGE_EXT, "application/pdf": ".pdf" };
const imageFilter = (_req, file, cb) =>
  IMAGE_EXT[file.mimetype]
    ? cb(null, true)
    : cb(new Error("Only JPG, PNG or WEBP images are allowed"), false);
const safeId = (v) => String(v || "").replace(/[^a-fA-F0-9]/g, "");

const employeeDocStorage = multer.diskStorage({
  destination(req, file, cb) {
    const folderMap = {
      aadhaarDoc: "employee-aadhaar",
      panDoc: "employee-pan",
      resumeDoc: "employee-resume",
    };
    cb(
      null,
      path.join(UPLOAD_BASE, folderMap[file.fieldname] || "employee-resume"),
    );
  },
  filename(req, file, cb) {
    const ext = DOC_EXT[file.mimetype] || ".pdf";
    const safe = `${safeId(req.user.company)}_${safeId(req.params.id)}_${file.fieldname}${ext}`;
    cb(null, safe);
  },
});

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only PDF, JPG, PNG, WEBP files are allowed"), false);
}

const uploadEmployeeDocs = multer({
  storage: employeeDocStorage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
}).fields([
  { name: "aadhaarDoc", maxCount: 1 },
  { name: "panDoc", maxCount: 1 },
  { name: "resumeDoc", maxCount: 1 },
]);

const companyLogoStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, path.join(UPLOAD_BASE, "company-logos"));
  },
  filename(req, file, cb) {
    const safe = `company_${safeId(req.user.company)}${IMAGE_EXT[file.mimetype] || ".png"}`;
    cb(null, safe);
  },
});

const uploadCompanyLogo = multer({
  storage: companyLogoStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("logo");

// Employee avatar upload
const avatarStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.join(UPLOAD_BASE, "avatars");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    cb(
      null,
      `avatar_${crypto.randomUUID()}${IMAGE_EXT[file.mimetype] || ".jpg"}`,
    );
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("avatar");

// Announcement poster (shown in the web + mobile apps and in the push notification)
const posterStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.join(UPLOAD_BASE, "announcement-posters");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    cb(
      null,
      `poster_${crypto.randomUUID()}${IMAGE_EXT[file.mimetype] || ".jpg"}`,
    );
  },
});

const uploadAnnouncementPoster = multer({
  storage: posterStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("poster");

// Document vault — generic file upload to disk
const documentVaultStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, path.join(UPLOAD_BASE, "employee-docs"));
  },
  filename(_req, file, cb) {
    const safe = `${Date.now()}_${crypto.randomUUID()}${DOC_EXT[file.mimetype] || ".bin"}`;
    cb(null, safe);
  },
});

const uploadDocumentVault = multer({
  storage: documentVaultStorage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
}).single("file");

// Leave application supporting document (e.g. medical certificate)
const leaveDocStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.join(UPLOAD_BASE, "leave-docs");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const safe = `${Date.now()}_${crypto.randomUUID()}${DOC_EXT[file.mimetype] || ".bin"}`;
    cb(null, safe);
  },
});

const uploadLeaveDocument = multer({
  storage: leaveDocStorage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
}).single("document");

// Attendance self-mark selfie upload (mobile geofenced check-in/out)
const attendanceSelfieStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.join(UPLOAD_BASE, "attendance-selfies");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    // Unguessable: selfies are served publicly so <img> tags work, the name is the only secret.
    const safe = `${safeId(req.user.company)}_${safeId(req.user._id)}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}${IMAGE_EXT[file.mimetype] || ".jpg"}`;
    cb(null, safe);
  },
});

const uploadAttendanceSelfie = multer({
  storage: attendanceSelfieStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("selfie");

// Face enrollment photo — kept in memory only, forwarded to the face-recognition
// service and discarded (only the resulting embedding is persisted).
const uploadFaceEnrollPhoto = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("photo");

module.exports = {
  uploadEmployeeDocs,
  uploadCompanyLogo,
  uploadDocumentVault,
  uploadLeaveDocument,
  uploadAvatar,
  uploadAnnouncementPoster,
  uploadAttendanceSelfie,
  uploadFaceEnrollPhoto,
  validateMagicBytes,
};
