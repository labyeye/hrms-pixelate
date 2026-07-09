require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Employee = require("../models/Employee");

async function run() {
  await connectDB();

  const employees = await Employee.find({
    $or: [{ salaryHistory: { $exists: false } }, { salaryHistory: { $size: 0 } }],
  });

  console.log(`Backfilling salary history for ${employees.length} employee(s)...`);

  let updated = 0;
  for (const emp of employees) {
    emp.salaryHistory = [
      {
        amount: emp.salary || 0,
        effectiveFrom: emp.joinDate || emp.createdAt || new Date(),
      },
    ];
    await emp.save();
    updated++;
  }

  console.log(`Done. Updated ${updated} employee(s).`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Backfill failed:", err.message);
  process.exit(1);
});
