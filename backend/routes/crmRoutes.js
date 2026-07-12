const express = require("express");
const router = express.Router();
const {
  getCrmInvoices,
  getCrmOffers,
  getCrmOfferById,
  createCrmOffer,
  updateCrmOffer,
  deleteCrmOffer,
  getCrmAttendance,
  updateCrmSubscription,
} = require("../controllers/crmController");

router.get("/invoices", getCrmInvoices);
router.get("/attendance", getCrmAttendance);
router.patch("/companies/:companyId/subscription", updateCrmSubscription);

router.get("/offers", getCrmOffers);
router.get("/offers/:id", getCrmOfferById);
router.post("/offers", createCrmOffer);
router.patch("/offers/:id", updateCrmOffer);
router.delete("/offers/:id", deleteCrmOffer);

module.exports = router;
