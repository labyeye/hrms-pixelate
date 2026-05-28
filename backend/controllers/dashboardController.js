const asyncHandler = require("express-async-handler");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const Payroll = require("../models/Payroll");
const Recruitment = require("../models/Recruitment");
const Department = require("../models/Department");

const getStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    const [
      totalEmployees,
      activeEmployees,
      newHires,
      pendingLeaves,
      todayPresent,
      openPositions,
      departments,
      monthlyPayroll,
    ] = await Promise.all([
      Employee.countDocuments({ user: req.user._id }).catch(() => 0),
      Employee.countDocuments({ user: req.user._id, status: "active" }).catch(
        () => 0,
      ),
      Employee.countDocuments({
        user: req.user._id,
        joinDate: { $gte: startOfMonth },
      }).catch(() => 0),
      Leave.countDocuments().catch(() => 0),
      Attendance.countDocuments({ date: today, status: "present" }).catch(
        () => 0,
      ),
      Recruitment.countDocuments({ status: "open" }).catch(() => 0),
      Department.countDocuments({ status: "active" }).catch(() => 0),
      Payroll.aggregate([
        {
          $match: {
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            status: "paid",
          },
        },
        { $group: { _id: null, total: { $sum: "$netSalary" } } },
      ]).catch(() => []),
    ]);

    const attendanceRate =
      activeEmployees > 0
        ? Math.round((todayPresent / activeEmployees) * 100)
        : 0;

    const recentHires = await Employee.find({
      user: req.user._id,
      joinDate: { $gte: startOfMonth },
    })
      .populate("department", "name")
      .sort({ joinDate: -1 })
      .limit(5)
      .select("firstName lastName designation department joinDate avatar")
      .catch(() => []);

    const pendingLeaveList = await Leave.find({ status: "pending" })
      .populate({
        path: "employee",
        select: "firstName lastName designation",
        populate: { path: "department", select: "name" },
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .catch(() => []);

    const deptHeadcounts = await Employee.aggregate([
      { $match: { user: req.user._id, status: "active" } },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "departments",
          localField: "_id",
          foreignField: "_id",
          as: "dept",
        },
      },
      { $unwind: { path: "$dept", preserveNullAndEmpty: true } },
      { $project: { name: { $ifNull: ["$dept.name", "No Dept"] }, count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]).catch(() => []);

    res.json({
      success: true,
      data: {
        stats: {
          totalEmployees,
          activeEmployees,
          newHires,
          pendingLeaves,
          todayPresent,
          attendanceRate,
          openPositions,
          departments,
          monthlyPayroll: monthlyPayroll[0]?.total || 0,
        },
        recentHires,
        pendingLeaveList,
        deptHeadcounts,
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      data: {
        stats: {
          totalEmployees: 0,
          activeEmployees: 0,
          newHires: 0,
          pendingLeaves: 0,
          todayPresent: 0,
          attendanceRate: 0,
          openPositions: 0,
          departments: 0,
          monthlyPayroll: 0,
        },
        recentHires: [],
        pendingLeaveList: [],
        deptHeadcounts: [],
      },
    });
  }
});

module.exports = { getStats };
