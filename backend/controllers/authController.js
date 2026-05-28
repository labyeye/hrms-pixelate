const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const generateToken = require("../utils/generateToken");
const { validateBody } = require("../middleware/validate");

// ── Validation schemas ────────────────────────────────────────────────────────

const registerSchema = {
  name: { required: true, type: "string", minLength: 2, maxLength: 80 },
  email: { required: true, email: true },
  password: { required: true, type: "string", minLength: 8, maxLength: 128 },
};

const loginSchema = {
  email: { required: true, email: true },
  password: { required: true, type: "string", minLength: 1, maxLength: 128 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// Strong password: at least 8 chars, one uppercase, one lowercase, one digit
const STRONG_PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// ── Controllers ───────────────────────────────────────────────────────────────

const register = [
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    if (!STRONG_PASSWORD_RE.test(password)) {
      res.status(400);
      throw new Error(
        "Password must be at least 8 characters and include uppercase, lowercase, and a number",
      );
    }

    if (await User.findOne({ email: email.toLowerCase() })) {
      res.status(400);
      throw new Error("An account with this email already exists");
    }

    // Role is NEVER accepted from client — always defaults to hr_manager for self-registration
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: "hr_manager",
    });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  }),
];

const login = [
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).populate({
      path: "company",
      select: "name email phone status subscription industry website",
      populate: {
        path: "subscription",
        select:
          "status plan paymentStatus billingCycle monthlyPrice yearlyPrice maxEmployees currentEmployeeCount renewalDate",
      },
    });

    if (!user || !(await user.matchPassword(password))) {
      res.status(401);
      throw new Error("Invalid email or password");
    }

    if (user.status === "inactive") {
      res.status(403);
      throw new Error("Your account has been deactivated. Please contact HR.");
    }

    if (user.company) {
      const subscription = await Subscription.findOne({
        company: user.company._id,
        status: { $in: ["active", "pending_renewal"] },
      });
      if (!subscription || subscription.paymentStatus !== "completed") {
        res.status(403);
        throw new Error(
          "No active subscription. Please complete your plan purchase.",
        );
      }
    }

    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        status: user.status,
        department: user.department,
        company: user.company,
        token: generateToken(user._id),
      },
    });
  }),
];

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("-password")
    .populate("department", "name code")
    .populate({
      path: "company",
      select: "name email phone status subscription industry website",
      populate: {
        path: "subscription",
        select:
          "status plan paymentStatus billingCycle monthlyPrice yearlyPrice maxEmployees currentEmployeeCount renewalDate",
      },
    });
  res.json({ success: true, data: user });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const { name, phone, avatar, password, currentPassword } = req.body;

  // Changing password requires the current password for verification
  if (password) {
    if (!currentPassword) {
      res.status(400);
      throw new Error("Current password is required to set a new password");
    }
    if (!(await user.matchPassword(currentPassword))) {
      res.status(401);
      throw new Error("Current password is incorrect");
    }
    if (!STRONG_PASSWORD_RE.test(password)) {
      res.status(400);
      throw new Error(
        "New password must be at least 8 characters and include uppercase, lowercase, and a number",
      );
    }
    if (password.length > 128) {
      res.status(400);
      throw new Error("Password too long");
    }
    user.password = password;
  }

  if (name !== undefined) {
    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 80
    ) {
      res.status(400);
      throw new Error("Name must be between 2 and 80 characters");
    }
    user.name = name.trim();
  }
  if (phone !== undefined) {
    if (phone && (typeof phone !== "string" || phone.length > 20)) {
      res.status(400);
      throw new Error("Invalid phone number");
    }
    user.phone = phone;
  }
  if (avatar !== undefined) {
    // Only allow URLs or base64 data URIs, cap at 2MB
    if (avatar && avatar.length > 2_000_000) {
      res.status(400);
      throw new Error("Avatar image too large");
    }
    user.avatar = avatar;
  }

  await user.save();
  const updated = user.toObject();
  delete updated.password;
  res.json({ success: true, data: updated });
});

module.exports = { register, login, getMe, updateProfile };
