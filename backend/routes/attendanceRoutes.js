const express = require("express");
const {
  getAttendance,
  markAttendance,
  updateAttendance,
  bulkMarkAttendance,
  getMonthSummary,
} = require("../controllers/attendanceController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, getAttendance);
router.get("/summary", protect, getMonthSummary);
router.post(
  "/",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  markAttendance,
);
router.put(
  "/:id",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  updateAttendance,
);
router.post(
  "/bulk",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  bulkMarkAttendance,
);

module.exports = router;
