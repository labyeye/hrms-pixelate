require("dotenv").config();
const mongoose = require("mongoose");
const Plan = require("./models/Plan");

const PLANS = [
  {
    name: "Starter",
    planType: "starter",
    monthlyPrice: 1499,
    yearlyPrice: 14990,
    maxEmployees: 10,
    description: "Perfect for small businesses",
    features: [
      "Up to 10 employees",
      "Attendance & leave",
      "Basic payroll",
      "Email support",
    ],
    active: true,
  },
  {
    name: "Professional",
    planType: "professional",
    monthlyPrice: 3499,
    yearlyPrice: 34990,
    maxEmployees: 50,
    description: "For growing HR teams",
    features: [
      "Up to 50 employees",
      "Full payroll",
      "Biometric attendance",
      "WhatsApp notifications",
      "Priority support",
    ],
    active: true,
  },
  {
    name: "Enterprise",
    planType: "enterprise",
    monthlyPrice: 7999,
    yearlyPrice: 79990,
    maxEmployees: 999,
    description: "Unlimited scale",
    features: [
      "Unlimited employees",
      "All Professional features",
      "Dedicated manager",
      "SLA guarantee",
    ],
    active: true,
  },
];

async function seedPlans() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✔  Connected to MongoDB");

  const existing = await Plan.countDocuments();
  if (existing > 0) {
    console.log(`⚠  Plans already exist (${existing} found). Replacing...`);
    await Plan.deleteMany({});
  }

  await Plan.insertMany(PLANS);
  console.log("✔  3 plans inserted: Starter, Professional, Enterprise");

  await mongoose.disconnect();
  console.log("✔  Done. You can now retry payment.");
}

seedPlans().catch((err) => {
  console.error("✗ Error:", err.message);
  process.exit(1);
});
