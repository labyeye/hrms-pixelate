const nodemailer = require("nodemailer");
const { sendWhatsApp } = require("./whatsappService");

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

async function sendSubscriptionConfirmationEmail(opts) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[Email] SMTP not configured — skipping confirmation email");
    return;
  }

  const fromName = process.env.SMTP_FROM_NAME || "NestHR";
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to NestHR</title>
  <style>
    body { font-family: Arial, sans-serif; background: #F0F6FF; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 32px auto; background: #ffffff; border: 2px solid #000; }
    .header { background: #024BAB; padding: 24px 32px; border-bottom: 2px solid #000; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
    .header p { color: #b3d0ff; margin: 4px 0 0; font-size: 13px; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; font-weight: 700; color: #000; margin-bottom: 8px; }
    .text { font-size: 14px; color: #555; line-height: 1.6; margin-bottom: 20px; }
    .card { background: #F0F6FF; border: 2px solid #000; padding: 20px; margin-bottom: 24px; }
    .card-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #d0d9e8; font-size: 13px; }
    .card-row:last-child { border-bottom: none; }
    .card-label { color: #666; font-weight: 600; }
    .card-value { color: #000; font-weight: 800; }
    .card-value.highlight { color: #024BAB; font-size: 15px; }
    .btn { display: inline-block; background: #024BAB; color: #fff; font-weight: 900; font-size: 14px; text-decoration: none; padding: 14px 28px; border: 2px solid #000; letter-spacing: 0.5px; margin-top: 8px; }
    .footer { background: #f8f8f8; border-top: 2px solid #000; padding: 16px 32px; font-size: 12px; color: #888; }
    .badge { display: inline-block; background: #024BAB; color: #fff; font-size: 11px; font-weight: 900; padding: 3px 8px; border: 1px solid #000; text-transform: uppercase; letter-spacing: 0.5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NestHR — Subscription Confirmed</h1>
      <p>Your workspace is ready</p>
    </div>
    <div class="body">
      <p class="greeting">Hello ${opts.toName},</p>
      <p class="text">
        Welcome to NestHR! Your <strong>${opts.planName} plan</strong> has been activated successfully for
        <strong>${opts.companyName}</strong>. Here's your subscription summary:
      </p>

      <div class="card">
        <div class="card-row">
          <span class="card-label">Plan</span>
          <span class="card-value"><span class="badge">${opts.planName}</span></span>
        </div>
        <div class="card-row">
          <span class="card-label">Billing</span>
          <span class="card-value">${opts.billingCycle === "yearly" ? "Annual" : "Monthly"}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Amount Paid</span>
          <span class="card-value highlight">${formatCurrency(opts.amount)}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Invoice No.</span>
          <span class="card-value">${opts.invoiceNumber}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Next Renewal</span>
          <span class="card-value">${formatDate(opts.renewalDate)}</span>
        </div>
      </div>

      <p class="text">
        You can now log in to your NestHR dashboard and start setting up your team —
        add employees, configure attendance, set up payroll, and more.
      </p>

      <a href="${opts.dashboardUrl}" class="btn">Go to Dashboard &rarr;</a>

      <p class="text" style="margin-top: 28px; font-size: 13px; color: #888;">
        If you have any questions, reply to this email or contact us at
        <a href="mailto:support@pixelatenest.com" style="color: #024BAB;">support@pixelatenest.com</a>.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Pixelate Nest — NestHR. All rights reserved.<br />
      This email was sent to ${opts.toEmail} because you activated a NestHR subscription.
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: opts.toEmail,
      subject: `✅ Welcome to NestHR — ${opts.planName} Plan Activated`,
      html,
    });
    console.log(`[Email] Confirmation sent to ${opts.toEmail}`);
  } catch (err) {
    console.error("[Email] Failed to send confirmation:", err.message);
  }
}

async function sendSubscriptionConfirmationWhatsApp(opts) {
  const message =
    `🎉 *Welcome to NestHR, ${opts.toName}!*\n\n` +
    `Your *${opts.planName}* plan for *${opts.companyName}* is now active.\n\n` +
    `💰 Amount Paid: *${formatCurrency(opts.amount)}*\n` +
    `🔄 Next Renewal: *${formatDate(opts.renewalDate)}*\n\n` +
    `👉 Login to your dashboard:\n${opts.dashboardUrl}\n\n` +
    `Need help? Reply to this message or email support@pixelatenest.com\n\n` +
    `— NestHR by Pixelate Nest`;

  await sendWhatsApp(opts.toPhone, message);
}

async function sendPaymentConfirmations(opts) {
  await Promise.allSettled([
    sendSubscriptionConfirmationEmail(opts),
    opts.toPhone
      ? sendSubscriptionConfirmationWhatsApp(opts)
      : Promise.resolve(),
  ]);
}

module.exports = { sendPaymentConfirmations };
