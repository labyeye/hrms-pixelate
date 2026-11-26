const mongoose = require("mongoose");

const locationPingSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number },
    speed: { type: Number }, // speed in m/s if available
    battery: { type: Number }, // battery percentage (0-100)
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const locationLogSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    date: {
      type: String, // "YYYY-MM-DD"
      required: true,
      index: true,
    },
    // Array of recorded breadcrumb coordinates throughout the duty shift
    pings: [locationPingSchema],
    // Cached latest location for fast dashboard rendering
    lastLocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      speed: Number,
      battery: Number,
      updatedAt: Date,
    },
    // Total estimated distance traveled in kilometers today
    totalDistanceKm: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// One document per employee per day
locationLogSchema.index({ company: 1, employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("LocationLog", locationLogSchema);

