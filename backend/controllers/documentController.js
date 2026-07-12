const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const EmployeeDocument = require("../models/EmployeeDocument");
const Employee = require("../models/Employee");
const { validateMagicBytes } = require("../middleware/upload");
const { moveToTrash } = require("./trashController");

const UPLOADS_ROOT = path.resolve(__dirname, "../uploads/employee-docs");

const uploadDocument = asyncHandler(async (req, res) => {
  let fileData = req.body.fileData;
  let employeeId = req.body.employeeId;
  let name = req.body.name;
  let docType = req.body.docType;

  let targetEmployeeId = employeeId;
  if (req.user.role === "employee") {
    const emp = await Employee.findOne({ user: req.user._id });
    if (!emp) {
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(404);
      throw new Error("Employee record not found");
    }
    targetEmployeeId = emp._id.toString();
  }

  if (!targetEmployeeId || !name || !docType) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(400);
    throw new Error("employeeId, name and docType are required");
  }

  let finalFile = null;

  if (req.file) {
    finalFile = req.file;
  } else if (fileData) {
    const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      res.status(400);
      throw new Error("Invalid base64 file data");
    }
    const mimeType = matches[1];
    const fileBuffer = Buffer.from(matches[2], "base64");
    const sizeBytes = fileBuffer.length;

    const ext = mimeType.split("/")[1] || "bin";
    const filename = `${Date.now()}_${crypto.randomUUID()}.${ext}`;
    const absPath = path.resolve(UPLOADS_ROOT, filename);

    fs.writeFileSync(absPath, fileBuffer);

    finalFile = {
      path: absPath,
      mimetype: mimeType,
      size: sizeBytes,
      filename: filename,
    };
  }

  if (!finalFile) {
    res.status(400);
    throw new Error("No file uploaded");
  }

  await validateMagicBytes(finalFile.path);

  const employee = await Employee.findOne({
    _id: targetEmployeeId,
    company: req.user.company,
  });
  if (!employee) {
    fs.unlinkSync(finalFile.path);
    res.status(404);
    throw new Error("Employee not found");
  }

  const relativePath = path
    .relative(path.resolve(__dirname, "../"), finalFile.path)
    .replace(/\\/g, "/");

  const doc = await EmployeeDocument.create({
    company: req.user.company,
    employee: targetEmployeeId,
    uploadedBy: req.user._id,
    name,
    docType,
    mimeType: finalFile.mimetype,
    sizeBytes: finalFile.size,
    filePath: relativePath,
    expiryDate: req.body.expiryDate || null,
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

const LETTER_TEMPLATES = {
  salary_certificate: (emp, company) => `SALARY CERTIFICATE

This is to certify that ${emp.firstName} ${emp.lastName} (Employee ID: ${emp.employeeId}) is employed with ${company?.name || "the company"} as ${emp.designation} since ${emp.joinDate ? new Date(emp.joinDate).toDateString() : "N/A"}.

Current gross salary: ₹${emp.salary || 0} per month.

This certificate is issued upon the employee's request for official purposes.

Date: ${new Date().toDateString()}`,
  experience_letter: (emp, company) => `EXPERIENCE LETTER

This is to certify that ${emp.firstName} ${emp.lastName} (Employee ID: ${emp.employeeId}) worked with ${company?.name || "the company"} as ${emp.designation} from ${emp.joinDate ? new Date(emp.joinDate).toDateString() : "N/A"} ${emp.exitDate ? `to ${new Date(emp.exitDate).toDateString()}` : "to present"}.

During this period, their conduct and performance were found satisfactory.

Date: ${new Date().toDateString()}`,
  address_proof_letter: (emp, company) => `ADDRESS PROOF LETTER

This is to certify that ${emp.firstName} ${emp.lastName} (Employee ID: ${emp.employeeId}) is a bona fide employee of ${company?.name || "the company"}, working as ${emp.designation}.

This letter is issued for address proof purposes upon the employee's request.

Date: ${new Date().toDateString()}`,
};

const generateLetter = asyncHandler(async (req, res) => {
  const { employeeId, docType } = req.body;
  if (!employeeId || !LETTER_TEMPLATES[docType]) {
    res.status(400);
    throw new Error("Valid employeeId and docType are required");
  }

  const employee = await Employee.findOne({
    _id: employeeId,
    company: req.user.company,
  });
  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
  }

  const Company = require("../models/Company");
  const company = await Company.findById(req.user.company);

  const content = LETTER_TEMPLATES[docType](employee, company);
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.txt`;
  const absPath = path.resolve(UPLOADS_ROOT, filename);
  fs.writeFileSync(absPath, content, "utf8");

  const relativePath = path
    .relative(path.resolve(__dirname, "../"), absPath)
    .replace(/\\/g, "/");

  const doc = await EmployeeDocument.create({
    company: req.user.company,
    employee: employeeId,
    uploadedBy: req.user._id,
    name: `${docType.replace(/_/g, " ")} - ${employee.firstName} ${employee.lastName}`,
    docType,
    mimeType: "text/plain",
    sizeBytes: Buffer.byteLength(content, "utf8"),
    filePath: relativePath,
    generated: true,
  });

  res.status(201).json({
    success: true,
    data: {
      _id: doc._id,
      name: doc.name,
      docType: doc.docType,
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

  if (req.query.expiringWithinDays) {
    const days = Number(req.query.expiringWithinDays);
    const cutoff = new Date(Date.now() + days * 86400000);
    return res.json({
      success: true,
      data: docs.filter((d) => d.expiryDate && d.expiryDate <= cutoff),
    });
  }

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

  const fileBuffer = fs.readFileSync(abs);
  const base64 = fileBuffer.toString("base64");

  res.json({
    success: true,
    data: {
      fileData: base64,
      mimeType: doc.mimeType,
      name: doc.name,
    },
  });
});

const deleteDocument = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, company: req.user.company };

  if (req.user.role === "employee") {
    const emp = await Employee.findOne({ user: req.user._id });
    if (!emp) {
      res.status(404);
      throw new Error("Employee record not found");
    }
    filter.employee = emp._id;
  }

  const doc = await EmployeeDocument.findOne(filter);
  if (!doc) {
    res.status(404);
    throw new Error("Document not found");
  }

  // File stays on disk until purged from Trash, so restore can recover it.
  await moveToTrash("EmployeeDocument", doc, req);
  res.json({ success: true, message: "Document deleted" });
});

module.exports = {
  uploadDocument,
  getDocuments,
  downloadDocument,
  deleteDocument,
  generateLetter,
};
