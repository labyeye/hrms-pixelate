const express = require("express");
const {
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getDefaultPaymentMethod,
} = require("../controllers/paymentMethodController");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.get("/", getPaymentMethods);

router.get("/default", getDefaultPaymentMethod);

router.post("/", authorize("super_admin"), addPaymentMethod);

router.patch("/:id", authorize("super_admin"), updatePaymentMethod);

router.delete("/:id", authorize("super_admin"), deletePaymentMethod);

module.exports = router;
