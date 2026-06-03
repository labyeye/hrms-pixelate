const express = require("express");
const {
  getPayrolls,
  processPayroll,
  updatePayroll,
  markPaid,
  bulkMarkPaid,
} = require("../controllers/payrollController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.get(
  "/",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  getPayrolls,
);
router.post(
  "/process",
  protect,
  authorize("super_admin", "hr_manager"),
  processPayroll,
);
router.put(
  "/:id",
  protect,
  authorize("super_admin", "hr_manager"),
  updatePayroll,
);
router.put(
  "/:id/paid",
  protect,
  authorize("super_admin", "hr_manager"),
  markPaid,
);
router.post(
  "/bulk-paid",
  protect,
  authorize("super_admin", "hr_manager"),
  bulkMarkPaid,
);

module.exports = router;
