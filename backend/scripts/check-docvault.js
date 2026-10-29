// Offline checks for the document vault: AES-GCM at-rest encryption and the OTP-issued access-token gate.
//   node scripts/check-docvault.js        (no database needed)
process.env.JWT_SECRET = "test-secret";
const assert = require("assert");
const jwt = require("jsonwebtoken");
const {
  encryptBuffer,
  decryptBuffer,
  requireDocAccess,
} = require("../utils/docVault");

// encryption round-trip, ciphertext hides the plaintext, tampering is detected, legacy plaintext still readable
const plain = Buffer.from("AADHAAR 1234 5678 9012");
const enc = encryptBuffer(plain);
assert(!enc.includes("AADHAAR"), "ciphertext must not contain plaintext");
assert.strictEqual(decryptBuffer(enc).toString(), plain.toString());
assert.strictEqual(
  decryptBuffer(plain).toString(),
  plain.toString(),
  "legacy plaintext files stay readable",
);
const bad = Buffer.from(enc);
bad[bad.length - 1] ^= 1;
assert.throws(
  () => decryptBuffer(bad),
  "tampered file must fail authentication",
);

// access gate: needs a doc_access token that belongs to the logged-in user
const run = (headers, userId = "u1") => {
  let out = "pass";
  const res = { status: (c) => ({ json: () => (out = `blocked ${c}`) }) };
  requireDocAccess(
    { headers, user: { _id: userId } },
    res,
    () => (out = "pass"),
  );
  return out;
};
const mk = (o, exp = "15m") =>
  jwt.sign({ purpose: "doc_access", id: "u1", ...o }, process.env.JWT_SECRET, {
    expiresIn: exp,
  });
assert.strictEqual(run({}), "blocked 403", "no token");
assert.strictEqual(
  run({ "x-doc-token": "junk" }),
  "blocked 403",
  "garbage token",
);
assert.strictEqual(run({ "x-doc-token": mk({}) }), "pass", "valid token");
assert.strictEqual(
  run({ "x-doc-token": mk({}) }, "someone-else"),
  "blocked 403",
  "another user's token",
);
assert.strictEqual(
  run({ "x-doc-token": mk({ purpose: "login" }) }),
  "blocked 403",
  "wrong purpose",
);
assert.strictEqual(
  run({ "x-doc-token": mk({}, "-1s") }),
  "blocked 403",
  "expired token",
);
console.log("docvault checks passed");
