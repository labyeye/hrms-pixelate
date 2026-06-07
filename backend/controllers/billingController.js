const asyncHandler = require("express-async-handler");
const Company = require("../models/Company");
const Plan = require("../models/Plan");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const hdfcPayment = require("../services/hdfcPaymentService");
const razorpayService = require("../services/razorpayService");
const { sendPaymentConfirmations } = require("../services/notificationService");

const getPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find({ active: true }).sort({ monthlyPrice: 1 });
  res.json({ success: true, data: plans });
});

const getSubscription = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company) return res.status(404).json({ success: false, message: "Company not found" });
  const subscription = await Subscription.findOne({ company: company._id }).populate("company", "name email");
  if (!subscription) return res.status(404).json({ success: false, message: "No active subscription found" });
  res.json({ success: true, data: subscription });
});

const getInvoices = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company) return res.status(404).json({ success: false, message: "Company not found" });
  const invoices = await Invoice.find({ company: company._id }).sort({ createdAt: -1 }).limit(20);
  res.json({ success: true, data: invoices });
});

// Create order — supports gateway: "razorpay" | "hdfc"
const createOrder = asyncHandler(async (req, res) => {
  const { plan: planId, billingCycle = "monthly", gateway = "razorpay" } = req.body;

  if (!planId || !["starter", "professional", "enterprise"].includes(planId)) {
    res.status(400);
    throw new Error("Invalid plan. Choose starter, professional, or enterprise");
  }
  if (!["monthly", "yearly"].includes(billingCycle)) {
    res.status(400);
    throw new Error("Invalid billing cycle");
  }
  if (!["razorpay", "hdfc"].includes(gateway)) {
    res.status(400);
    throw new Error("Invalid gateway. Use razorpay or hdfc");
  }

  const plan = await Plan.findOne({ planType: planId, active: true });
  if (!plan) { res.status(404); throw new Error("Plan not found"); }

  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company) { res.status(404); throw new Error("Company not found. Complete company setup first."); }

  const amountRupees = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

  let orderData;

  if (gateway === "razorpay") {
    const result = await razorpayService.createOrder({
      amount: amountRupees,
      receipt: `rcpt_${Date.now()}`,
      notes: {
        planId,
        billingCycle,
        userId: req.user._id.toString(),
        companyId: company._id.toString(),
      },
    });

    await Subscription.findOneAndUpdate(
      { company: company._id },
      {
        company: company._id,
        plan: planId,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        maxEmployees: plan.maxEmployees,
        billingCycle,
        startDate: new Date(),
        renewalDate: new Date(),
        status: "inactive",
        paymentStatus: "pending",
        paymentMethod: "razorpay",
        amountPaid: 0,
        razorpayOrderId: result.orderId,
      },
      { upsert: true, new: true },
    );

    orderData = {
      gateway: "razorpay",
      orderId: result.orderId,
      keyId: result.keyId,
      amount: amountRupees,
      currency: "INR",
      plan: planId,
      billingCycle,
      companyName: company.name,
      userName: req.user.name,
      userEmail: req.user.email,
      userPhone: req.user.phone || company.phone || "",
    };
  } else {
    // HDFC SmartGateway
    const orderId = hdfcPayment.generateOrderId();
    const result = await hdfcPayment.createOrder({
      orderId,
      amount: amountRupees,
      currency: "INR",
      customer: {
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone || company.phone || "",
        address: company.address || "India",
        city: company.city || "",
        state: company.state || "",
        pincode: company.pincode || "",
        userId: req.user._id.toString(),
        companyId: company._id.toString(),
      },
    });

    await Subscription.findOneAndUpdate(
      { company: company._id },
      {
        company: company._id,
        plan: planId,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        maxEmployees: plan.maxEmployees,
        billingCycle,
        startDate: new Date(),
        renewalDate: new Date(),
        status: "inactive",
        paymentStatus: "pending",
        paymentMethod: "hdfc_smartgateway",
        amountPaid: 0,
        hdfcOrderId: orderId,
      },
      { upsert: true, new: true },
    );

    orderData = {
      gateway: "hdfc",
      orderId,
      paymentUrl: result.paymentUrl,
      amount: amountRupees,
      currency: "INR",
      plan: planId,
      billingCycle,
    };
  }

  res.json({ success: true, data: orderData });
});

