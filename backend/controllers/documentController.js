const asyncHandler = require("express-async-handler");
const EmployeeDocument = require("../models/EmployeeDocument");
const Employee = require("../models/Employee");

const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB

const uploadDocument = asyncHandler(async (req, res) => {
  const { employeeId, name, docType, mimeType, fileData } = req.body;

  if (!employeeId || !name || !docType || !mimeType || !fileData) {
    res.status(400);
    throw new Error("employeeId, name, docType, mimeType and fileData are required");
  }

  const employee = await Employee.findOne({
    _id: employeeId,
    company: req.user.company,
  });
  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
  }

  // Strip data URI prefix if present
  const base64 = fileData.includes(",") ? fileData.split(",")[1] : fileData;
  const sizeBytes = Math.round((base64.length * 3) / 4);

  if (sizeBytes > MAX_SIZE_BYTES) {
    res.status(400);
    throw new Error("File too large. Maximum size is 4 MB.");
  }

  const doc = await EmployeeDocument.create({
    company: req.user.company,
    employee: employeeId,
    uploadedBy: req.user._id,
    name,
    docType,
    mimeType,
    sizeBytes,
    fileData: base64,
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
    // Employees can only see their own documents
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
    .select("-fileData")
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

  res.json({
    success: true,
    data: {
      _id: doc._id,
      name: doc.name,
      mimeType: doc.mimeType,
      fileData: doc.fileData,
    },
  });
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
  await doc.deleteOne();
  res.json({ success: true, message: "Document deleted" });
});

module.exports = { uploadDocument, getDocuments, downloadDocument, deleteDocument };
