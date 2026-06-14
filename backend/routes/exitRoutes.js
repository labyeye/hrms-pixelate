const express = require("express");
const { getExits, getExit, createExit, updateExit, deleteExit } = require("../controllers/exitController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.use(protect);
router.get("/", getExits);
router.get("/:id", getExit);
router.post("/", authorize("super_admin", "hr_manager", "hr_executive"), createExit);
router.put("/:id", authorize("super_admin", "hr_manager", "hr_executive"), updateExit);
router.delete("/:id", authorize("super_admin", "hr_manager"), deleteExit);

module.exports = router;
