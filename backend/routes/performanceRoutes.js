const express = require("express");
const {
  getReviews,
  createReview,
  updateReview,
  getLiveMetrics,
} = require("../controllers/performanceController");
const { protect, authorize, requirePlanFeature } = require("../middleware/auth");
const router = express.Router();

router.use(protect, requirePlanFeature("performanceReviews"));

router.get("/live", getLiveMetrics);
router.get("/", getReviews);
router.post(
  "/",
  authorize("super_admin", "hr_manager", "hr_executive"),
  createReview,
);
router.put(
  "/:id",
  authorize("super_admin", "hr_manager", "hr_executive"),
  updateReview,
);

module.exports = router;
