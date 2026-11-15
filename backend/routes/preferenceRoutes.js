const express = require("express");
const asyncHandler = require("express-async-handler");
const UserPreference = require("../models/UserPreference");
const { protect } = require("../middleware/auth");
const router = express.Router();

const KEY = /^[a-z0-9._-]{1,60}$/i;
const MAX_JSON = 4000; // these are tiny view settings, not a document store

router.use(protect);

// GET /api/preferences/:key → { data: <saved value> | null }
router.get(
  "/:key",
  asyncHandler(async (req, res) => {
    if (!KEY.test(req.params.key)) {
      res.status(400);
      throw new Error("Invalid key");
    }
    const row = await UserPreference.findOne({
      user: req.user._id,
      key: req.params.key,
    }).lean();
    res.json({ success: true, data: row ? row.value : null });
  }),
);

// PUT /api/preferences/:key  body: { value }  (value: null clears it)
router.put(
  "/:key",
  asyncHandler(async (req, res) => {
    if (!KEY.test(req.params.key)) {
      res.status(400);
      throw new Error("Invalid key");
    }
    const { value, merge } = req.body;
    // merge: true → only the fields sent are updated, so the phone and the web page can each save their own fields
    if (
      merge === true &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const set = { company: req.user.company };
      for (const [k, v] of Object.entries(value)) {
        if (!/^[A-Za-z0-9_]{1,40}$/.test(k)) continue;
        if (JSON.stringify(v ?? null).length > 500) continue;
        set["value." + k] = v;
      }
      const row = await UserPreference.findOneAndUpdate(
        { user: req.user._id, key: req.params.key },
        { $set: set },
        { upsert: true, new: true },
      ).lean();
      return res.json({ success: true, data: row.value });
    }
    if (value === null || value === undefined) {
      await UserPreference.deleteOne({ user: req.user._id, key: req.params.key });
      return res.json({ success: true, data: null });
    }
    if (JSON.stringify(value).length > MAX_JSON) {
      res.status(400);
      throw new Error("Preference is too large");
    }
    await UserPreference.findOneAndUpdate(
      { user: req.user._id, key: req.params.key },
      { $set: { value, company: req.user.company } },
      { upsert: true },
    );
    res.json({ success: true, data: value });
  }),
);

module.exports = router;
