const Setting = require("../models/Setting");
const Employee = require("../models/Employee");

/**
 * Returns the effective checkout time, capped at shift end when OT is disabled.
 * If otEnabled=false and employee has a shift, any punch-out after shift end
 * is treated as a punch-out exactly at shift end.
 */
async function getEffectiveCheckOut(companyId, employeeId, punchTime) {
  if (!companyId) return punchTime;

  const settings = await Setting.findOne({ company: companyId }).select(
    "otEnabled",
  );
  if (settings?.otEnabled !== false) return punchTime;

  const emp = await Employee.findById(employeeId).populate("shift", "endTime");
  const shift = emp?.shift;
  if (!shift?.endTime) return punchTime;

  const parts = shift.endTime.split(":");
  const endHour = parseInt(parts[0], 10);
  const endMin = parseInt(parts[1] || "0", 10);

  const shiftEnd = new Date(punchTime);
  shiftEnd.setHours(endHour, endMin, 0, 0);

  return punchTime > shiftEnd ? shiftEnd : punchTime;
}

module.exports = { getEffectiveCheckOut };
