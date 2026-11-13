const cron = require("node-cron");
const Employee = require("../models/Employee");
const Company = require("../models/Company");
const CelebrationLog = require("../models/CelebrationLog");
const wa = require("../services/whatsappService");
const {
  notifyEmployee,
  notifyApprovers,
} = require("../services/inAppNotificationService");

// Daily 09:00 IST: in-app/push wishes (birthday, wedding + work anniversary) always, and WhatsApp
// birthday + wedding-anniversary wishes to employees when templates are configured.
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
  await runInApp(month, day, year);
}

// Free in-app inbox + push wishes (no WhatsApp template/credits). Each employee gets a personal wish;
// admin/HR get one digest per company so they can congratulate in person.
const APP_KINDS = [
  {
    kind: "birthday_app",
    field: "dateOfBirth",
    label: "birthday",
    title: (n) => `Happy Birthday, ${n}! 🎂`,
    body: (co) => `Wishing you a wonderful year ahead from everyone at ${co}.`,
  },
  {
    kind: "anniversary_app",
    field: "marriageAnniversary",
    label: "wedding anniversary",
    title: (n) => `Happy Anniversary, ${n}! 💐`,
    body: (co) => `Wishing you and your family happiness always — team ${co}.`,
  },
  {
    kind: "work_anniversary_app",
    field: "joinDate",
    label: "work anniversary",
    title: (n) => `Happy Work Anniversary, ${n}! 🎉`,
    body: (co, yrs) =>
      `${yrs} year${yrs === 1 ? "" : "s"} with ${co} today. Thank you for being part of the team!`,
  },
];

async function runInApp(month, day, year) {
  const coNames = {};
  const digest = {}; // company -> ["Asha Rao (birthday)", ...]
  for (const k of APP_KINDS) {
    const emps = await Employee.find({
      status: "active",
      [k.field]: { $ne: null },
      $expr: {
        $and: [
          { $eq: [{ $month: `$${k.field}` }, month] },
          { $eq: [{ $dayOfMonth: `$${k.field}` }, day] },
        ],
      },
    })
      .select(`company user firstName lastName ${k.field}`)
      .lean();
    for (const e of emps) {
      // Work anniversary starts from the 1st year (not on the joining day itself).
      const years =
        k.field === "joinDate" ? year - new Date(e.joinDate).getUTCFullYear() : 0;
      if (k.field === "joinDate" && years < 1) continue;
      const key = { company: e.company, ref: String(e._id), kind: k.kind, year };
      try {
        await CelebrationLog.create(key); // throws 11000 if already sent
      } catch (err) {
        if (err.code === 11000) continue;
        throw err;
      }
      try {
        coNames[e.company] ??=
          (await Company.findById(e.company).select("name").lean())?.name || "us";
        notifyEmployee(e, {
          company: e.company,
          type: "celebration",
          title: k.title(e.firstName || "there"),
          body: k.body(coNames[e.company], years),
        });
        (digest[e.company] ??= []).push(
          `${`${e.firstName} ${e.lastName || ""}`.trim()} (${k.label}${years ? `, ${years}y` : ""})`,
        );
      } catch (err) {
        console.error(`[Celebrations] ${k.kind} ${e._id}:`, err.message);
      }
    }
  }
  for (const [company, list] of Object.entries(digest)) {
    notifyApprovers(company, {
      type: "celebration",
      title: `Today's celebrations (${list.length}) 🎈`,
      body: list.slice(0, 10).join(", ") + (list.length > 10 ? "…" : ""),
    });
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
