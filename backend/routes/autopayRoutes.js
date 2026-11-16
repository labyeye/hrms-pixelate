const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const s = require("../services/autopayService");

router.use(protect, authorize("super_admin"));

const h = (fn) => async (req, res) => {
  try {
    res.json({ success: true, data: await fn(req) });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message });
  }
};

router.get("/", h((req) => s.status(req.user.company)));
router.post("/setup", h((req) => s.setup(req.user, req.body)));
router.put("/settings", h((req) => s.updateSettings(req.user.company, req.body)));
router.post("/refresh", h((req) => s.sync(req.user.company)));
router.delete("/", h((req) => s.cancel(req.user.company)));

module.exports = router;
