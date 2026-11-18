const AutoPay = require("../models/AutoPay");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const Counter = require("../models/Counter");
const CreditTopup = require("../models/CreditTopup");
const cashfree = require("./cashfreeService");
const credits = require("./creditsService");
const cfg = require("../config/credits");
const { withGst } = require("../utils/pricing");
const { sendPaymentConfirmations } = require("./notificationService");

// Auto-pay: one Cashfree ON_DEMAND mandate per company, charged by us for (a) the yearly renewal and
// (b) WhatsApp credit auto-refill. Off unless AUTOPAY_ENABLED=true (needs Cashfree Subscriptions enabled on the account).
// ponytail: Cashfree Subscriptions field names are written from the docs and NOT tested against sandbox; verify first.
const enabled = () => process.env.AUTOPAY_ENABLED === "true";
const fail = (m, status = 400) => Object.assign(new Error(m), { status });
const DAY = 24 * 3600 * 1000;

const settingsFrom = (b = {}) => {
  const pack = cfg.PACKS.find((p) => p.id === b.refill?.packId) || cfg.PACKS[0];
  const t = Math.round(Number(b.refill?.thresholdCredits));
  return {
    renew: !!b.renew,
    refill: {
      enabled: !!b.refill?.enabled,
      thresholdCredits: Math.min(5000, Math.max(cfg.LOW_BALANCE_CREDITS, t || 100)),
      packId: pack.id,
    },
  };
};

const view = (a) => ({
  enabled: enabled(),
  maxAmount: cashfree.mandateMax(),
  exists: !!a,
  active: a?.status === "ACTIVE",
  status: a?.status || null,
  renew: !!a?.renew,
  refill: a?.refill || { enabled: false, thresholdCredits: 100, packId: cfg.PACKS[0].id },
});

async function status(companyId) {
  return view(await AutoPay.findOne({ company: companyId }).lean());
}

/** Starts (or re-uses) the mandate and saves the settings. Returns a checkout session when the customer must authorize. */
async function setup(user, body) {
  if (!enabled()) throw fail("Auto-pay is not enabled yet", 503);
  const company = await Company.findById(user.company);
  if (!company) throw fail("Company not found", 404);
  const s = settingsFrom(body);
  if (!s.renew && !s.refill.enabled) throw fail("Choose at least one: plan renewal or WhatsApp refill");
  if (s.refill.enabled && !(await credits.isMetered(company._id)))
    throw fail("WhatsApp credits are not enabled for your company");

  let a = await AutoPay.findOne({ company: company._id });
  if (a?.status === "ACTIVE") {
    a.set(s);
    await a.save();
    return { active: true };
  }
  const subscriptionId = `ap_${company._id}_${Date.now().toString(36)}`;
  const m = await cashfree.createMandate({
    subscriptionId,
    customer: {
      name: user.name || company.name,
      email: user.email || company.email,
      phone: user.phone || company.phone,
    },
  });
  if (a) {
    if (a.status !== "CANCELLED") await cashfree.cancelMandate(a.subscriptionId).catch(() => {});
    a.set({ ...s, subscriptionId, status: "INITIALIZED", user: user._id });
  } else a = new AutoPay({ ...s, company: company._id, user: user._id, subscriptionId });
  await a.save();
  return { active: false, sessionId: m.sessionId, mode: m.mode };
}

async function updateSettings(companyId, body) {
  const a = await AutoPay.findOne({ company: companyId });
  if (!a || a.status === "CANCELLED") throw fail("Set up auto-pay first", 404);
  a.set(settingsFrom(body));
  await a.save();
  return view(a);
}

/** Pull the mandate status from Cashfree (called after the customer comes back from authorization). */
async function sync(companyId) {
  const a = await AutoPay.findOne({ company: companyId });
  if (!a) return view(null);
  if (a.status !== "CANCELLED") {
    const m = await cashfree.getMandate(a.subscriptionId);
    if (m.status && m.status !== a.status) {
      a.status = m.status;
      await a.save();
    }
  }
  return view(a);
}

async function cancel(companyId) {
  const a = await AutoPay.findOne({ company: companyId });
  if (!a) return view(null);
  if (a.status !== "CANCELLED") await cashfree.cancelMandate(a.subscriptionId).catch(() => {});
  a.set({ status: "CANCELLED", renew: false, "refill.enabled": false });
  await a.save();
  return view(a);
}

// ---- WhatsApp auto-refill --------------------------------------------------

