const express = require("express");
const {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} = require("../controllers/branchController");
const { protect } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, getBranches);
router.post("/", protect, createBranch);
router.put("/:id", protect, updateBranch);
router.delete("/:id", protect, deleteBranch);

module.exports = router;
