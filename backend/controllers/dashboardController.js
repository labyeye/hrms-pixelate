const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
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
    const companyId = new mongoose.Types.ObjectId(req.user.company);
    const companyEmployeeIds = await Employee.find({ company: companyId })
      .select("_id")
      .lean()
      .then((docs) => docs.map((d) => d._id));

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
      Employee.countDocuments({ company: companyId }).catch(() => 0),
      Employee.countDocuments({ company: companyId, status: "active" }).catch(
        () => 0,
      ),
      Employee.countDocuments({
        company: companyId,
        joinDate: { $gte: startOfMonth },
      }).catch(() => 0),
      Leave.countDocuments({ company: companyId, status: "pending" }).catch(
        () => 0,
      ),
      Attendance.countDocuments({
        employee: { $in: companyEmployeeIds },
        date: today,
        status: "present",
      }).catch(() => 0),
      Recruitment.countDocuments({ company: companyId, status: "open" }).catch(
        () => 0,
      ),
      Department.countDocuments({ company: companyId }).catch(() => 0),
      Payroll.aggregate([
        {
          $match: {
            company: companyId,
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
      company: companyId,
      joinDate: { $gte: startOfMonth },
    })
      .populate("department", "name")
      .sort({ joinDate: -1 })
      .limit(5)
      .select("firstName lastName designation department joinDate avatar")
      .catch(() => []);

    const pendingLeaveList = await Leave.find({
      company: companyId,
      status: "pending",
    })
      .populate({
        path: "employee",
        select: "firstName lastName designation",
        populate: { path: "department", select: "name" },
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .catch(() => []);

    const deptHeadcounts = await Employee.aggregate([
      { $match: { company: companyId, status: "active" } },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "departments",
          localField: "_id",
          foreignField: "_id",
          as: "dept",
        },
      },
      { $unwind: { path: "$dept", preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ["$dept.name", "No Dept"] }, count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]).catch(() => []);

    const attTrend = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return Attendance.countDocuments({
          employee: { $in: companyEmployeeIds },
          date: { $gte: start, $lte: end },
          status: { $in: ["present", "late"] },
        }).then((count) => ({
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          count,
        }));
      }),
    );

    const payTrend = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return Payroll.aggregate([
          {
            $match: {
              company: req.user.company,
              month: d.getMonth() + 1,
              year: d.getFullYear(),
            },
          },
          { $group: { _id: null, total: { $sum: "$netSalary" } } },
        ]).then((r) => ({
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          total: r[0]?.total || 0,
        }));
      }),
    );

    const [todayLate, todayAbsent, todayOnLeave] = await Promise.all([
      Attendance.countDocuments({
        employee: { $in: companyEmployeeIds },
        date: today,
        status: "late",
      }).catch(() => 0),
      Attendance.countDocuments({
        employee: { $in: companyEmployeeIds },
        date: today,
        status: "absent",
      }).catch(() => 0),
      Attendance.countDocuments({
        employee: { $in: companyEmployeeIds },
        date: today,
        status: "on_leave",
      }).catch(() => 0),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalEmployees,
          activeEmployees,
          newHires,
          pendingLeaves,
          todayPresent,
          todayLate,
          todayAbsent,
          todayOnLeave,
          attendanceRate,
          openPositions,
          departments,
          monthlyPayroll: monthlyPayroll[0]?.total || 0,
        },
        recentHires,
        pendingLeaveList,
        deptHeadcounts,
        attTrend,
        payTrend,
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
