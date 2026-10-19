require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Subscription = require("../models/Subscription");
const { calculatePricing } = require("../utils/pricing");

// Moves every existing subscription onto the flat slab pricing (single
// all-features plan). Dry-run by default; pass --apply to write.
// Slab is picked from the seats the customer already has (maxEmployees /
// employeeCount, whichever is higher). Subscriptions above the last slab are
// skipped — those are "contact sales". amountPaid and renewal dates are
// untouched, so the new price takes effect at the next renewal.
const APPLY = process.argv.includes("--apply");

async function run() {
  await connectDB();
  const subs = await Subscription.find({});
  console.log(`${APPLY ? "APPLY" : "DRY RUN"}: ${subs.length} subscription(s)`);

  if (APPLY) {
    const out = path.resolve(
      __dirname,
      `../backups/pre-slab-pricing-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(subs.map((s) => s.toObject()), null, 2));
    console.log(`Backup -> ${out}`);
  }

  const skipped = [];
  for (const sub of subs) {
    const seats = Math.max(sub.maxEmployees || 0, sub.employeeCount || 0, 1);
    let pricing;
    try {
      pricing = calculatePricing(seats);
    } catch {
      skipped.push(`${sub._id} (${seats} employees)`);
      continue;
    }
    console.log(
      `${sub._id} [${sub.status}] ${seats} emp: ${sub.tier} ₹${sub.yearlyPrice}/yr -> ₹${pricing.yearlyPrice}/yr, max ${pricing.maxEmployees}`,
    );
    if (!APPLY) continue;
    sub.plan = pricing.tierLabel;
    sub.tier = pricing.tier;
    sub.ratePerEmployee = pricing.ratePerEmployee;
    sub.monthlyPrice = pricing.monthlyPrice;
    sub.yearlyPrice = pricing.yearlyPrice;
    sub.maxEmployees = pricing.maxEmployees;
    await sub.save();
  }

  if (skipped.length) {
    console.log(`Skipped (contact sales, >100 employees): ${skipped.join(", ")}`);
  }
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
