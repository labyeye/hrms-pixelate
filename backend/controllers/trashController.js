const path = require("path");
const fs = require("fs");
const asyncHandler = require("express-async-handler");
const Trash = require("../models/Trash");
const Leave = require("../models/Leave");
const Task = require("../models/Task");
const Announcement = require("../models/Announcement");
const EmployeeDocument = require("../models/EmployeeDocument");

const MODELS = { Leave, Task, Announcement, EmployeeDocument };
const UPLOADS_ROOT = path.resolve(__dirname, "../uploads/employee-docs");

// Reused by other controllers instead of doc.deleteOne() to make deletes recoverable.
const moveToTrash = async (modelName, doc, req) => {
  await Trash.create({
    company: req.user.company,
    modelName,
    originalId: doc._id,
    data: doc.toObject(),
    deletedBy: req.user._id,
    deletedByName: req.user.name || "",
  });
  await doc.deleteOne();
};

const getTrash = asyncHandler(async (req, res) => {
  const filter = { company: req.user.company };
  if (req.query.modelName) filter.modelName = req.query.modelName;
  const items = await Trash.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: items });
});

const restoreTrash = asyncHandler(async (req, res) => {
  const item = await Trash.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!item) {
    res.status(404);
    throw new Error("Trash item not found");
  }

  const Model = MODELS[item.modelName];
  const { _id, __v, ...rest } = item.data;
  await Model.create({ ...rest, _id: item.originalId });
  await item.deleteOne();

  res.json({ success: true, message: "Item restored" });
});

const purgeTrash = asyncHandler(async (req, res) => {
  const item = await Trash.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!item) {
    res.status(404);
    throw new Error("Trash item not found");
  }

  if (item.modelName === "EmployeeDocument" && item.data.filePath) {
    const abs = path.resolve(__dirname, "../", item.data.filePath);
    if (
      (abs.startsWith(UPLOADS_ROOT + path.sep) || abs === UPLOADS_ROOT) &&
      fs.existsSync(abs)
    ) {
      fs.unlinkSync(abs);
    }
  }

  await item.deleteOne();
  res.json({ success: true, message: "Item permanently deleted" });
});

module.exports = { moveToTrash, getTrash, restoreTrash, purgeTrash };
