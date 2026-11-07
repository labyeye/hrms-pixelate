const cron = require("node-cron");
const Employee = require("../models/Employee");
const Company = require("../models/Company");
const CelebrationLog = require("../models/CelebrationLog");
const wa = require("../services/whatsappService");

// Daily 09:00 IST: WhatsApp birthday + wedding-anniversary wishes to employees.
// Needs WHATSAPP_BIRTHDAY_TEMPLATE / WHATSAPP_ANNIVERSARY_TEMPLATE in .env (kind skipped when unset);
// per-company gate + credits are handled inside wa.sendCelebration.
async function run(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const month = ist.getUTCMonth() + 1;
  const day = ist.getUTCDate();
  const year = ist.getUTCFullYear();
  const names = {};
  for (const [kind, field] of [
    ["birthday", "dateOfBirth"],
    ["anniversary", "marriageAnniversary"],
  ]) {
    const emps = await Employee.find({
      status: "active",
      phone: { $exists: true, $ne: "" },
      [field]: { $ne: null },
      $expr: {
        $and: [
          { $eq: [{ $month: `$${field}` }, month] },
          { $eq: [{ $dayOfMonth: `$${field}` }, day] },
        ],
      },
    })
      .select("company firstName phone")
      .lean();
    for (const e of emps) {
      const key = { company: e.company, ref: String(e._id), kind, year };
      try {
        await CelebrationLog.create(key); // throws 11000 if already sent
      } catch (err) {
        if (err.code === 11000) continue;
        throw err;
      }
      try {
        names[e.company] ??=
          (await Company.findById(e.company).select("name").lean())?.name ||
          "us";
        const sent = await wa.sendCelebration(
          kind,
          e.phone,
          [e.firstName || "there", names[e.company]],
          e.company,
        );
        if (!sent) await CelebrationLog.deleteOne(key); // not sent (gate/credits/no template): allow a retry
      } catch (err) {
        console.error(`[Celebrations] ${kind} ${e._id}:`, err.message);
      }
    }
  }
}

function startCelebrationWishesJob() {
  // 03:30 UTC = 09:00 IST
  cron.schedule(
    "30 3 * * *",
    () => run().catch((e) => console.error("[Celebrations]", e.message)),
    { timezone: "UTC" },
  );
}

module.exports = { startCelebrationWishesJob, run };
