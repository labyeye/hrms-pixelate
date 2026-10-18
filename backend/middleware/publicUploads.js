// Only images that are meant to be seen in the UI are public. KYC scans, resumes, leave and vault documents are
// served exclusively by the authenticated download endpoints (a public static route would bypass them).
const express = require("express");
const path = require("path");

const PUBLIC_UPLOAD_DIRS = new Set(["company-logos", "avatars", "attendance-selfies"]);

const guard = (req, res, next) => {
  // Decode first: express.static decodes %2F and normalises "avatars/..%2Femployee-aadhaar/x" into a sibling folder,
  // so the allow-list must be checked on the decoded path and any ".." / backslash / NUL is refused outright.
  let decoded;
  try {
    decoded = decodeURIComponent(req.path);
  } catch {
    return res.status(400).json({ success: false, message: "Bad request" });
  }
  if (/(^|[\\/])\.\.([\\/]|$)/.test(decoded) || decoded.includes("\\") || decoded.includes("\0")) {
    return res.status(404).json({ success: false, message: "Not found" });
  }
  if (!PUBLIC_UPLOAD_DIRS.has(decoded.split("/")[1])) {
    return res.status(404).json({ success: false, message: "Not found" });
  }
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  next();
};

const root = path.join(__dirname, "../uploads");
module.exports = (dir = root) => [guard, express.static(dir, { index: false, dotfiles: "deny", maxAge: "7d" })];
