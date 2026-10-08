const express = require("express");
const {
  getStats,
  getEmployeeStats,
  getPayrollSummary,
} = require("../controllers/dashboardController");
const { getActivityFeed } = require("../controllers/activityFeedController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

const noCache = (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
};

router.get("/stats", protect, noCache, getStats);
router.get("/payroll-summary",
  protect,
  authorize("super_admin", "hr_manager"),
  noCache, getPayrollSummary);
router.get("/activity", protect, noCache, getActivityFeed);
router.get("/employee", protect, noCache, getEmployeeStats);
module.exports = router;
