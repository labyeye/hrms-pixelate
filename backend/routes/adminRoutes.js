const express = require("express");
const { getSaasStats } = require("../controllers/adminController");
const { protectPlatformAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/stats", protectPlatformAdmin, getSaasStats);

module.exports = router;
