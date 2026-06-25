const path = require("path");
const fs = require("fs");
const asyncHandler = require("express-async-handler");
const EmployeeDocument = require("../models/EmployeeDocument");
const Employee = require("../models/Employee");
const { validateMagicBytes } = require("../middleware/upload");

const UPLOADS_ROOT = path.resolve(__dirname, "../uploads/employee-docs");

const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }

  const { employeeId, name, docType } = req.body;
  if (!employeeId || !name || !docType) {
    fs.unlinkSync(req.file.path);
    res.status(400);
    throw new Error("employeeId, name and docType are required");
  }

  await validateMagicBytes(req.file.path);

  const employee = await Employee.findOne({
    _id: employeeId,
    company: req.user.company,
  });
  if (!employee) {
    fs.unlinkSync(req.file.path);
    res.status(404);
    throw new Error("Employee not found");
  }

  const relativePath = path
    .relative(path.resolve(__dirname, "../"), req.file.path)
    .replace(/\\/g, "/");

  const doc = await EmployeeDocument.create({
    company: req.user.company,
    employee: employeeId,
    uploadedBy: req.user._id,
    name,
    docType,
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size,
    filePath: relativePath,
  });

  res.status(201).json({
    success: true,
    data: {
      _id: doc._id,
      name: doc.name,
      docType: doc.docType,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      createdAt: doc.createdAt,
    },
  });
});

const getDocuments = asyncHandler(async (req, res) => {
  const { employeeId } = req.query;
  const filter = { company: req.user.company };

  if (req.user.role === "employee") {
    const emp = await Employee.findOne({
      user: req.user._id,
      company: req.user.company,
    });
    if (!emp) return res.json({ success: true, data: [] });
    filter.employee = emp._id;
  } else if (employeeId) {
    filter.employee = employeeId;
  }

  const docs = await EmployeeDocument.find(filter)
    .select("-filePath")
    .populate("employee", "firstName lastName employeeId")
    .populate("uploadedBy", "name email")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: docs });
});

const downloadDocument = asyncHandler(async (req, res) => {
  const doc = await EmployeeDocument.findOne({
    _id: req.params.id,
    company: req.user.company,
  }).populate("employee", "user");

  if (!doc) {
    res.status(404);
    throw new Error("Document not found");
  }

  if (
    req.user.role === "employee" &&
    String(doc.employee?.user) !== String(req.user._id)
  ) {
    res.status(403);
    throw new Error("Access denied");
  }

  const abs = path.resolve(__dirname, "../", doc.filePath);

  // Path traversal guard
  if (!abs.startsWith(UPLOADS_ROOT + path.sep) && abs !== UPLOADS_ROOT) {
    res.status(403);
    throw new Error("Access denied");
  }

  if (!fs.existsSync(abs)) {
    res.status(404);
    throw new Error("File missing on server");
  }

  res.download(abs, doc.name);
});

const deleteDocument = asyncHandler(async (req, res) => {
  const doc = await EmployeeDocument.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!doc) {
    res.status(404);
    throw new Error("Document not found");
  }

  // Delete file from disk
  if (doc.filePath) {
    const abs = path.resolve(__dirname, "../", doc.filePath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }

  await doc.deleteOne();
  res.json({ success: true, message: "Document deleted" });
});

module.exports = {
  uploadDocument,
  getDocuments,
  downloadDocument,
  deleteDocument,
};
