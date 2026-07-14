const express = require("express");
const {
  getJobs,
  createJob,
  updateJob,
  addCandidate,
  updateCandidateStage,
} = require("../controllers/recruitmentController");
const {
  protect,
  authorize,
  requirePlanFeature,
} = require("../middleware/auth");
const router = express.Router();

router.use(protect, requirePlanFeature("recruitment"));

router.get("/", getJobs);
router.post("/", authorize("super_admin", "hr_manager"), createJob);
router.put("/:id", authorize("super_admin", "hr_manager"), updateJob);
router.post(
  "/:id/candidates",
  authorize("super_admin", "hr_manager"),
  addCandidate,
);
router.put(
  "/:id/candidates/:candidateId",
  authorize("super_admin", "hr_manager"),
  updateCandidateStage,
);

module.exports = router;
