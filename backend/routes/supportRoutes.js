const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  createTicket,
  getMyTickets,
  getTicket,
  updateTicketStatus,
  replyToTicket,
  closeTicket,
  assignTicket,
} = require("../controllers/supportController");

const ADMIN_ROLES = ["super_admin", "hr_manager", "hr_executive"];

router.post("/", protect, createTicket);
router.get("/", protect, getMyTickets);
router.get("/:id", protect, getTicket);
router.post("/:id/reply", protect, replyToTicket);
router.post("/:id/close", protect, closeTicket);
router.patch("/:id/assign", protect, authorize(...ADMIN_ROLES), assignTicket);

// Called by CRM (no JWT, uses x-api-key)
router.patch("/:id/status", updateTicketStatus);

module.exports = router;
