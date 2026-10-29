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
  uploadEmployeeDocuments,
  downloadEmployeeDocument,
  enrollEmployeeFace,
  enrollMyFace,
  resetEmployeeFace,
  resetMyFace,
} = require("../controllers/employeeController");
const { protect, authorize } = require("../middleware/auth");
const { requireDocAccess } = require("../utils/docVault");
const {
  uploadEmployeeDocs,
  uploadAvatar,
  uploadFaceEnrollPhoto,
} = require("../middleware/upload");
const { validateMongoId } = require("../middleware/validate");
const router = express.Router();

router.get("/me", protect, getMyEmployee);
router.post("/me/face-enroll", protect, uploadFaceEnrollPhoto, enrollMyFace);
router.delete("/me/face-enroll", protect, resetMyFace);

router
  .route("/")
  .get(protect, getEmployees)
  .post(protect, authorize("super_admin", "hr_manager"), createEmployee);
router
  .route("/:id")
  .get(protect, getEmployee)
  .put(protect, authorize("super_admin", "hr_manager"), updateEmployee)
  .delete(protect, authorize("super_admin", "hr_manager"), deleteEmployee);

router.post(
  "/bulk-import",
  protect,
  authorize("super_admin", "hr_manager"),
  bulkImportEmployees,
);

router.post(
  "/:id/reset-password",
  protect,
  authorize("super_admin", "hr_manager"),
  resetEmployeePassword,
);

router.post(
  "/:id/documents",
  validateMongoId("id"),
  protect,
  authorize("super_admin", "hr_manager"),
  uploadEmployeeDocs,
  uploadEmployeeDocuments,
);

router.post(
  "/:id/avatar",
  validateMongoId("id"),
  protect,
  authorize("super_admin", "hr_manager"),
  uploadAvatar,
  async (req, res, next) => {
    const fs = require("fs");
    const Employee = require("../models/Employee");
    const { validateMagicBytes } = require("../middleware/upload");
    try {
      if (!req.file)
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      // Only employees of the caller's own company; the stray upload is removed otherwise.
      const employee = await Employee.findOne({
        _id: req.params.id,
        company: req.user.company,
      }).select("_id");
      if (!employee) {
        fs.unlink(req.file.path, () => {});
        return res
          .status(404)
          .json({ success: false, message: "Employee not found" });
      }
      await validateMagicBytes(req.file.path); // throws and deletes the file when it isn't really an image
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
      await Employee.updateOne({ _id: employee._id }, { avatar: avatarUrl });
      res.json({ success: true, avatar: avatarUrl });
    } catch (err) {
      res.status(400);
      next(err);
    }
  },
);

router.delete(
  "/:id/face-enroll",
  protect,
  authorize("super_admin", "hr_manager"),
  resetEmployeeFace,
);

router.post(
  "/:id/face-enroll",
  validateMongoId("id"),
  protect,
  authorize("super_admin", "hr_manager"),
  uploadFaceEnrollPhoto,
  enrollEmployeeFace,
);

router.get(
  "/:id/documents/:type",
  protect,
  authorize("super_admin", "hr_manager"),
  requireDocAccess,
  downloadEmployeeDocument,
);

module.exports = router;
