const express = require("express");
const {
  getLoans,
  createLoan,
  updateLoan,
  deleteLoan,
} = require("../controllers/loanController");
const { protect } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, getLoans);
router.post("/", protect, createLoan);
router.put("/:id", protect, updateLoan);
router.delete("/:id", protect, deleteLoan);

module.exports = router;
