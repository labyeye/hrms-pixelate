const express = require("express");
const {
  createAnnouncement,
  getAnnouncements,
  deleteAnnouncement,
  markRead,
  acknowledgeAnnouncement,
  uploadPoster,
} = require("../controllers/announcementController");
const { protect, authorize } = require("../middleware/auth");
const { uploadAnnouncementPoster } = require("../middleware/upload");
const router = express.Router();

router
  .route("/")
  .get(protect, getAnnouncements)
  .post(protect, authorize("super_admin", "hr_manager"), createAnnouncement);

router.post(
  "/poster",
  protect,
  authorize("super_admin", "hr_manager"),
  uploadAnnouncementPoster,
  uploadPoster,
);
router.post("/:id/read", protect, markRead);
router.post("/:id/acknowledge", protect, acknowledgeAnnouncement);

router
  .route("/:id")
  .delete(protect, authorize("super_admin", "hr_manager"), deleteAnnouncement);

module.exports = router;
