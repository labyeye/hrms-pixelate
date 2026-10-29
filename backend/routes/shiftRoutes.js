const express = require("express");
const {
  getShifts,
  createShift,
  updateShift,
  deleteShift,
} = require("../controllers/shiftController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, getShifts);
router.post("/", protect, authorize("super_admin", "hr_manager"), createShift);
router.put(
  "/:id",
  protect,
  authorize("super_admin", "hr_manager"),
  updateShift,
);
router.delete(
  "/:id",
  protect,
  authorize("super_admin", "hr_manager"),
  deleteShift,
);

module.exports = router;
