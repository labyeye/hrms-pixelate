// Pushes customer-signup-funnel events to the company CRM so sales/support
// can see which leads signed up, started payment, abandoned, or converted.
// Mirrors the pattern already used for support tickets (see supportController.notifyCrm):
// a shared-secret header, fire-and-forget, no-op if the URL isn't configured.
async function notifyCrmSignupEvent(event, data) {
  const webhookUrl = process.env.CRM_SIGNUP_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.CRM_API_SECRET || "",
      },
      body: JSON.stringify({
        event,
        occurredAt: new Date().toISOString(),
        ...data,
      }),
    });
  } catch (err) {
    console.error("[CRM Signup Webhook]", event, err.message);
  }
}

module.exports = { notifyCrmSignupEvent };
