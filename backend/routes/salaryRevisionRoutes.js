const express = require("express");
const {
  createRevision,
  getRevisions,
  getMyRevisions,
  getMonthlyReport,
} = require("../controllers/salaryRevisionController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.use(protect);
// Staff: own growth only
router.get("/my", getMyRevisions);
// Admin / HR: everything else
router.get("/report", authorize("super_admin", "hr_manager"), getMonthlyReport);
router.get("/", authorize("super_admin", "hr_manager"), getRevisions);
router.post("/", authorize("super_admin", "hr_manager"), createRevision);

module.exports = router;
