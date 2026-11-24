const express = require("express");
const c = require("../controllers/companyExpenseController");
const { protect, authorize } = require("../middleware/auth");
const { uploadExpenseBill } = require("../middleware/upload");
const router = express.Router();

router.use(protect, authorize("super_admin", "hr_manager"));
router.get("/", c.list);
router.post("/", uploadExpenseBill, c.create);
router.put("/:id", uploadExpenseBill, c.update);
router.delete("/:id", c.remove);
router.get("/:id/bill/:index", c.downloadBill);
router.get("/:id/bill-link/:index", c.getBillLink);

module.exports = router;
