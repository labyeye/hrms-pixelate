const express = require("express");
const c = require("../controllers/taxController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.get("/declaration", protect, c.getMyDeclaration);
router.put("/declaration", protect, c.saveMyDeclaration);
router.get(
  "/declarations",
  protect,
  authorize("super_admin", "hr_manager"),
  c.listDeclarations,
);
router.put(
  "/declarations/:id",
  protect,
  authorize("super_admin", "hr_manager"),
  c.reviewDeclaration,
);
router.get("/form16", protect, c.getForm16);

module.exports = router;
