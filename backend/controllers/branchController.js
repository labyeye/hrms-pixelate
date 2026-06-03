const asyncHandler = require("express-async-handler");
const Branch = require("../models/Branch");
const Employee = require("../models/Employee");

const getBranches = asyncHandler(async (req, res) => {
  const branches = await Branch.find({ company: req.user.company }).sort({
    createdAt: -1,
  });
  const withCounts = await Promise.all(
    branches.map(async (b) => {
      const emp = await Employee.countDocuments({
        company: req.user.company,
        branch: b._id,
      });
      return { ...b.toObject(), employeeCount: emp };
    }),
  );
  res.json({ success: true, data: withCounts });
});

const createBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.create({
    ...req.body,
    company: req.user.company,
  });
  res
    .status(201)
    .json({ success: true, data: { ...branch.toObject(), employeeCount: 0 } });
});

const updateBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    req.body,
    { new: true },
  );
  if (!branch)
    return res
      .status(404)
      .json({ success: false, message: "Branch not found" });
  res.json({ success: true, data: branch });
});

const deleteBranch = asyncHandler(async (req, res) => {
  await Branch.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  res.json({ success: true, message: "Deleted" });
});

module.exports = { getBranches, createBranch, updateBranch, deleteBranch };
