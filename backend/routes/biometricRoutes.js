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
  setDeviceSerial,
  syncEmployeeToDevice,
  syncAllToDevice,
  removeEmployeeFromDevice,
  getDeviceCommands,
  saveRfidCard,
  saveFaceDescriptor,
  getFaceDescriptors,
  faceAttendance,
  triggerFingerprintEnroll,
  getDeviceEmployees,
  enrollFaceFromDevice,
  triggerFaceEnroll,
  pushFaceTemplateToDevice,
} = require("../controllers/biometricController");

router.post("/register", registerDevice);
router.get("/device/:token", getDeviceInfo);
router.post("/record", recordBiometric);
router.get("/device/:token/employees", getDeviceEmployees);
router.post("/device-face-enroll", enrollFaceFromDevice);

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

router.put(
  "/devices/:id/serial",
  authorize("super_admin", "hr_manager"),
  setDeviceSerial,
);
router.post(
  "/devices/:id/sync-employee",
  authorize("super_admin", "hr_manager"),
  syncEmployeeToDevice,
);
router.post(
  "/devices/:id/sync-all",
  authorize("super_admin", "hr_manager"),
  syncAllToDevice,
);
router.delete(
  "/devices/:id/sync-employee/:employeeId",
  authorize("super_admin", "hr_manager"),
  removeEmployeeFromDevice,
);
router.get("/devices/:id/commands", getDeviceCommands);

router.post(
  "/employees/:id/rfid",
  authorize("super_admin", "hr_manager"),
  saveRfidCard,
);

router.post(
  "/employees/:id/face",
  authorize("super_admin", "hr_manager"),
  saveFaceDescriptor,
);
router.get("/face-descriptors", getFaceDescriptors);
router.post("/face-attendance", faceAttendance);

router.post(
  "/devices/:id/enroll-fingerprint",
  authorize("super_admin", "hr_manager"),
  triggerFingerprintEnroll,
);

router.post(
  "/devices/:id/enroll-face-device",
  authorize("super_admin", "hr_manager"),
  triggerFaceEnroll,
);

router.post(
  "/devices/:id/push-face-template",
  authorize("super_admin", "hr_manager"),
  pushFaceTemplateToDevice,
);

module.exports = router;
