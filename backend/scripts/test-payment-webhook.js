// node scripts/test-payment-webhook.js  (in-memory MongoDB: a paid-but-unverified NEW signup is created from the webhook, or undone + refunded)
// needs mongodb-memory-server (NODE_PATH can point at another backend's node_modules)
process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "x";
const assert = require("assert");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const User = require("../models/User");
  const Company = require("../models/Company");
  const Subscription = require("../models/Subscription");
  const Invoice = require("../models/Invoice");
  const PendingOrder = require("../models/PendingOrder");
  const PaymentEvent = require("../models/PaymentEvent");
  const PaymentIncident = require("../models/PaymentIncident");
  const saga = require("../utils/paymentSaga");
  const { webhook, reconcile } = require("../utils/paymentReconcile");
  const refunds = [];
  saga._setClient({ payments: { fetch: async () => ({}), refund: async (id, b) => (refunds.push([id, b.amount]), { id: "rfnd_1" }) } });

  const order = async (n) => {
    const user = await User.create({ name: "Owner " + n, email: `o${n}@x.test`, password: "Qx7#kLm29!", role: "super_admin" });
    await PendingOrder.create({ orderId: "order_" + n, gateway: "razorpay", user: user._id, companyName: "Co " + n, companyEmail: `co${n}@x.test`, companyPhone: "9999999999", employeeCount: 10, billingCycle: "monthly", tier: "web_mobile", ratePerEmployee: 50, tierLabel: "Starter", monthlyPrice: 500, yearlyPrice: 5000 });
    return user;
  };
  const send = (payload) => {
    const raw = Buffer.from(JSON.stringify(payload));
    const sig = crypto.createHmac("sha256", "whsec_test").update(raw).digest("hex");
    return new Promise((resolve) => webhook({ body: raw, get: () => sig }, { status() { return this; }, json: resolve }));
  };
  const ev = (pid, oid) => ({ event: "payment.captured", payload: { payment: { entity: { id: pid, order_id: oid, amount: 50000 } } } });

  await order(1);
  await order(2);
  await send(ev("pay_1", "order_1"));
  await send(ev("pay_2", "order_2"));
  assert.strictEqual(await PaymentEvent.countDocuments(), 2);

  // order 2 fails while writing the invoice, after the company + subscription were already created
  const realCreate = Invoice.create.bind(Invoice);
  Invoice.create = (doc, ...r) => (doc && doc.razorpayPaymentId === "pay_2" ? Promise.reject(new Error("db went away")) : realCreate(doc, ...r));

  await PaymentEvent.updateMany({}, { $set: { receivedAt: new Date(Date.now() - 10 * 60 * 1000) } });
  await reconcile();

  assert.strictEqual(await Company.countDocuments({ email: "co1@x.test" }), 1, "order 1: company created from the webhook");
  assert.strictEqual(await Invoice.countDocuments({ razorpayPaymentId: "pay_1" }), 1);
  assert.strictEqual((await PaymentEvent.findOne({ paymentId: "pay_1" })).note, "activated from webhook");
  assert.strictEqual(await PendingOrder.countDocuments({ orderId: "order_1" }), 0);

  assert.strictEqual(await Company.countDocuments({ email: "co2@x.test" }), 0, "order 2: everything was undone");
  assert.strictEqual(await Subscription.countDocuments({ razorpayPaymentId: "pay_2" }), 0);
  assert.deepStrictEqual(refunds, [["pay_2", 50000]]);
  assert.strictEqual((await PaymentIncident.findOne({ paymentId: "pay_2" })).status, "refund_initiated");

  await reconcile(); // idempotent
  assert.strictEqual(refunds.length, 1);
  assert.strictEqual(await Company.countDocuments({ email: "co1@x.test" }), 1);
  console.log("payment webhook OK");
  await mongoose.disconnect();
  await mongod.stop();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
