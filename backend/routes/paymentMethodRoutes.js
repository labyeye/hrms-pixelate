const express = require("express");
const {
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getDefaultPaymentMethod,
} = require("../controllers/paymentMethodController");
const { protect } = require("../middleware/auth");

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get all payment methods
router.get("/", getPaymentMethods);

// Get default payment method
router.get("/default", getDefaultPaymentMethod);

// Add new payment method
router.post("/", addPaymentMethod);

// Update payment method
router.patch("/:id", updatePaymentMethod);

// Delete payment method
router.delete("/:id", deletePaymentMethod);

module.exports = router;
