const express = require("express");
const jwt = require("jsonwebtoken");
const { getSaasStats } = require("../controllers/adminController");

const router = express.Router();

function protectPlatformAdmin(req, res, next) {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "platform_admin" || decoded.iss !== "nesthr-platform") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
}

router.get("/stats", protectPlatformAdmin, getSaasStats);

module.exports = router;
