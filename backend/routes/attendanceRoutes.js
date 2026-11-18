const express = require("express");
const {
  getAttendance,
  markAttendance,
  selfMarkAttendance,
  kioskFaceMark,
  hikvisionPunch,
  getHikvisionSetup,
  getHikvisionAgentSetup,
  agentPoll,
  agentResult,
  getHikvisionDevice,
  saveHikvisionDevice,
  syncHikvisionUsers,
  updateAttendance,
  bulkMarkAttendance,
  bulkUpdateAttendance,
  getMonthSummary,
  getDailySummary,
  getTimingInsights,
} = require("../controllers/attendanceController");
const { runAutoMark } = require("../jobs/attendanceAutoMark");
const { protect, authorize } = require("../middleware/auth");
const {
  uploadAttendanceSelfie,
  uploadFaceEnrollPhoto,
} = require("../middleware/upload");
const router = express.Router();

// Hikvision terminal push: unauthenticated by JWT, secured by secret token in the path.
// multer .any() parses the device's multipart body (snapshot files are discarded).
router.post(
  "/hikvision/:token",
  require("multer")({ storage: require("multer").memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }).any(),
  hikvisionPunch,
);
router.get(
  "/hikvision-setup",
  protect,
  authorize("super_admin", "hr_manager"),
  getHikvisionSetup,
);
router.get("/hikvision-agent-files/:file", (req, res) => {
  if (!["agent.js", "isapi.js"].includes(req.params.file)) return res.status(404).end();
  res.type("text/plain").sendFile(require("path").join(__dirname, "../../hikvision-agent", req.params.file));
});
router.get("/hikvision-agent/:token/jobs", agentPoll);
router.post("/hikvision-agent/:token/jobs/:jobId/result", agentResult);
router.get("/hikvision-agent-setup", protect, authorize("super_admin", "hr_manager"), getHikvisionAgentSetup);
router.get("/hikvision-device", protect, authorize("super_admin", "hr_manager"), getHikvisionDevice);
router.put("/hikvision-device", protect, authorize("super_admin", "hr_manager"), saveHikvisionDevice);
router.post("/hikvision-device/sync", protect, authorize("super_admin", "hr_manager"), syncHikvisionUsers);
router.get("/", protect, getAttendance);
router.get("/summary", protect, getMonthSummary);
router.get("/daily-summary", protect, getDailySummary);
router.get(
  "/timing-insights",
  protect,
  authorize("super_admin", "hr_manager"),
  getTimingInsights,
);
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
  "/bulk-update",
  protect,
  authorize("super_admin", "hr_manager"),
  bulkUpdateAttendance,
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
