const express = require("express");
const {
  getDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
} = require("../controllers/designationController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, getDesignations);
router.post(
  "/",
  protect,
  authorize("super_admin", "hr_manager"),
  createDesignation,
);
router.put(
  "/:id",
  protect,
  authorize("super_admin", "hr_manager"),
  updateDesignation,
);
router.delete(
  "/:id",
  protect,
  authorize("super_admin", "hr_manager"),
  deleteDesignation,
);

module.exports = router;