/** Called after every credit debit. Charges the customer's chosen pack when their balance drops below their threshold. */
async function maybeRefill(companyId) {
  if (!enabled()) return;
  const a = await AutoPay.findOne({ company: companyId, status: "ACTIVE", "refill.enabled": true }).lean();
  if (!a) return;
  const bal = await credits.getBalance(companyId);
  if (!bal.metered || bal.total >= a.refill.thresholdCredits) return;
  const pack = cfg.PACKS.find((p) => p.id === a.refill.packId);
  if (!pack) return;
  // at most 3 auto-refills per 24h, so a bug or a bad card can never drain money in a loop
  if ((await CreditTopup.countDocuments({ company: companyId, auto: true, createdAt: { $gt: new Date(Date.now() - DAY) } })) >= 3) return;
  // atomic claim: only one worker/process charges at a time
  const lock = await AutoPay.updateOne(
    { _id: a._id, $or: [{ refillLockUntil: null }, { refillLockUntil: { $lt: new Date() } }] },
    { $set: { refillLockUntil: new Date(Date.now() + 2 * 3600 * 1000) } },
  );
  if (!lock.modifiedCount) return;

  const gst = Math.round(pack.price * cfg.GST_PCT) / 100;
  const total = Math.round((pack.price + gst) * 100) / 100;
  const paymentId = `ar_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await CreditTopup.create({
    company: companyId, user: a.user, packId: pack.id, credits: pack.credits,
    price: pack.price, gst, total, orderId: paymentId, auto: true,
  });
  try {
    await cashfree.chargeMandate({ subscriptionId: a.subscriptionId, paymentId, amount: total, note: `WhatsApp credits ${pack.id}` });
  } catch (e) {
    console.error("[AutoPay] refill charge:", e.message);
    await AutoPay.updateOne({ _id: a._id }, { $set: { refillLockUntil: new Date(Date.now() + 6 * 3600 * 1000) } });
  }
}

// ---- yearly renewal (daily job) ---------------------------------------------

async function runRenewals() {
  if (!enabled()) return;
  const now = Date.now();
  for (const a of await AutoPay.find({ status: "ACTIVE", renew: true, renewFails: { $lt: 3 } })) {
    try {
      const sub = await Subscription.findOne({ company: a.company });
      if (!sub || sub.status !== "active" || sub.isTrial || !sub.yearlyPrice) continue;
      const due = new Date(sub.renewalDate).getTime();
      if (due > now + 2 * DAY || new Date(sub.renewalDate).getFullYear() >= 2090) continue;
      if (await Invoice.exists({ subscription: sub._id, status: "pending", createdAt: { $gt: new Date(now - 3 * DAY) } })) continue;
      const amount = withGst(sub.yearlyPrice);
      const paymentId = `ar_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const inv = await Invoice.create({
        company: a.company, subscription: sub._id, invoiceNumber: `PEND-${paymentId}`, // real number on success
        plan: sub.plan, billingCycle: "yearly", amount, status: "pending", razorpayOrderId: paymentId,
      });
      try {
        await cashfree.chargeMandate({ subscriptionId: a.subscriptionId, paymentId, amount, note: `${sub.plan} renewal` });
      } catch (e) {
        await Invoice.updateOne({ _id: inv._id }, { $set: { status: "failed" } });
        await AutoPay.updateOne({ _id: a._id }, { $inc: { renewFails: 1 } });
        throw e;
      }
    } catch (e) {
      console.error("[AutoPay] renewal", String(a.company), e.message);
    }
  }
}

async function finalizeRenewal(inv, cfPaymentId) {
  // atomic pending -> paid flip so a repeated webhook cannot extend twice
  const flipped = await Invoice.findOneAndUpdate(
    { _id: inv._id, status: "pending" },
    { $set: { status: "paid", paidAt: new Date(), razorpayPaymentId: cfPaymentId } },
    { new: true },
  );
  if (!flipped) return;
  const sub = await Subscription.findById(flipped.subscription);
  const company = await Company.findById(flipped.company);
  const renewalDate = new Date(Math.max(Date.now(), new Date(sub.renewalDate).getTime()));
  renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  const seq = await Counter.next("invoice-hrms", () => Invoice.countDocuments());
  flipped.invoiceNumber = `INV-HRMS-${String(seq).padStart(4, "0")}`;
  await flipped.save();
  sub.set({ renewalDate, amountPaid: flipped.amount, paymentStatus: "completed", status: "active" });
  await sub.save();
  await AutoPay.updateOne({ company: company._id }, { $set: { renewFails: 0 } });
  credits.onSubscriptionPaid(company._id, sub).catch((e) => console.error("[Credits]", e.message));
  const user = await User.findById(company.createdBy);
  sendPaymentConfirmations({
    toEmail: user?.email || company.email, toName: user?.name || company.name, toPhone: user?.phone || company.phone || "",
    companyName: company.name, planName: sub.plan, amount: flipped.amount, billingCycle: "yearly", renewalDate,
    dashboardUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/` : "https://hrms.pixelatenest.com/",
    invoiceNumber: flipped.invoiceNumber,
  }).catch((e) => console.error("[Notifications]", e.message));
}

// ---- webhook -----------------------------------------------------------------

/** Cashfree SUBSCRIPTION_* webhook (already signature-checked). We re-ask Cashfree for the truth instead of trusting the body. */
async function onWebhook(ev) {
  const d = ev?.data || {};
  const subscriptionId = d.subscription_id || d.subscription_details?.subscription_id || d.payment_details?.subscription_id;
  const paymentId = d.payment_id || d.payment_details?.payment_id;
  const a = subscriptionId && (await AutoPay.findOne({ subscriptionId }));
  if (!a) return; // another product's subscription on the same Cashfree account
  if (!paymentId) return void (await sync(a.company));

  const p = await cashfree.getMandatePayment(subscriptionId, paymentId);
  if (p.status === "SUCCESS") {
    if (await CreditTopup.exists({ orderId: paymentId })) {
      await credits.completeTopup({ orderId: paymentId, paymentId: p.cfPaymentId || paymentId });
      await AutoPay.updateOne({ _id: a._id }, { $set: { refillLockUntil: null } });
    } else {
      const inv = await Invoice.findOne({ razorpayOrderId: paymentId, status: "pending" });
      if (inv) await finalizeRenewal(inv, p.cfPaymentId || paymentId);
    }
  } else if (p.status === "FAILED" || p.status === "CANCELLED") {
    await Invoice.updateOne({ razorpayOrderId: paymentId, status: "pending" }, { $set: { status: "failed" } });
    if (await Invoice.exists({ razorpayOrderId: paymentId, status: "failed" }))
      await AutoPay.updateOne({ _id: a._id }, { $inc: { renewFails: 1 } });
    else await AutoPay.updateOne({ _id: a._id }, { $set: { refillLockUntil: new Date(Date.now() + 6 * 3600 * 1000) } });
  }
}

module.exports = { enabled, status, setup, updateSettings, sync, cancel, maybeRefill, runRenewals, onWebhook };
