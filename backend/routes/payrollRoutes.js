const express = require("express");
const {
  getPayrolls,
  getMyPayrolls,
  processPayroll,
  previewPayroll,
  updatePayroll,
  markPaid,
  bulkMarkPaid,
  markSlipReceived,
} = require("../controllers/payrollController");
const {
  exportTally,
  exportZoho,
} = require("../controllers/payrollExportController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.get("/my", protect, getMyPayrolls);
router.get("/", protect, authorize("super_admin", "hr_manager"), getPayrolls);
router.post(
  "/preview",
  protect,
  authorize("super_admin", "hr_manager"),
  previewPayroll,
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
router.patch(
  "/:id/slip-received",
  protect,
  authorize("super_admin", "hr_manager"),
  markSlipReceived,
);

router.get(
  "/export/tally",
  protect,
  authorize("super_admin", "hr_manager"),
  exportTally,
);
router.get(
  "/export/zoho",
  protect,
  authorize("super_admin", "hr_manager"),
  exportZoho,
);

module.exports = router;
