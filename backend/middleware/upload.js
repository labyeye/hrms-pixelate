const multer = require("multer");
const path = require("path");
const fs = require("fs");

const UPLOAD_BASE = path.join(__dirname, "../uploads");

// Ensure upload dirs exist on startup
["employee-aadhaar", "employee-pan", "employee-resume", "company-logos"].forEach((dir) => {
  const p = path.join(UPLOAD_BASE, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const employeeDocStorage = multer.diskStorage({
  destination(req, file, cb) {
    const folderMap = {
      aadhaarDoc: "employee-aadhaar",
      panDoc:     "employee-pan",
      resumeDoc:  "employee-resume",
    };
    cb(null, path.join(UPLOAD_BASE, folderMap[file.fieldname] || "employee-resume"));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    const safe = `${req.user.company}_${req.params.id}_${file.fieldname}${ext}`;
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
  { name: "panDoc",     maxCount: 1 },
  { name: "resumeDoc",  maxCount: 1 },
]);

const companyLogoStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, path.join(UPLOAD_BASE, "company-logos"));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const safe = `company_${req.user.company}${ext}`;
    cb(null, safe);
  },
});

const uploadCompanyLogo = multer({
  storage: companyLogoStorage,
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("logo");

module.exports = { uploadEmployeeDocs, uploadCompanyLogo };
