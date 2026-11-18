const cron = require("node-cron");
const { runRenewals } = require("../services/autopayService");

// Daily 10:00 IST: charge the auto-pay mandate for plans renewing within 2 days.
function startAutopayRenewalsJob() {
  cron.schedule(
    "30 4 * * *",
    () => runRenewals().catch((e) => console.error("[AutoPay]", e.message)),
    { timezone: "UTC" },
  );
}

module.exports = { startAutopayRenewalsJob };
