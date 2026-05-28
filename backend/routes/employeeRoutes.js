const express = require("express");
const {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} = require("../controllers/employeeController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router
  .route("/")
  .get(protect, getEmployees)
  .post(
    protect,
    authorize("super_admin", "hr_manager", "hr_executive"),
    createEmployee,
  );
router
  .route("/:id")
  .get(protect, getEmployee)
  .put(
    protect,
    authorize("super_admin", "hr_manager", "hr_executive"),
    updateEmployee,
  )
  .delete(protect, authorize("super_admin", "hr_manager"), deleteEmployee);

module.exports = router;
