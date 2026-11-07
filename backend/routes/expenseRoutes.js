const express = require("express");
const c = require("../controllers/expenseController");
const { protect, authorize } = require("../middleware/auth");
const { uploadExpenseBill } = require("../middleware/upload");
const router = express.Router();

router.get("/", protect, c.getExpenses);
router.post("/", protect, uploadExpenseBill, c.createExpense);
router.get("/workflow", protect, c.getWorkflow);
router.put(
  "/workflow",
  protect,
  authorize("super_admin", "hr_manager"),
  c.saveWorkflow,
);
router.get("/:id/bill", protect, c.downloadBill);
router.put(
  "/:id/action",
  protect,
  authorize("super_admin", "hr_manager", "department_head"),
  c.actOnExpense,
);
router.delete("/:id", protect, c.deleteExpense);

module.exports = router;
