const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const { protect } = require("../middleware/auth");
const Notification = require("../models/Notification");

router.use(protect);

// GET /notifications?page=1&limit=30 -> newest first, plus the unread count for the bell badge
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const filter = { user: req.user._id };
    const [data, total, unread] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, read: false }),
    ]);
    res.json({ success: true, data, total, unread, page });
  }),
);

router.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const unread = await Notification.countDocuments({ user: req.user._id, read: false });
    res.json({ success: true, unread });
  }),
);

router.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ success: true });
  }),
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true });
    res.json({ success: true });
  }),
);

router.delete(
  "/",
  asyncHandler(async (req, res) => {
    await Notification.deleteMany({ user: req.user._id });
    res.json({ success: true });
  }),
);

module.exports = router;
