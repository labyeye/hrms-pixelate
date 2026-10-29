const express = require("express");
const {
  getAttendance,
  markAttendance,
  selfMarkAttendance,
  kioskFaceMark,
  updateAttendance,
  bulkMarkAttendance,
  getMonthSummary,
  getDailySummary,
} = require("../controllers/attendanceController");
const { runAutoMark } = require("../jobs/attendanceAutoMark");
const { protect, authorize } = require("../middleware/auth");
const {
  uploadAttendanceSelfie,
  uploadFaceEnrollPhoto,
} = require("../middleware/upload");
const router = express.Router();

router.get("/", protect, getAttendance);
router.get("/summary", protect, getMonthSummary);
router.get("/daily-summary", protect, getDailySummary);
router.post(
  "/kiosk-face",
  protect,
  authorize("super_admin", "hr_manager"),
  uploadFaceEnrollPhoto,
  kioskFaceMark,
);
router.post("/self-mark", protect, uploadAttendanceSelfie, selfMarkAttendance);
router.post(
  "/",
  protect,
  authorize("super_admin", "hr_manager"),
  markAttendance,
);
router.put(
  "/:id",
  protect,
  authorize("super_admin", "hr_manager"),
  updateAttendance,
);
router.post(
  "/bulk",
  protect,
  authorize("super_admin", "hr_manager"),
  bulkMarkAttendance,
);

router.post(
  "/auto-mark",
  protect,
  authorize("super_admin", "hr_manager"),
  async (req, res) => {
    await runAutoMark(req.user.company); // never touch other tenants
    res.json({ success: true, message: "Auto-mark job completed" });
  },
);

module.exports = router;
