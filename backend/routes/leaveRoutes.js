const express = require("express");
const {
  getLeaves,
  createLeave,
  updateLeaveStatus,
  deleteLeave,
} = require("../controllers/leaveController");
const { protect } = require("../middleware/auth");
const router = express.Router();

router.route("/").get(protect, getLeaves).post(protect, createLeave);
router
  .route("/:id")
  .put(protect, updateLeaveStatus)
  .delete(protect, deleteLeave);

module.exports = router;
