const https = require("https");
const querystring = require("querystring");
const Setting = require("../models/Setting");

// Send a WhatsApp message via Twilio REST API (no extra package needed)
// eventKey: "whatsappNotifyLeave" | "whatsappNotifyPayroll" | "whatsappNotifyCheckIn" | undefined
async function sendWhatsApp(to, message, eventKey) {
  try {
    const setting = await Setting.findOne();
    if (!setting?.whatsappEnabled) return;
    // Check per-event toggle (default true if not set)
    if (eventKey && setting[eventKey] === false) return;

    const sid = setting.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
    const token = setting.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;
    const from =
      setting.twilioWhatsappFrom ||
      process.env.TWILIO_WHATSAPP_FROM ||
      "whatsapp:+14155238886";

    if (!sid || !token) return;

    // Normalize "to" number — must be whatsapp:+COUNTRYCODE...
    const toNumber = to.startsWith("whatsapp:")
      ? to
      : `whatsapp:${to.startsWith("+") ? to : `+${to}`}`;

    const body = querystring.stringify({
      From: from,
      To: toNumber,
      Body: message,
    });

    await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: "api.twilio.com",
          path: `/2010-04-01/Accounts/${sid}/Messages.json`,
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(body),
            Authorization:
              "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode >= 200 && res.statusCode < 300)
              resolve(JSON.parse(data));
            else reject(new Error(`Twilio ${res.statusCode}: ${data}`));
          });
        },
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  } catch (err) {
    // WhatsApp is a non-critical side-effect — log and continue
    console.error("[WhatsApp]", err.message);
  }
}

// ── Message templates ──────────────────────────────────────────────────────────

function leaveApprovedMsg(emp, leave) {
  const type =
    leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1);
  const from = new Date(leave.startDate).toLocaleDateString("en-IN");
  const to = new Date(leave.endDate).toLocaleDateString("en-IN");
  return `✅ Hi ${emp.firstName}, your *${type} Leave* (${from} – ${to}, ${leave.days} day(s)) has been *APPROVED*. Enjoy your time off! 🎉\n\n— NestHR`;
}

function leaveRejectedMsg(emp, leave, reason) {
  const type =
    leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1);
  return `❌ Hi ${emp.firstName}, your *${type} Leave* request has been *REJECTED*.\nReason: ${reason || "Not specified"}.\n\nPlease contact HR for more information.\n\n— NestHR`;
}

function payrollPaidMsg(emp, payroll) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const period = `${months[payroll.month - 1]} ${payroll.year}`;
  const net = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(payroll.netSalary);
  return `💰 Hi ${emp.firstName}, your salary for *${period}* of *${net}* has been processed and credited to your registered bank account.\n\nPlease check your account for the credit.\n\n— NestHR`;
}

function checkInMsg(emp, locationName, time) {
  const t = new Date(time).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `🟢 Hi ${emp.firstName}, your *Check-In* at *${locationName}* was recorded at *${t}*.\n\nHave a productive day! 💼\n\n— NestHR`;
}

function checkOutMsg(emp, locationName, time, workHours) {
  const t = new Date(time).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const hrs = workHours ? `Total hours: *${workHours.toFixed(1)}h*` : "";
  return `🔴 Hi ${emp.firstName}, your *Check-Out* at *${locationName}* was recorded at *${t}*. ${hrs}\n\nSee you tomorrow! 👋\n\n— NestHR`;
}

function leaveAppliedHRMsg(hrPhone, emp, leave) {
  const type =
    leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1);
  const from = new Date(leave.startDate).toLocaleDateString("en-IN");
  const to = new Date(leave.endDate).toLocaleDateString("en-IN");
  return `📋 *New Leave Request*\nEmployee: ${emp.firstName} ${emp.lastName} (${emp.employeeId})\nType: ${type} Leave\nDates: ${from} – ${to} (${leave.days} day(s))\nReason: ${leave.reason}\n\nPlease review in NestHR. — NestHR`;
}

module.exports = {
  sendWhatsApp,
  leaveApprovedMsg,
  leaveRejectedMsg,
  payrollPaidMsg,
  checkInMsg,
  checkOutMsg,
  leaveAppliedHRMsg,
};
