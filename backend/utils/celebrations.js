const Employee = require("../models/Employee");

const nameOf = (e) => `${e.firstName || ""} ${e.lastName || ""}`.trim() || "Employee";

// Today's (IST) birthdays and wedding anniversaries for a company, as bell-feed items. Computed on the fly, nothing stored.
async function celebrationsToday(company) {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  const y = ist.getUTCFullYear();
  const on = (dt) => dt && new Date(dt).getUTCMonth() === m && new Date(dt).getUTCDate() === d;
  const emps = await Employee.find({ company, status: "active" })
    .select("firstName lastName avatar dateOfBirth marriageAnniversary")
    .lean();
  const out = [];
  for (const e of emps) {
    const base = { name: nameOf(e), avatar: e.avatar, time: new Date() };
    if (on(e.dateOfBirth)) out.push({ ...base, id: `bday-${e._id}`, kind: "birthday", detail: "Birthday today" });
    const yrs = e.marriageAnniversary ? y - new Date(e.marriageAnniversary).getUTCFullYear() : 0;
    if (on(e.marriageAnniversary))
      out.push({ ...base, id: `anniv-${e._id}`, kind: "anniversary", detail: yrs >= 1 ? `Wedding anniversary · ${yrs} year${yrs === 1 ? "" : "s"}` : "Wedding anniversary" });
  }
  return out;
}

module.exports = { celebrationsToday };
