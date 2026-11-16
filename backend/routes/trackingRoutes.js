const express = require("express");
const router = express.Router();
const trackingController = require("../controllers/trackingController");
const { protect, authorize } = require("../middleware/auth");

// Mobile ping (employees send their current coordinates)
router.post("/ping", protect, trackingController.recordPing);

// Live map view of all tracked field staff (admin, hr)
router.get(
  "/live",
  protect,
  authorize("super_admin", "hr_manager", "department_head"),
  trackingController.getLiveTracking,
);

// Route history / breadcrumb trail for an employee (admin, hr, or the employee themselves)
router.get(
  "/history/:employeeId",
  protect,
  trackingController.getEmployeeRouteHistory,
);

// Add-on configuration settings
router.put(
  "/settings",
  protect,
  authorize("super_admin", "hr_manager"),
  trackingController.updateTrackingSettings,
);

module.exports = router;

