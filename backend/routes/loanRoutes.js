const express = require("express");
const {
  getLoans,
  createLoan,
  requestLoan,
  updateLoanStatus,
  updateLoan,
  deleteLoan,
} = require("../controllers/loanController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, getLoans);
router.post("/", protect, authorize("super_admin", "hr_manager"), createLoan);
router.post("/request", protect, requestLoan);
router.put("/:id/status", protect, authorize("super_admin", "hr_manager"), updateLoanStatus);
router.put("/:id", protect, authorize("super_admin", "hr_manager"), updateLoan);
router.delete("/:id", protect, authorize("super_admin", "hr_manager"), deleteLoan);

module.exports = router;
