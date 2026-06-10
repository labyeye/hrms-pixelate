const express = require("express");
const {
  getEmployees,
  getEmployee,
  getMyEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  resetEmployeePassword,
  bulkImportEmployees,
} = require("../controllers/employeeController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.get("/me", protect, getMyEmployee);

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

router.post(
  "/bulk-import",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  bulkImportEmployees,
);

router.post(
  "/:id/reset-password",
  protect,
  authorize("super_admin", "hr_manager", "hr_executive"),
  resetEmployeePassword,
);

module.exports = router;
