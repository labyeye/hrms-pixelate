const asyncHandler = require("express-async-handler");
const Setting = require("../models/Setting");
const Company = require("../models/Company");
const bodyFor = require("../utils/bodyFor");
const { sanitizeIdCardTemplate } = require("../utils/idCardTemplate");
const { validateMagicBytes } = require("../middleware/upload");

const getSettings = asyncHandler(async (req, res) => {
  const company = req.user.company;
  let setting = await Setting.findOne({ company });

  if (!setting) {
    setting = await Setting.create({ company });
  }

  res.json({ success: true, data: setting });
});

const updateSettings = asyncHandler(async (req, res) => {
  const company = req.user.company;
  const update = bodyFor(Setting, req.body);
  // Whether employees may reset their own face is the super admin's call alone
  if ("allowEmployeeFaceReset" in update && req.user.role !== "super_admin") {
    delete update.allowEmployeeFaceReset;
  }
  if ("idCardTemplate" in update) {
    try {
      update.idCardTemplate = sanitizeIdCardTemplate(update.idCardTemplate);
    } catch (e) {
      res.status(400);
      throw e;
    }
  }
  const setting = await Setting.findOneAndUpdate(
    { company },
    { $set: { ...update, company } },
    { new: true, upsert: true, runValidators: true },
  );

  // Invoices/PDFs read GST off the Company document, not Setting — keep it
  // in sync so a GST number entered here actually shows up on invoices.
  if (typeof req.body.companyGST === "string") {
    await Company.findByIdAndUpdate(company, {
      gstNumber: req.body.companyGST,
    });
  }

  res.json({ success: true, data: setting });
});

// An image for an ID-card design (background, logo, badge…). Returns its public URL; the design itself is saved
// through the normal settings update, which only accepts URLs from this folder.
const uploadIdCardImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }
  try {
    await validateMagicBytes(req.file.path); // deletes the file and throws when it isn't a real image
  } catch (err) {
    res.status(400);
    throw err;
  }
  res.json({ success: true, url: `/uploads/id-card-images/${req.file.filename}` });
});

const uploadCompanyLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }
  try {
    await validateMagicBytes(req.file.path); // deletes the file and throws when it isn't a real image
  } catch (err) {
    res.status(400);
    throw err;
  }
  const logoUrl = `/uploads/company-logos/${req.file.filename}`;
  const setting = await Setting.findOneAndUpdate(
    { company: req.user.company },
    { $set: { logoUrl, company: req.user.company } },
    { new: true, upsert: true },
  );
  res.json({ success: true, logoUrl, data: setting });
});

module.exports = {
  getSettings,
  updateSettings,
  uploadCompanyLogo,
  uploadIdCardImage,
};
