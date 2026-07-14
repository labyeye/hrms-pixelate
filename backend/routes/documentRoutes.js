const express = require("express");
const {
  uploadDocument,
  getDocuments,
  downloadDocument,
  updateDocument,
  deleteDocument,
  generateLetter,
} = require("../controllers/documentController");
const { protect, authorize } = require("../middleware/auth");
const { uploadDocumentVault } = require("../middleware/upload");

const router = express.Router();

router.get("/", protect, getDocuments);
router.post(
  "/generate-letter",
  protect,
  authorize("super_admin", "hr_manager"),
  generateLetter,
);
router.post(
  "/",
  protect,
  authorize("super_admin", "hr_manager", "employee"),
  uploadDocumentVault,
  uploadDocument,
);
// Edit/delete are HR-controlled; download stays open to employees since
// downloadDocument itself scopes them to their own documents.
router.get(
  "/:id/download",
  protect,
  authorize("super_admin", "hr_manager", "employee"),
  downloadDocument,
);
router.put(
  "/:id",
  protect,
  authorize("super_admin", "hr_manager"),
  uploadDocumentVault,
  updateDocument,
);
router.delete(
  "/:id",
  protect,
  authorize("super_admin", "hr_manager"),
  deleteDocument,
);

module.exports = router;
