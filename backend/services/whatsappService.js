const https = require("https");
const Setting = require("../models/Setting");

async function sendWhatsApp(to, message, eventKey, companyId) {
  try {
    const setting = await Setting.findOne({ company: companyId });
    if (!setting?.whatsappEnabled) return;
    if (eventKey && setting[eventKey] === false) return;

    const accessToken = setting.metaAccessToken;
    const phoneNumberId = setting.metaPhoneNumberId;
    if (!accessToken || !phoneNumberId) return;

    const toNumber = to.replace(/^\+/, "").replace(/\s/g, "");

    const body = JSON.stringify({
      messaging_product: "whatsapp",
      to: toNumber,
      type: "text",
      text: { preview_url: false, body: message },
    });

    await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: "graph.facebook.com",
          path: `/v20.0/${phoneNumberId}/messages`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
            Authorization: `Bearer ${accessToken}`,
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode >= 200 && res.statusCode < 300)
              resolve(JSON.parse(data));
            else reject(new Error(`Meta API ${res.statusCode}: ${data}`));
          });
        },
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  } catch (err) {
    console.error("[WhatsApp]", err.message);
  }
}

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
