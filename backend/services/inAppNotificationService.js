const Notification = require("../models/Notification");
const User = require("../models/User");
const Employee = require("../models/Employee");
const { notifyUsers } = require("./pushNotificationService");

/**
 * Saves an inbox row for each user and sends a push (web + native) on top.
 * Fire-and-forget: never throws and never needs awaiting, so it can't slow down or fail a request.
 * payload: { company, type, title, body, data? }
 */
function notify(userIds, payload) {
  (async () => {
    const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
    if (!ids.length || !payload?.company) return;
    const { company, type, title, body = "", data = {} } = payload;
    await Notification.insertMany(
      ids.map((user) => ({ user, company, type, title, body, data })),
      { ordered: false },
    );
    await notifyUsers(ids, { title, body, tag: type, data: { type, ...data } });
  })().catch((e) => console.error("[notify] failed:", e.message));
}

/** Notify the user account behind an Employee (document or id). */
function notifyEmployee(employee, payload) {
  (async () => {
    const usable =
      employee && employee.user !== undefined && (employee.company || payload?.company);
    const emp = usable
      ? employee
      : await Employee.findById(employee?._id || employee).select("user company");
    const userId = emp?.user?._id || emp?.user;
    if (!userId) return;
    notify([userId], { company: emp.company, ...payload });
  })().catch((e) => console.error("[notify] failed:", e.message));
}

/** Notify everyone who can approve things in a company (admin + HR), minus whoever caused the event. */
function notifyApprovers(company, payload, exceptUserId) {
  (async () => {
    const users = await User.find({
      company,
      role: { $in: ["super_admin", "hr_manager"] },
      status: { $ne: "inactive" },
    }).select("_id");
    notify(
      users.map((u) => u._id).filter((id) => String(id) !== String(exceptUserId || "")),
      { company, ...payload },
    );
  })().catch((e) => console.error("[notify] failed:", e.message));
}

module.exports = { notify, notifyEmployee, notifyApprovers };
