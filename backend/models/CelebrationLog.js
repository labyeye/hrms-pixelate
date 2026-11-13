const mongoose = require("mongoose");

// One row per wish actually sent: the unique index makes the daily job safe to re-run (once per person, kind and year).
const schema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, required: true },
    ref: { type: String, required: true }, // employee / student id
    kind: {
      type: String,
      // *_app kinds are the in-app + push wishes; separate so they dedupe independently of the WhatsApp ones.
      enum: [
        "birthday",
        "anniversary",
        "birthday_app",
        "anniversary_app",
        "work_anniversary_app",
      ],
      required: true,
    },
    year: { type: Number, required: true },
  },
  { timestamps: true },
);
schema.index({ company: 1, ref: 1, kind: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("CelebrationLog", schema);
