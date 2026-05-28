const asyncHandler = require("express-async-handler");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Company = require("../models/Company");
const Plan = require("../models/Plan");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials not configured");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// Get available plans from DB
const getPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find({ active: true }).sort({ monthlyPrice: 1 });
  res.json({ success: true, data: plans });
});

// Get current subscription
const getSubscription = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company) {
    return res
      .status(404)
      .json({ success: false, message: "Company not found" });
  }

  const subscription = await Subscription.findOne({
    company: company._id,
  }).populate("company", "name email");

  if (!subscription) {
    return res
      .status(404)
      .json({ success: false, message: "No active subscription found" });
  }

  res.json({ success: true, data: subscription });
});

// Get invoice history
const getInvoices = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company) {
    return res
      .status(404)
      .json({ success: false, message: "Company not found" });
  }

  const invoices = await Invoice.find({ company: company._id })
    .sort({ createdAt: -1 })
    .limit(20);
  res.json({ success: true, data: invoices });
});

// Create Razorpay payment order
const createOrder = asyncHandler(async (req, res) => {
  const { plan: planId, billingCycle = "monthly" } = req.body;

  if (!planId || !["starter", "professional", "enterprise"].includes(planId)) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Invalid plan. Choose starter, professional, or enterprise",
      });
  }
  if (!["monthly", "yearly"].includes(billingCycle)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid billing cycle" });
  }

  const plan = await Plan.findOne({ planType: planId, active: true });
  if (!plan) {
    return res.status(404).json({ success: false, message: "Plan not found" });
  }

  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company) {
    return res
      .status(404)
      .json({ success: false, message: "Company not found" });
  }

  const razorpay = getRazorpay();

  // Amount in paise (multiply ₹ × 100)
  const amountRupees =
    billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const amountPaise = amountRupees * 100;

  const order = await razorpay.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: `rcpt_${Date.now()}`,
    notes: {
      userId: req.user._id.toString(),
      companyId: company._id.toString(),
      planId,
      billingCycle,
    },
  });

  res.json({
    success: true,
    data: {
      orderId: order.id,
      amount: amountPaise,
      currency: "INR",
      plan: planId,
      billingCycle,
    },
  });
});

// Verify Razorpay payment and activate subscription
const verifyPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    plan: planId,
    billingCycle,
  } = req.body;

  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature ||
    !planId ||
    !billingCycle
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required payment fields" });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return res
      .status(500)
      .json({ success: false, message: "Payment gateway not configured" });
  }

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  if (
    !crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(razorpay_signature),
    )
  ) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Payment verification failed — signature mismatch",
      });
  }

  const plan = await Plan.findOne({ planType: planId, active: true });
  if (!plan) {
    return res.status(404).json({ success: false, message: "Plan not found" });
  }

  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company) {
    return res
      .status(404)
      .json({ success: false, message: "Company not found" });
  }

  const amountPaid =
    billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

  const startDate = new Date();
  const renewalDate = new Date();
  if (billingCycle === "yearly") {
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  } else {
    renewalDate.setMonth(renewalDate.getMonth() + 1);
  }

  await Company.findByIdAndUpdate(company._id, { status: "active" });

  let subscription = await Subscription.findOneAndUpdate(
    { company: company._id },
    {
      plan: planId,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      maxEmployees: plan.maxEmployees,
      billingCycle,
      startDate,
      renewalDate,
      status: "active",
      paymentStatus: "completed",
      paymentMethod: "razorpay",
      amountPaid,
    },
    { upsert: true, new: true },
  );

  await Company.findByIdAndUpdate(company._id, {
    subscription: subscription._id,
  });

  // Create invoice record
  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  await Invoice.create({
    company: company._id,
    subscription: subscription._id,
    invoiceNumber,
    plan: plan.name,
    billingCycle,
    amount: amountPaid,
    status: "paid",
    paidAt: new Date(),
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
  });

  res.json({
    success: true,
    message: "Subscription activated successfully",
    data: { plan: plan.name, subscription },
  });
});

module.exports = {
  getPlans,
  getSubscription,
  getInvoices,
  createOrder,
  verifyPayment,
};
