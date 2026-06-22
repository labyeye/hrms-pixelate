const express = require("express");
const router = express.Router();
const { getCrmInvoices } = require("../controllers/crmController");

router.get("/invoices", getCrmInvoices);

module.exports = router;
