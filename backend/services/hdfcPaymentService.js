/**
 * HDFC SmartGateway Payment Service
 *
 * Credentials required in .env:
 *   HDFC_MERCHANT_ID      — assigned by HDFC during merchant onboarding
 *   HDFC_ACCESS_KEY       — API access key / secret from HDFC merchant portal
 *   HDFC_ENV              — "test" | "production"  (defaults to "test")
 *   FRONTEND_URL          — e.g. https://hrms.pixelatenest.com
 *
 * HDFC SmartGateway test portal: https://smartgatewayuat.hdfcbank.com
 * HDFC SmartGateway prod portal:  https://smartgateway.hdfcbank.com
 *
 * When you receive credentials from HDFC, verify the exact endpoint paths
 * in the documentation they provide. The structure below follows the standard
 * HDFC SmartGateway REST API spec.
 */

const https = require("https");
const crypto = require("crypto");

const BASE_URL =
  process.env.HDFC_ENV === "production"
    ? "smartgateway.hdfcbank.com"
    : "smartgatewayuat.hdfcbank.com";

function getMerchantCredentials() {
  const merchantId = process.env.HDFC_MERCHANT_ID;
  const accessKey = process.env.HDFC_ACCESS_KEY;

  if (!merchantId || !accessKey) {
    throw new Error(
      "HDFC SmartGateway credentials not configured. " +
        "Set HDFC_MERCHANT_ID and HDFC_ACCESS_KEY in .env",
    );
  }
  return { merchantId, accessKey };
}

function basicAuth(merchantId, accessKey) {
  return (
    "Basic " + Buffer.from(`${merchantId}:${accessKey}`).toString("base64")
  );
}

function httpsPost(hostname, path, body, headers) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(
                new Error(
                  parsed.message || `HDFC API error ${res.statusCode}: ${data}`,
                ),
              );
            }
          } catch {
            reject(new Error(`HDFC response parse error: ${data}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Create a payment order on HDFC SmartGateway.
 *
 * Returns:
 *   { orderId, paymentUrl, amount }
 *
 * The frontend redirects the user to `paymentUrl`.
 * After payment, HDFC redirects back to FRONTEND_URL/payment/success or /payment/failed
 * with query params: orderId, trackingId, status, amount, paymentMode
 */
async function createOrder({ orderId, amount, currency = "INR", customer }) {
  const { merchantId, accessKey } = getMerchantCredentials();
  const frontendUrl =
    process.env.FRONTEND_URL || "https://hrms.pixelatenest.com";

  // TODO: Confirm exact endpoint path from HDFC documentation provided with credentials
  const response = await httpsPost(
    BASE_URL,
    "/payment/gateway/v1/order/create",
    {
      merchant_id: merchantId,
      order_id: orderId,
      amount: amount.toFixed(2),
      currency,
      redirect_url: `${frontendUrl}/payment/success`,
      cancel_url: `${frontendUrl}/payment/failed`,
      billing_name: customer.name,
      billing_email: customer.email,
      billing_tel: customer.phone || "",
      billing_address: customer.address || "India",
      billing_city: customer.city || "India",
      billing_state: customer.state || "India",
      billing_zip: customer.pincode || "000000",
      billing_country: "India",
      language: "EN",
      // Pass internal metadata via merchant params
      merchant_param1: customer.userId,
      merchant_param2: customer.companyId,
    },
    {
      Authorization: basicAuth(merchantId, accessKey),
    },
  );

  // TODO: Map the actual response field names from HDFC docs
  // Common field names: payment_url, paymentPageUrl, payment_link
  const paymentUrl =
    response.payment_url || response.paymentPageUrl || response.payment_link;

  if (!paymentUrl) {
    throw new Error(
      "HDFC did not return a payment URL. " +
        "Check HDFC_MERCHANT_ID, HDFC_ACCESS_KEY, and request payload.",
    );
  }

  return {
    orderId,
    paymentUrl,
    amount,
    currency,
  };
}

/**
 * Verify an HDFC payment callback.
 *
 * HDFC sends a response to the redirect_url with these query params:
 *   order_id, tracking_id, bank_ref_no, order_status, payment_mode, amount
 *
 * Verification options (HDFC provides one of these):
 *   1. HMAC signature in the callback
 *   2. Status enquiry API call to confirm the transaction server-side
 *
 * This function uses the server-side status enquiry (most secure approach).
 */
async function verifyPayment({ orderId, trackingId }) {
  const { merchantId, accessKey } = getMerchantCredentials();

  // TODO: Confirm exact enquiry endpoint path from HDFC documentation
  const response = await httpsPost(
    BASE_URL,
    "/payment/gateway/v1/order/status",
    {
      merchant_id: merchantId,
      order_id: orderId,
      // Some versions use tracking_id for lookup
      ...(trackingId ? { tracking_id: trackingId } : {}),
    },
    {
      Authorization: basicAuth(merchantId, accessKey),
    },
  );

  // TODO: Map the actual status field names from HDFC docs
  // Common field names: order_status, status, payment_status
  const status = (response.order_status || response.status || "").toUpperCase();

  const isSuccess = status === "SUCCESS" || status === "CAPTURED";

  return {
    isSuccess,
    status: response.order_status || response.status,
    trackingId: response.tracking_id || trackingId,
    bankRefNo: response.bank_ref_no || "",
    amount: parseFloat(response.amount || "0"),
    paymentMode: response.payment_mode || "",
    raw: response,
  };
}

/**
 * Generate a unique order ID for HDFC.
 * HDFC requires alphanumeric, max 20 chars, unique per merchant.
 */
function generateOrderId(prefix = "NHRM") {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}${ts}${rand}`.slice(0, 20);
}

module.exports = { createOrder, verifyPayment, generateOrderId };
