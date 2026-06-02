const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  getDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  regenerateDeviceToken,
  assignNfcCard,
  removeNfcCard,
  registerDevice,
  getDeviceInfo,
  recordBiometric,
  getLogs,
} = require("../controllers/biometricController");

// Public device endpoints (no user auth — device token / activation code used instead)
router.post("/register", registerDevice);
router.get("/device/:token", getDeviceInfo);
router.post("/record", recordBiometric);

// Admin endpoints
router.use(protect);

router.get("/locations", getLocations);
router.post(
  "/locations",
  authorize("super_admin", "hr_manager"),
  createLocation,
);
router.put(
  "/locations/:id",
  authorize("super_admin", "hr_manager"),
  updateLocation,
);
router.delete(
  "/locations/:id",
  authorize("super_admin", "hr_manager"),
  deleteLocation,
);

router.get("/devices", getDevices);
router.post("/devices", authorize("super_admin", "hr_manager"), createDevice);
router.put(
  "/devices/:id",
  authorize("super_admin", "hr_manager"),
  updateDevice,
);
router.delete(
  "/devices/:id",
  authorize("super_admin", "hr_manager"),
  deleteDevice,
);
router.post(
  "/devices/:id/regenerate-token",
  authorize("super_admin", "hr_manager"),
  regenerateDeviceToken,
);

router.post(
  "/devices/:id/nfc",
  authorize("super_admin", "hr_manager"),
  assignNfcCard,
);
router.delete(
  "/devices/:id/nfc/:uid",
  authorize("super_admin", "hr_manager"),
  removeNfcCard,
);

router.get("/logs", getLogs);

module.exports = router;
