const asyncHandler = require("express-async-handler");
const LateApproval = require("../models/LateApproval");
const Attendance = require("../models/Attendance");

// ?status=pending|approved|rejected  -> that status only
// ?month=&year= (optional status=all)  -> every record of that month, pending and marked, for the date-strip view
// no params                            -> pending only (legacy callers)
const getLateApprovals = asyncHandler(async (req, res) => {
  const { status, month, year } = req.query;
  const filter = { company: req.user.company };
  if (month && year) {
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (isNaN(m) || isNaN(y) || m < 1 || m > 12) {
      res.status(400);
      throw new Error("Valid month and year are required");
    }
    // +-1 day slack: attendance dates are stored at local midnight, which is the previous UTC day in IST
    filter.date = {
      $gte: new Date(Date.UTC(y, m - 1, 0)),
      $lt: new Date(Date.UTC(y, m, 2)),
    };
    if (["pending", "approved", "rejected"].includes(status))
      filter.status = status;
  } else {
    filter.status = ["pending", "approved", "rejected"].includes(status)
      ? status
      : "pending";
  }

  const approvals = await LateApproval.find(filter)
    .populate({
      path: "employee",
      select:
        "firstName lastName employeeId designation salary department avatar",
      populate: { path: "department", select: "name" },
    })
    .sort({ date: -1, createdAt: -1 });

  res.json({ success: true, data: approvals });
});

const resolveLateApproval = asyncHandler(async (req, res) => {
  const { resolvedStatus } = req.body;
  if (!["present", "late", "absent", "half_day"].includes(resolvedStatus)) {
    res.status(400);
    throw new Error("Invalid resolvedStatus");
  }

  const approval = await LateApproval.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!approval) {
    res.status(404);
    throw new Error("Late approval not found");
  }

  approval.status = "approved";
  approval.resolvedStatus = resolvedStatus;
  approval.resolvedBy = req.user._id;
  approval.resolvedAt = new Date();
  await approval.save();

  await Attendance.findOneAndUpdate(
    { employee: approval.employee, date: approval.date },
    { status: resolvedStatus, approvalPending: false },
  );

  res.json({ success: true, data: approval });
});

module.exports = { getLateApprovals, resolveLateApproval };
