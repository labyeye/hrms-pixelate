// Constant-time secret comparison (hashing first makes the buffers equal length). Never true for an empty secret.
const crypto = require("crypto");

const digest = (v) => crypto.createHash("sha256").update(String(v ?? "")).digest();

function safeEqual(provided, secret) {
  if (!secret) return false;
  return crypto.timingSafeEqual(digest(provided), digest(secret));
}

module.exports = safeEqual;

if (require.main === module) {
  const assert = require("assert");
  assert.ok(safeEqual("abc", "abc"));
  assert.ok(!safeEqual("abd", "abc"));
  assert.ok(!safeEqual(undefined, undefined));
  assert.ok(!safeEqual("", ""));
  console.log("safeEqual ok");
}
