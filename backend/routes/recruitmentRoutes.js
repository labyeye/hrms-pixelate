const express = require("express");
const {
  getJobs,
  createJob,
  updateJob,
  addCandidate,
  updateCandidateStage,
} = require("../controllers/recruitmentController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, getJobs);
router.post(
  "/",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  createJob,
);
router.put(
  "/:id",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  updateJob,
);
router.post(
  "/:id/candidates",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  addCandidate,
);
router.put(
  "/:id/candidates/:candidateId",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  updateCandidateStage,
);

module.exports = router;
