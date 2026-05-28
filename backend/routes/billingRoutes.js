const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getPlans,
  getSubscription,
  getInvoices,
  createOrder,
  verifyPayment,
} = require("../controllers/billingController");

router.get("/plans", getPlans);
router.get("/subscription", protect, getSubscription);
router.get("/invoices", protect, getInvoices);
router.post("/create-order", protect, createOrder);
router.post("/verify-payment", protect, verifyPayment);

module.exports = router;
