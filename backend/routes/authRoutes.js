const express = require("express");
const {
  register,
  login,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword,
  setup2FA,
  confirm2FA,
  disable2FA,
  verify2FA,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

router.post("/2fa/setup", protect, setup2FA);
router.post("/2fa/confirm", protect, confirm2FA);
router.post("/2fa/disable", protect, disable2FA);
router.post("/2fa/verify", verify2FA);

module.exports = router;
