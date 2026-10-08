const asyncHandler = require("express-async-handler");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const AttendanceCorrectionRequest = require("../models/AttendanceCorrectionRequest");
const LateApproval = require("../models/LateApproval");

const EMP_FIELDS = "firstName lastName avatar";
const LIMIT = 40;
const nameOf = (e) =>
  e ? `${e.firstName || ""} ${e.lastName || ""}`.trim() || "Unknown" : "Unknown";

// Unified activity feed for the header bell: check-ins/outs (today), leave
// requests, attendance corrections and late approvals. Admin/HR see the whole
// company; employees see only their own items.
const getActivityFeed = asyncHandler(async (req, res) => {
  const isAdmin = ["super_admin", "hr_manager"].includes(req.user.role);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let empIds;
  if (isAdmin) {
    empIds = (
      await Employee.find({ company: req.user.company }).select("_id").lean()
    ).map((e) => e._id);
  } else {
    const self = await Employee.findOne({ user: req.user._id })
      .select("_id")
      .lean();
    empIds = self ? [self._id] : [];
  }
  if (!empIds.length) return res.json({ success: true, data: [], pending: 0 });

  const [attendance, leaves, corrections, lates] = await Promise.all([
    Attendance.find({
      employee: { $in: empIds },
      date: { $gte: startOfDay, $lt: endOfDay },
    })
      .populate("employee", EMP_FIELDS)
      .lean(),
    Leave.find({ employee: { $in: empIds }, updatedAt: { $gte: since } })
      .populate("employee", EMP_FIELDS)
      .sort({ updatedAt: -1 })
      .limit(LIMIT)
      .lean(),
    AttendanceCorrectionRequest.find({
      employee: { $in: empIds },
      updatedAt: { $gte: since },
    })
      .populate("employee", EMP_FIELDS)
      .sort({ updatedAt: -1 })
      .limit(LIMIT)
      .lean(),
    isAdmin
      ? LateApproval.find({
          employee: { $in: empIds },
          updatedAt: { $gte: since },
        })
          .populate("employee", EMP_FIELDS)
          .sort({ updatedAt: -1 })
          .limit(LIMIT)
          .lean()
      : [],
  ]);

  const items = [];
  const base = (e) => ({ name: nameOf(e), avatar: e?.avatar });

  for (const a of attendance) {
    if (a.checkIn)
      items.push({
        id: `${a._id}-in`,
        kind: "checkin",
        ...base(a.employee),
        time: a.checkIn,
      });
    if (a.checkOut)
      items.push({
        id: `${a._id}-out`,
        kind: "checkout",
        ...base(a.employee),
        time: a.checkOut,
      });
  }

  for (const l of leaves) {
    items.push({
      id: `leave-${l._id}`,
      kind: "leave",
      ...base(l.employee),
      status: l.status,
      detail: `${l.leaveType.replace(/_/g, " ")} · ${l.days} day${l.days === 1 ? "" : "s"}`,
      time: l.updatedAt,
    });
  }

  for (const c of corrections) {
    items.push({
      id: `corr-${c._id}`,
      kind: "correction",
      ...base(c.employee),
      status: c.status,
      detail: c.type.replace(/_/g, " "),
      time: c.updatedAt,
    });
  }

  for (const la of lates) {
    items.push({
      id: `late-${la._id}`,
      kind: "late",
      ...base(la.employee),
      status: la.status,
      detail: `${la.minutesLate} min late`,
      time: la.updatedAt,
    });
  }

  items.sort((x, y) => new Date(y.time) - new Date(x.time));
  const pending = items.filter((i) => i.status === "pending").length;
  res.json({ success: true, data: items.slice(0, 60), pending });
});

module.exports = { getActivityFeed };
