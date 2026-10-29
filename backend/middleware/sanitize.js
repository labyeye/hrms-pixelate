// Removes MongoDB operator injection from request data before it reaches any controller.
// `express.json()` and the default `qs` query parser both turn `{"$ne": null}` / `?SN[$ne]=x` into objects,
// and Mongoose keeps those operators when it casts a filter, so `findOne({ deviceToken })` can be made to match
// anything. Keys that start with "$" or contain "." (update-path injection) and prototype keys are dropped.
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function strip(value) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = strip(value[i]);
    return value;
  }
  if (value && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value; // Date, Buffer, ...
    for (const key of Object.keys(value)) {
      if (key.startsWith("$") || key.includes(".") || BAD_KEYS.has(key))
        delete value[key];
      else value[key] = strip(value[key]);
    }
  }
  return value;
}

function sanitizeRequest(req, _res, next) {
  if (req.body && typeof req.body === "object") strip(req.body);
  if (req.query && typeof req.query === "object") strip(req.query);
  next();
}

module.exports = sanitizeRequest;
module.exports.strip = strip;

if (require.main === module) {
  const assert = require("assert");
  const a = strip({
    deviceToken: { $ne: null },
    ok: "x",
    n: { "a.b": 1, deep: [{ $gt: 1, keep: 2 }] },
  });
  assert.deepStrictEqual(a, {
    deviceToken: {},
    ok: "x",
    n: { deep: [{ keep: 2 }] },
  });
  const evil = strip(JSON.parse('{"__proto__": {"admin": true}, "x": 1}'));
  assert.deepStrictEqual(Object.keys(evil), ["x"]);
  assert.ok(strip(new Date()) instanceof Date);
  console.log("sanitize ok");
}
