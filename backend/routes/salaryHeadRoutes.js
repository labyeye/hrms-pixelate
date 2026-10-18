const express = require("express");
const {
  getSalaryHeads,
  createSalaryHead,
  updateSalaryHead,
  deleteSalaryHead,
} = require("../controllers/salaryHeadController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, authorize("super_admin", "hr_manager"), getSalaryHeads);
router.post("/", protect, authorize("super_admin", "hr_manager"), createSalaryHead);
router.put("/:id", protect, authorize("super_admin", "hr_manager"), updateSalaryHead);
router.delete("/:id", protect, authorize("super_admin", "hr_manager"), deleteSalaryHead);

module.exports = router;
