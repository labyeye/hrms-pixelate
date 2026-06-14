const express = require("express");
const { getLogs } = require("../controllers/auditController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, authorize("super_admin", "hr_manager"), getLogs);

module.exports = router;
