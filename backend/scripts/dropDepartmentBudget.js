// One-off: removes the retired `budget` field from every Department document. Safe to re-run.
require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const r = await mongoose.connection
    .collection("departments")
    .updateMany({}, { $unset: { budget: "" } });
  console.log(`Unset budget on ${r.modifiedCount} departments`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
