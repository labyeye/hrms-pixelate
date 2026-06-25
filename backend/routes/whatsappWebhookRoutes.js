const express = require("express");
const router = express.Router();
const Employee = require("../models/Employee");
const Payroll = require("../models/Payroll");

const VERIFY_TOKEN = process.env.META_WA_VERIFY_TOKEN || "nesthr_verify_token";

// ── Webhook verification (Meta sends a GET to confirm the endpoint) ─────────
router.get("/", (req, res) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[WA-Webhook] ✅ Verified");
    return res.status(200).send(challenge);
  }
  console.warn("[WA-Webhook] ❌ Verification failed");
  res.sendStatus(403);
});

// ── Incoming message / button reply handler ──────────────────────────────────
router.post("/", express.json(), async (req, res) => {
  // Acknowledge immediately so Meta doesn't retry
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const messages = changes?.messages;
    if (!messages?.length) return;

    for (const msg of messages) {
      // Only handle quick-reply button responses
      if (msg.type !== "button") continue;

      const payload = msg.button?.payload;
      const fromPhone = msg.from; // E.164 without +, e.g. "919876543210"

      console.log(`[WA-Webhook] Button reply from=${fromPhone} payload=${payload}`);

      if (payload !== "PAYSLIP_RECEIVED" && payload !== "PAYSLIP_NOT_RECEIVED") continue;

      const slipStatus = payload === "PAYSLIP_RECEIVED" ? "received" : "not_received";

      // Normalise phone: strip leading 91 for 10-digit match or keep full
      const phoneLast10 = fromPhone.replace(/^91/, "").slice(-10);

      const employee = await Employee.findOne({
        phone: { $in: [fromPhone, phoneLast10, `+${fromPhone}`] },
      }).select("_id company");

      if (!employee) {
        console.warn(`[WA-Webhook] No employee found for phone=${fromPhone}`);
        continue;
      }

      // Find the most recent paid payroll for this employee
      const payroll = await Payroll.findOne({
        employee: employee._id,
        company: employee.company,
        status: "paid",
        slipReceived: null,
      }).sort({ year: -1, month: -1 });

      if (!payroll) {
        console.warn(`[WA-Webhook] No pending payroll for employee=${employee._id}`);
        continue;
      }

      payroll.slipReceived = slipStatus;
      payroll.slipReceivedAt = new Date();
      await payroll.save();

      console.log(`[WA-Webhook] ✅ payroll=${payroll._id} slipReceived=${slipStatus} (via WhatsApp reply from ${fromPhone})`);
    }
  } catch (err) {
    console.error("[WA-Webhook] Error:", err.message);
  }
});

module.exports = router;
