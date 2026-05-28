require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Plan = require("../models/Plan");

connectDB();

const seedPlans = async () => {
  try {
    // Clear existing plans
    await Plan.deleteMany({});

    const plans = [
      {
        name: "Starter",
        planType: "starter",
        monthlyPrice: 50,
        yearlyPrice: 500, // 16.67% discount (₹6 per month)
        maxEmployees: 10,
        features: [
          "Up to 10 employees",
          "Basic HR Management",
          "Attendance Tracking",
          "Leave Management",
          "Email Support",
          "Monthly Reporting",
        ],
        description: "Perfect for small teams",
        active: true,
      },
      {
        name: "Professional",
        planType: "professional",
        monthlyPrice: 100,
        yearlyPrice: 1000, // 16.67% discount (₹16.67 per month)
        maxEmployees: 20,
        features: [
          "Up to 20 employees",
          "Advanced HR Management",
          "Attendance Tracking",
          "Leave Management",
          "Payroll Processing",
          "Performance Management",
          "Priority Email & Chat Support",
          "Weekly Reporting",
        ],
        description: "For growing businesses",
        active: true,
      },
      {
        name: "Enterprise",
        planType: "enterprise",
        monthlyPrice: 200,
        yearlyPrice: 2000, // 16.67% discount (₹33.33 per month)
        maxEmployees: 999999, // Unlimited
        features: [
          "Unlimited employees",
          "Full HR Management Suite",
          "Advanced Analytics",
          "Custom Integrations",
          "Dedicated Account Manager",
          "24/7 Phone Support",
          "Real-time Reporting",
          "Custom Features",
          "API Access",
        ],
        description: "For large enterprises",
        active: true,
      },
    ];

    const createdPlans = await Plan.insertMany(plans);
    console.log("✅ Plans seeded successfully:", createdPlans);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding plans:", error.message);
    process.exit(1);
  }
};

seedPlans();
