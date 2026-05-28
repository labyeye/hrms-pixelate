const express = require("express");
const {
  getReviews,
  createReview,
  updateReview,
} = require("../controllers/performanceController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, getReviews);
router.post(
  "/",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  createReview,
);
router.put(
  "/:id",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  updateReview,
);

module.exports = router;
