const crypto = require("crypto");

// Cashfree Payments (PG) - orders, server-side payment verification, refunds, webhook signature.
// Env: CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV=production|sandbox (default production), BACKEND_URL.
const API_VERSION = "2023-08-01";

const isSandbox = () => process.env.CASHFREE_ENV === "sandbox";
const baseUrl = () =>
  isSandbox() ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";

function creds() {
  const id = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!id || !secret)
    throw new Error(
      "Cashfree credentials not configured. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY in .env",
    );
  return { id, secret };
}

async function cf(method, path, body, version = API_VERSION) {
  const { id, secret } = creds();
  const r = await fetch(baseUrl() + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-version": version,
      "x-client-id": id,
      "x-client-secret": secret,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(data.message || `Cashfree ${r.status}`);
    e.code = data.code;
    e.status = r.status;
    throw e;
  }
  return data;
}

const backendUrl = () =>
  (process.env.BACKEND_URL || "https://hrms-backend.pixelatenest.com").replace(/\/$/, "");

/**
 * Create a Cashfree order. `customer` = { id, name, email, phone }. Returns what the checkout needs.
 * Cashfree wants a 10-digit phone, so anything else falls back to a placeholder (the customer still pays normally).
 */
async function createOrder({ amount, receipt, notes = {}, customer = {} }) {
  const orderId = receipt || `cf_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  const phone = String(customer.phone || "").replace(/\D/g, "").slice(-10);
  const order = await cf("POST", "/orders", {
    order_id: orderId,
    order_amount: Math.round(amount * 100) / 100,
    order_currency: "INR",
    customer_details: {
      customer_id: String(customer.id || "guest").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50) || "guest",
      customer_name: customer.name || undefined,
      customer_email: customer.email || undefined,
      customer_phone: phone.length === 10 ? phone : "9999999999",
    },
    order_meta: {
      return_url: `${backendUrl()}/api/billing/cashfree-return?order_id={order_id}`,
      notify_url: `${backendUrl()}/api/webhooks/cashfree-billing`,
    },
    order_tags: Object.fromEntries(
      Object.entries(notes).map(([k, v]) => [k, String(v).slice(0, 255)]),
    ),
  });
  return {
    orderId: order.order_id,
    paymentSessionId: order.payment_session_id,
    mode: isSandbox() ? "sandbox" : "production",
    checkoutUrl: `${backendUrl()}/api/billing/cashfree-checkout?session=${encodeURIComponent(order.payment_session_id)}&mode=${isSandbox() ? "sandbox" : "production"}`,
    amount,
    currency: "INR",
  };
}

/**
 * Ask Cashfree whether an order is really paid (replaces the old client-side signature check, so the client
 * cannot fake it). Returns { paid, paymentId, amount }.
 */
async function verifyOrder(orderId) {
  const payments = await cf("GET", `/orders/${encodeURIComponent(orderId)}/payments`);
  const ok = (Array.isArray(payments) ? payments : []).find(
    (p) => p.payment_status === "SUCCESS",
  );
  return ok
    ? { paid: true, paymentId: String(ok.cf_payment_id), amount: Number(ok.payment_amount) }
    : { paid: false };
}

async function refund({ orderId, amount, refundId, note }) {
  return cf("POST", `/orders/${encodeURIComponent(orderId)}/refunds`, {
    refund_amount: amount,
    refund_id: refundId,
    refund_note: note,
  });
}

/** Webhook signature: base64(HMAC-SHA256(timestamp + rawBody, secret key)). */
function verifyWebhook(rawBody, signature, timestamp) {
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!secret || !signature || !timestamp) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(String(timestamp) + rawBody.toString("utf8"))
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- Subscriptions / AutoPay mandate (ON_DEMAND plan: we decide when and how much to charge) -------------
// ponytail: written from Cashfree's Subscriptions docs, never run against sandbox. Check field names there first.
const SUBS_VERSION = "2025-01-01";
const PLAN_ID = "nesthr_on_demand";
const mandateMax = () => Number(process.env.AUTOPAY_MAX_AMOUNT) || 50000;

async function ensurePlan() {
  try {
    await cf("POST", "/plans", {
      plan_id: PLAN_ID, plan_name: "NestHR auto-pay", plan_type: "ON_DEMAND",
      plan_currency: "INR", plan_max_amount: mandateMax(), plan_note: "NestHR renewal and WhatsApp credit refill",
    }, SUBS_VERSION);
  } catch (e) {
    if (!(e.status === 409 || /exist|duplicate/i.test(e.message))) throw e;
  }
}

async function createMandate({ subscriptionId, customer }) {
  await ensurePlan();
  const phone = String(customer.phone || "").replace(/\D/g, "").slice(-10);
  const r = await cf("POST", "/subscriptions", {
    subscription_id: subscriptionId,
    customer_details: {
      customer_name: customer.name, customer_email: customer.email,
      customer_phone: phone.length === 10 ? phone : "9999999999",
    },
    plan_details: { plan_id: PLAN_ID },
    authorization_details: { authorization_amount: 1, authorization_amount_refund: true, payment_methods: ["upi", "enach"] },
    subscription_meta: { return_url: `${backendUrl()}/api/billing/cashfree-return?order_id=autopay` },
    subscription_expiry_time: new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString(),
  }, SUBS_VERSION);
  return { sessionId: r.subscription_session_id, mode: isSandbox() ? "sandbox" : "production" };
}

const getMandate = async (subscriptionId) => {
  const r = await cf("GET", `/subscriptions/${encodeURIComponent(subscriptionId)}`, undefined, SUBS_VERSION);
  return { status: r.subscription_status };
};

async function chargeMandate({ subscriptionId, paymentId, amount, note }) {
  return cf("POST", "/subscriptions/pay", {
    subscription_id: subscriptionId, payment_id: paymentId, payment_type: "CHARGE",
    payment_amount: Math.round(amount * 100) / 100, payment_remarks: String(note || "").slice(0, 40) || undefined,
  }, SUBS_VERSION);
}

async function getMandatePayment(subscriptionId, paymentId) {
  const r = await cf("GET", `/subscriptions/${encodeURIComponent(subscriptionId)}/payments/${encodeURIComponent(paymentId)}`, undefined, SUBS_VERSION);
  const p = Array.isArray(r) ? r[0] : r;
  return { status: p?.payment_status, cfPaymentId: p?.cf_payment_id ? String(p.cf_payment_id) : undefined };
}

const cancelMandate = (subscriptionId) =>
  cf("POST", `/subscriptions/${encodeURIComponent(subscriptionId)}/manage`, { subscription_id: subscriptionId, action: "CANCEL" }, SUBS_VERSION);

module.exports = {
  createOrder, verifyOrder, refund, verifyWebhook,
  mandateMax, createMandate, getMandate, chargeMandate, getMandatePayment, cancelMandate,
};
