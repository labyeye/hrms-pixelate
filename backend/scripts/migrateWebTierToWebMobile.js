require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Subscription = require("../models/Subscription");
const PendingOrder = require("../models/PendingOrder");
const { calculatePricing } = require("../utils/pricing");

// The "web" tier has been retired — only web_mobile (₹299) and
// web_mobile_whatsapp (₹499) remain. Move any subscription/pending order
// still on "web" to web_mobile and recompute its pricing at the new rate.
async function run() {
  await connectDB();

  const subs = await Subscription.find({ tier: "web" });
  console.log(`Found ${subs.length} subscription(s) on tier "web"`);
  for (const sub of subs) {
    const pricing = calculatePricing(sub.employeeCount, "web_mobile");
    sub.tier = "web_mobile";
    sub.ratePerEmployee = pricing.ratePerEmployee;
    sub.monthlyPrice = pricing.monthlyPrice;
    sub.yearlyPrice = pricing.yearlyPrice;
    await sub.save();
    console.log(`  Migrated subscription ${sub._id} -> web_mobile`);
  }

  const orders = await PendingOrder.find({ tier: "web" });
  console.log(`Found ${orders.length} pending order(s) on tier "web"`);
  for (const order of orders) {
    const pricing = calculatePricing(order.employeeCount, "web_mobile");
    order.tier = "web_mobile";
    order.ratePerEmployee = pricing.ratePerEmployee;
    order.tierLabel = pricing.tierLabel;
    order.monthlyPrice = pricing.monthlyPrice;
    order.yearlyPrice = pricing.yearlyPrice;
    await order.save();
    console.log(`  Migrated pending order ${order._id} -> web_mobile`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