// Verify Razorpay payment (called after checkout modal success)
const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    res.status(400);
    throw new Error("razorpayOrderId, razorpayPaymentId and razorpaySignature are required");
  }

  const isValid = razorpayService.verifySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature });
  if (!isValid) {
    res.status(400);
    throw new Error("Payment verification failed. Invalid signature.");
  }

  await _activateSubscription({
    lookup: { razorpayOrderId },
    update: { razorpayPaymentId, paymentMethod: "razorpay", paymentStatus: "completed" },
    invoiceExtra: { razorpayOrderId, razorpayPaymentId },
    res,
  });
});

// Verify HDFC payment (called after redirect to /payment/success)
const verifyHdfcPayment = asyncHandler(async (req, res) => {
  const { orderId, trackingId } = req.body;
  if (!orderId) { res.status(400); throw new Error("orderId is required"); }

  const verification = await hdfcPayment.verifyPayment({ orderId, trackingId });
  if (!verification.isSuccess) {
    res.status(400);
    throw new Error(`Payment not successful. Status: ${verification.status || "unknown"}`);
  }

  await _activateSubscription({
    lookup: { hdfcOrderId: orderId },
    update: {
      hdfcTrackingId: verification.trackingId,
      hdfcBankRefNo: verification.bankRefNo,
      paymentMethod: "hdfc_smartgateway",
      paymentStatus: "completed",
    },
    invoiceExtra: { hdfcOrderId: orderId, hdfcTrackingId: verification.trackingId },
    res,
  });
});

// Shared subscription activation logic
async function _activateSubscription({ lookup, update, invoiceExtra, res }) {
  const subscription = await Subscription.findOne(lookup);
  if (!subscription) {
    res.status(404);
    throw new Error("Order not found. Please contact support.");
  }

  const company = await Company.findById(subscription.company);
  if (!company) { res.status(404); throw new Error("Company not found"); }

  const plan = await Plan.findOne({ planType: subscription.plan, active: true });
  const amountPaid = subscription.billingCycle === "yearly" ? subscription.yearlyPrice : subscription.monthlyPrice;

  const startDate = new Date();
  const renewalDate = new Date();
  if (subscription.billingCycle === "yearly") {
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  } else {
    renewalDate.setMonth(renewalDate.getMonth() + 1);
  }

  const updatedSub = await Subscription.findByIdAndUpdate(
    subscription._id,
    { startDate, renewalDate, status: "active", amountPaid, ...update },
    { new: true },
  );

  await Company.findByIdAndUpdate(company._id, { status: "active", subscription: updatedSub._id });

  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
  await Invoice.create({
    company: company._id,
    subscription: updatedSub._id,
    invoiceNumber,
    plan: plan ? plan.name : subscription.plan,
    billingCycle: subscription.billingCycle,
    amount: amountPaid,
    status: "paid",
    paidAt: new Date(),
    ...invoiceExtra,
  });

  const user = await User.findById(company.createdBy);
  const dashboardUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/` : "https://hrms.pixelatenest.com/";

  sendPaymentConfirmations({
    toEmail: user?.email || company.email,
    toName: user?.name || company.name,
    toPhone: user?.phone || company.phone || "",
    companyName: company.name,
    planName: plan ? plan.name : subscription.plan,
    amount: amountPaid,
    billingCycle: subscription.billingCycle,
    renewalDate,
    dashboardUrl,
    invoiceNumber,
  }).catch((err) => console.error("[Notifications]", err.message));

  res.json({
    success: true,
    message: "Subscription activated successfully",
    data: {
      plan: plan ? plan.name : subscription.plan,
      billingCycle: subscription.billingCycle,
      amount: amountPaid,
      renewalDate,
      invoiceNumber,
    },
  });
}

// Legacy single verifyPayment — routes to correct handler based on payload
const verifyPayment = asyncHandler(async (req, res) => {
  if (req.body.razorpayOrderId) {
    return verifyRazorpayPayment(req, res);
  }
  return verifyHdfcPayment(req, res);
});

module.exports = {
  getPlans,
  getSubscription,
  getInvoices,
  createOrder,
  verifyPayment,
  verifyRazorpayPayment,
  verifyHdfcPayment,
};
