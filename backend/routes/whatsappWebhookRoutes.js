const express = require("express");
const router = express.Router();

const Employee = require("../models/Employee");
const Payroll = require("../models/Payroll");

const crypto = require("crypto");
const safeEqual = require("../utils/safeEqual");

// No hard-coded fallback: with META_WA_VERIFY_TOKEN unset the subscription handshake simply fails.
const VERIFY_TOKEN = process.env.META_WA_VERIFY_TOKEN;
const APP_SECRET = process.env.META_WA_APP_SECRET;
if (!APP_SECRET) console.warn("[WA-Webhook] META_WA_APP_SECRET is not set: incoming webhooks are NOT signature-verified");

// Meta signs the raw request body with the app secret (X-Hub-Signature-256: sha256=<hmac>).
function validSignature(req) {
  if (!APP_SECRET) return true;
  const sig = String(req.headers["x-hub-signature-256"] || "");
  if (!sig.startsWith("sha256=") || !req.rawBody) return false;
  const a = Buffer.from(sig.slice(7), "hex");
  const b = crypto.createHmac("sha256", APP_SECRET).update(req.rawBody).digest();
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

//
// ─────────────────────────────────────────────────────────────
// Webhook Verification
// ─────────────────────────────────────────────────────────────
//
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && safeEqual(token, VERIFY_TOKEN)) {
    return res.status(200).send(String(challenge ?? ""));
  }

  console.warn("[WA-Webhook] verification failed");
  return res.sendStatus(403);
});

//
// ─────────────────────────────────────────────────────────────
// Incoming Webhook
// ─────────────────────────────────────────────────────────────
//
router.post("/", async (req, res) => {
  if (!validSignature(req)) return res.sendStatus(401);
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const value = entry?.changes?.[0]?.value;

    if (!value) {
      console.log("[WA] No value object");
      return;
    }

    //
    // Status updates (sent, delivered, read)
    //
    if (value.statuses) {
      console.log("[WA] Status Event");
      console.log(JSON.stringify(value.statuses, null, 2));
      // a message Meta could not deliver is not charged
      for (const st of value.statuses) {
        if (st.status === "failed") {
          require("../services/creditsService").refundByWamid(st.id).catch((e) => console.error("[WA] credit refund:", e.message));
        }
      }
    }

    //
    // Incoming messages
    //
    const messages = value.messages;

    if (!messages || !messages.length) {
      console.log("[WA] No incoming messages");
      return;
    }

    for (const msg of messages) {

      const fromPhone = msg.from;

      let payload = null;

      //
      // OLD FORMAT
      //
      if (msg.type === "button") {
        payload = msg.button?.payload;
      }

      //
      // NEW FORMAT
      //
      if (
        msg.type === "interactive" &&
        msg.interactive?.type === "button_reply"
      ) {
        payload = msg.interactive.button_reply.id;
      }

      //
      // Text message
      //
      if (msg.type === "text") {
        console.log("[WA] text message received");
      }

      if (!payload) {
        console.log("[WA] No button payload found.");
        continue;
      }

      console.log(`[WA] Button clicked: ${payload}`);

      if (
        payload !== "PAYSLIP_RECEIVED" &&
        payload !== "PAYSLIP_NOT_RECEIVED"
      ) {
        console.log("[WA] Unknown payload");
        continue;
      }

      const slipStatus =
        payload === "PAYSLIP_RECEIVED" ? "received" : "not_received";

      const phone10 = fromPhone.replace(/^91/, "").slice(-10);

      const employee = await Employee.findOne({
        phone: {
          $in: [
            fromPhone,
            phone10,
            `+${fromPhone}`,
            `91${phone10}`,
            `+91${phone10}`,
          ],
        },
      }).select("_id company phone");

      if (!employee) {
        console.log(`[WA] Employee not found for ${fromPhone}`);
        continue;
      }

      console.log(`[WA] Employee Found ${employee._id}`);

      // Allow updating from "not_received" → "received" (employee clicked wrong button).
      // Only block if already confirmed as "received".
      const payroll = await Payroll.findOne({
        employee: employee._id,
        company: employee.company,
        status: "paid",
        slipReceived: { $in: [null, "not_received"] },
      }).sort({
        year: -1,
        month: -1,
      });

      if (!payroll) {
        console.log(
          "[WA] No updatable payroll found (already confirmed received)",
        );
        continue;
      }

      payroll.slipReceived = slipStatus;
      payroll.slipReceivedAt = new Date();

      await payroll.save();

      console.log(`✅ Payroll Updated (${payroll._id}) -> ${slipStatus}`);
    }
  } catch (err) {
    console.error("[WA-Webhook ERROR]");
    console.error(err);
  }
});

module.exports = router;
