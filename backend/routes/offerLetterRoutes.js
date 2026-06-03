const express = require("express");
const {
  getOfferLetters,
  createOfferLetter,
  updateOfferLetter,
  deleteOfferLetter,
} = require("../controllers/offerLetterController");
const { protect } = require("../middleware/auth");
const router = express.Router();

router.get("/", protect, getOfferLetters);
router.post("/", protect, createOfferLetter);
router.put("/:id", protect, updateOfferLetter);
router.delete("/:id", protect, deleteOfferLetter);

module.exports = router;
