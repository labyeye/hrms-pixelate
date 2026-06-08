const express = require("express");
const {
  registerCompany,
  loginCompany,
  getCompanyDetails,
  updateCompanyProfile,
  upgradeSubscription,
  getPlans,
  getSubscriptionDetails,
  createCompanyForUser,
  getMyCompany,
} = require("../controllers/companyController");
const { protectCompany, protect } = require("../middleware/auth");

const router = express.Router();

router.post("/register", registerCompany);
router.post("/login", loginCompany);
router.get("/plans", getPlans);

router.post("/", protect, createCompanyForUser);
router.get("/me", protect, getMyCompany);

router.get("/details", protectCompany, getCompanyDetails);
router.put("/profile", protectCompany, updateCompanyProfile);
router.put("/upgrade-subscription", protectCompany, upgradeSubscription);
router.get("/subscription", protectCompany, getSubscriptionDetails);

module.exports = router;
