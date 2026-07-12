const express = require("express");
const {
  createAnnouncement,
  getAnnouncements,
  deleteAnnouncement,
  markRead,
  acknowledgeAnnouncement,
} = require("../controllers/announcementController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router
  .route("/")
  .get(protect, getAnnouncements)
  .post(protect, authorize("super_admin", "hr_manager", "hr_executive"), createAnnouncement);

router.post("/:id/read", protect, markRead);
router.post("/:id/acknowledge", protect, acknowledgeAnnouncement);

router
  .route("/:id")
  .delete(protect, authorize("super_admin", "hr_manager"), deleteAnnouncement);

module.exports = router;
