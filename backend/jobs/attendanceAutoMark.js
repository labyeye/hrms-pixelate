const cron = require("node-cron");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const Shift = require("../models/Shift");
const { isHolidayDate } = require("../controllers/holidayController");

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function nowIST() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function todayISTMidnight() {
  const ist = nowIST();
  return new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()),
  );
}

// Returns shift end time as total minutes from midnight
function shiftEndMinutes(shift) {
  const [h, m] = shift.endTime.split(":").map(Number);
  return h * 60 + m;
}

// Returns shift start time as total minutes from midnight
function shiftStartMinutes(shift) {
  const [h, m] = shift.startTime.split(":").map(Number);
  return h * 60 + m;
}

async function runAutoMark() {
  console.log("[AutoMark] Running attendance auto-mark job...");

  const istNow = nowIST();
  const istMinutes = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();
  const todayDate = todayISTMidnight();

  // Get all active employees that have a shift assigned
  const employees = await Employee.find({
    shift: { $exists: true, $ne: null },
    status: { $in: ["active", undefined, null] },
  })
    .select("_id company shift")
    .lean();

  if (!employees.length) return;

  // Load all unique shifts
  const shiftIds = [
    ...new Set(employees.map((e) => e.shift?.toString()).filter(Boolean)),
  ];
  const shifts = await Shift.find({ _id: { $in: shiftIds } }).lean();
  const shiftMap = Object.fromEntries(shifts.map((s) => [s._id.toString(), s]));

  // Group employees by company to check holidays per company
  const byCompany = {};
  for (const emp of employees) {
    const cid = emp.company?.toString();
    if (!cid) continue;
    if (!byCompany[cid]) byCompany[cid] = [];
    byCompany[cid].push(emp);
  }

  for (const [companyId, companyEmps] of Object.entries(byCompany)) {
    const isHoliday = await isHolidayDate(companyId, todayDate);
    if (isHoliday) continue; // Don't auto-mark on holidays

    for (const emp of companyEmps) {
      const shift = shiftMap[emp.shift?.toString()];
      if (!shift) continue;

      const endMins = shiftEndMinutes(shift);
      const startMins = shiftStartMinutes(shift);

      // Only run auto-mark after shift end time has passed (at least 1 hour after shift end)
      const cutoffMins = endMins + 60;
      if (istMinutes < cutoffMins) continue;

      // Also enforce: must be at least 1 hour after shift START before marking absent
      // (gives them until shiftStart+60 to punch in and get "late" instead of absent)
      if (istMinutes < startMins + 60) continue;

      const existing = await Attendance.findOne({
        employee: emp._id,
        date: todayDate,
      });

      if (!existing) {
        // No record at all → absent
        await Attendance.create({
          employee: emp._id,
          date: todayDate,
          status: "absent",
          workHours: 0,
          verifyMode: "auto",
          notes: "Auto-marked absent: no check-in recorded",
        });
        console.log(`[AutoMark] Marked absent: ${emp._id}`);
      } else if (existing.checkIn && !existing.checkOut) {
        // Checked in but never checked out → half day
        if (["present", "late"].includes(existing.status)) {
          existing.status = "half_day";
          existing.notes =
            (existing.notes ? existing.notes + " | " : "") +
            "Auto-marked half day: no check-out recorded";
          await existing.save();
          console.log(`[AutoMark] Marked half_day: ${emp._id}`);
        }
      }
      // If already absent/leave/holiday/half_day → skip
    }
  }

  console.log("[AutoMark] Done.");
}

function startAttendanceAutoMarkJob() {
  // Run at 11:30 PM IST every day
  // IST 23:30 = UTC 18:00 (UTC+5:30)
  cron.schedule("0 18 * * *", runAutoMark, { timezone: "UTC" });
  console.log(
    "[AutoMark] Scheduled attendance auto-mark job at 23:30 IST daily",
  );
}

module.exports = { startAttendanceAutoMarkJob, runAutoMark };
