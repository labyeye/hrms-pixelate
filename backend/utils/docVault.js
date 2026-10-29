// At-rest encryption + OTP gate for confidential employee documents (Aadhaar, PAN, contracts...).
//  - Files are AES-256-GCM encrypted on disk: "NHRENC1" | iv(12) | tag(16) | ciphertext. Legacy plaintext files are
//    still readable (no magic prefix) until scripts/encryptExistingDocs.js converts them.
//  - Viewing/downloading needs a short-lived "doc access" token, obtained by entering a WhatsApp OTP sent to the
//    requesting user (owner or staff). The token travels in the X-Doc-Token header.
const crypto = require("crypto");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Employee = require("../models/Employee");
const { sendPhoneOtp } = require("../services/whatsappService");

const MAGIC = Buffer.from("NHRENC1");
const OTP_TTL_MS = 10 * 60 * 1000;
const ACCESS_TTL = "15m";
const MAX_TRIES = 5;

// DOC_ENC_KEY (any string) is preferred; falling back to JWT_SECRET keeps dev setups working.
// ponytail: rotating this key makes old files unreadable, add a key-id byte if rotation is needed.
const key = () =>
  crypto.scryptSync(
    process.env.DOC_ENC_KEY || process.env.JWT_SECRET,
    "nesthr-doc-vault",
    32,
  );

const isEncrypted = (buf) =>
  buf.length > MAGIC.length + 28 && buf.subarray(0, MAGIC.length).equals(MAGIC);

function encryptBuffer(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), ct]);
}

function decryptBuffer(buf) {
  if (!isEncrypted(buf)) return buf;
  const o = MAGIC.length;
  const d = crypto.createDecipheriv(
    "aes-256-gcm",
    key(),
    buf.subarray(o, o + 12),
  );
  d.setAuthTag(buf.subarray(o + 12, o + 28));
  return Buffer.concat([d.update(buf.subarray(o + 28)), d.final()]);
}

/** Encrypts a file in place (no-op if already encrypted). */
function encryptFile(absPath) {
  const buf = fs.readFileSync(absPath);
  if (!isEncrypted(buf)) fs.writeFileSync(absPath, encryptBuffer(buf));
}

const readDecrypted = (absPath) => decryptBuffer(fs.readFileSync(absPath));

// ---- OTP -------------------------------------------------------------------------------------------------------
const hash = (otp) =>
  crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(`doc:${String(otp).trim()}`)
    .digest("hex");
const to10 = (p) =>
  String(p || "")
    .replace(/[^\d]/g, "")
    .slice(-10);

// POST /documents/otp/request
const requestDocOtp = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "+docOtp +docOtpExpire +docOtpTries",
  );
  const emp = await Employee.findOne({ user: user._id }).select("phone");
  const phone = to10(user.phone || emp?.phone);
  if (phone.length !== 10) {
    res.status(400);
    throw new Error(
      "No phone number on your profile. Add one to receive the OTP.",
    );
  }
  // 1 OTP per 30s per user
  if (
    user.docOtpExpire &&
    user.docOtpExpire.getTime() - OTP_TTL_MS > Date.now() - 30000
  ) {
    res.status(429);
    throw new Error("Please wait 30 seconds before requesting another OTP.");
  }
  const otp = String(crypto.randomInt(100000, 1000000));
  user.docOtp = hash(otp);
  user.docOtpExpire = new Date(Date.now() + OTP_TTL_MS);
  user.docOtpTries = 0;
  await user.save();
  if (process.env.NODE_ENV !== "production")
    console.log(`[DOC-OTP] ${user.email}: ${otp}`);
  await sendPhoneOtp(phone, { otp });
  res.json({
    success: true,
    message: `OTP sent on WhatsApp to ******${phone.slice(-4)}`,
  });
});

// POST /documents/otp/verify  { otp } -> { token }
const verifyDocOtp = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "+docOtp +docOtpExpire +docOtpTries",
  );
  const live =
    user.docOtp &&
    user.docOtpExpire > new Date() &&
    (user.docOtpTries || 0) < MAX_TRIES;
  const a = Buffer.from(user.docOtp || "", "hex");
  const b = Buffer.from(hash(req.body.otp || ""), "hex");
  if (!live || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    if (live) {
      user.docOtpTries = (user.docOtpTries || 0) + 1;
      if (user.docOtpTries >= MAX_TRIES)
        user.docOtp = user.docOtpExpire = undefined;
      await user.save();
    }
    res.status(401);
    throw new Error("Invalid or expired OTP");
  }
  user.docOtp = user.docOtpExpire = undefined;
  user.docOtpTries = 0;
  await user.save();
  const token = jwt.sign(
    { id: user._id, purpose: "doc_access" },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL },
  );
  res.json({ success: true, token, expiresInMinutes: 15 });
});

/** Route guard for file download/view: needs a valid doc-access token that belongs to the logged-in user. */
const requireDocAccess = (req, res, next) => {
  try {
    const d = jwt.verify(
      req.headers["x-doc-token"] || "",
      process.env.JWT_SECRET,
      { algorithms: ["HS256"] },
    );
    if (d.purpose === "doc_access" && String(d.id) === String(req.user._id))
      return next();
  } catch {}
  res.status(403).json({
    success: false,
    code: "DOC_OTP_REQUIRED",
    message: "OTP verification required to open documents",
  });
};

module.exports = {
  encryptFile,
  readDecrypted,
  encryptBuffer,
  decryptBuffer,
  requestDocOtp,
  verifyDocOtp,
  requireDocAccess,
};
