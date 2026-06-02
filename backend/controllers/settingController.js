const asyncHandler = require("express-async-handler");
const Setting = require("../models/Setting");

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
  const setting = await Setting.findOneAndUpdate(
    { company },
    { $set: { ...req.body, company } },
    { new: true, upsert: true, runValidators: true },
  );

  res.json({ success: true, data: setting });
});

module.exports = { getSettings, updateSettings };
