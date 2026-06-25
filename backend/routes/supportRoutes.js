const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  createTicket,
  getMyTickets,
  getTicket,
  updateTicketStatus,
} = require("../controllers/supportController");

router.post("/", protect, createTicket);
router.get("/", protect, getMyTickets);
router.get("/:id", protect, getTicket);

// Called by CRM (no JWT, uses x-api-key)
router.patch("/:id/status", updateTicketStatus);

module.exports = router;
