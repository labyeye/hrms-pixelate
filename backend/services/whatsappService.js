const https = require("https");
const Setting = require("../models/Setting");

// ─── Internal: send a Meta template message ──────────────────────────────────

async function sendTemplate(phone, templateName, params, lang = "en") {
  const accessToken = process.env.META_WA_TOKEN;
  const phoneNumberId = process.env.META_WA_PHONE_ID;
  console.log(
    `[WA-DEBUG] sendTemplate → phone=${phone} template=${templateName} META_WA_TOKEN=${accessToken ? "SET" : "MISSING"} META_WA_PHONE_ID=${phoneNumberId ? "SET" : "MISSING"}`,
  );
  if (!accessToken || !phoneNumberId) {
    console.warn(
      "[WA-DEBUG] ABORT: META_WA_TOKEN or META_WA_PHONE_ID not set in .env",
    );
    return;
  }

  let toNumber = phone.replace(/^\+/, "").replace(/\s/g, "");
  // Auto-add India country code for bare 10-digit numbers
  if (/^[6-9]\d{9}$/.test(toNumber)) toNumber = "91" + toNumber;
  const body = JSON.stringify({
    messaging_product: "whatsapp",
    to: toNumber,
    type: "template",
    template: {
      name: templateName,
      language: { code: lang },
      components: [
        {
          type: "body",
          parameters: params.map((v) => ({ type: "text", text: String(v) })),
        },
      ],
    },
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
}

// ─── Internal: check company WhatsApp gate ────────────────────────────────────

async function getCompanySetting(eventKey, companyId) {
  if (!companyId) {
    console.warn(`[WA-DEBUG] getCompanySetting: companyId is null/undefined`);
    return null;
  }
  const setting = await Setting.findOne({ company: companyId }).select(
    `whatsappEnabled whatsappLang ${eventKey}`,
  );
  if (!setting) {
    console.warn(
      `[WA-DEBUG] getCompanySetting: no Setting doc found for company=${companyId}`,
    );
    return null;
  }
  if (!setting.whatsappEnabled) {
    console.warn(
      `[WA-DEBUG] getCompanySetting: whatsappEnabled=false for company=${companyId} — enable it in Settings`,
    );
    return null;
  }
  if (eventKey && setting[eventKey] === false) {
    console.warn(
      `[WA-DEBUG] getCompanySetting: ${eventKey}=false for company=${companyId} — disabled in Settings`,
    );
    return null;
  }
  console.log(
    `[WA-DEBUG] getCompanySetting: OK — whatsappEnabled=true, ${eventKey}=${setting[eventKey]}`,
  );
  return setting;
}

// ─── Attendance ───────────────────────────────────────────────────────────────

/**
 * Template: neshr_checkin
 * Body:  Hi {{1}}, your Check-In at {{2}} was recorded at {{3}}. Have a productive day!
 */
async function sendCheckIn(
  phone,
  { firstName, locationName, time },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyCheckIn", companyId);
    if (!s) return;
    const t = new Date(time).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
    await sendTemplate(
      phone,
      "neshr_checkin",
      [firstName, locationName, t],
      s.whatsappLang || "en",
    );
    console.log(`[WA-DEBUG] ✅ Staff check-in message DELIVERED to ${phone}`);
  } catch (err) {
    console.error(
      `[WA-DEBUG] ❌ Staff check-in FAILED to ${phone}:`,
      err.message,
    );
  }
}

/**
 * Template: neshr_checkout
 * Body:  Hi {{1}}, your Check-Out at {{2}} was recorded at {{3}}. Total hours: {{4}}.
 */
async function sendCheckOut(
  phone,
  { firstName, locationName, time, workHours },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyCheckIn", companyId);
    if (!s) return;
    const t = new Date(time).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
    const hrs = workHours ? `${Number(workHours).toFixed(1)}h` : "-";
    await sendTemplate(
      phone,
      "neshr_checkout",
      [firstName, locationName, t, hrs],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendCheckOut:", err.message);
  }
}

// ─── Leave ────────────────────────────────────────────────────────────────────

/**
 * Template: neshr_leave_submitted
 * Body:  Hi {{1}}, your {{2}} leave request from {{3}} to {{4}} for {{5}} day(s) has been submitted and is awaiting approval from your manager.
 */
async function sendLeaveSubmitted(
  phone,
  { firstName, leaveType, startDate, endDate, days },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyLeave", companyId);
    if (!s) return;
    const type = leaveType.charAt(0).toUpperCase() + leaveType.slice(1);
    const from = new Date(startDate).toLocaleDateString("en-IN");
    const to = new Date(endDate).toLocaleDateString("en-IN");
    await sendTemplate(
      phone,
      "neshr_leave_submitted",
      [firstName, type, from, to, String(days)],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendLeaveSubmitted:", err.message);
  }
}

/**
 * Template: neshr_leave_approved
 * Body:  Hi {{1}}, your {{2}} Leave ({{3}} to {{4}}, {{5}} day(s)) has been APPROVED.
 */
async function sendLeaveApproved(
  phone,
  { firstName, leaveType, startDate, endDate, days },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyLeave", companyId);
    if (!s) return;
    const type = leaveType.charAt(0).toUpperCase() + leaveType.slice(1);
    const from = new Date(startDate).toLocaleDateString("en-IN");
    const to = new Date(endDate).toLocaleDateString("en-IN");
    await sendTemplate(
      phone,
      "neshr_leave_approved",
      [firstName, type, from, to, String(days)],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendLeaveApproved:", err.message);
  }
}

/**
 * Template: neshr_leave_rejected
 * Body:  Hi {{1}}, your {{2}} Leave request has been REJECTED. Reason: {{3}}.
 */
async function sendLeaveRejected(
  phone,
  { firstName, leaveType, reason },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyLeave", companyId);
    if (!s) return;
    const type = leaveType.charAt(0).toUpperCase() + leaveType.slice(1);
    await sendTemplate(
      phone,
      "neshr_leave_rejected",
      [firstName, type, reason || "Not specified"],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendLeaveRejected:", err.message);
  }
}

/**
 * Template: neshr_leave_request_hr
 * Body:  New Leave Request — Employee: {{1}} ({{2}}), Type: {{3}}, Dates: {{4}} to {{5}} ({{6}} day(s)), Reason: {{7}}.
 */
async function sendLeaveAppliedHR(
  phone,
  { empName, empId, leaveType, startDate, endDate, days, reason },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyLeave", companyId);
    if (!s) return;
    const type = leaveType.charAt(0).toUpperCase() + leaveType.slice(1);
    const from = new Date(startDate).toLocaleDateString("en-IN");
    const to = new Date(endDate).toLocaleDateString("en-IN");
    await sendTemplate(
      phone,
      "neshr_leave_request_hr",
      [empName, empId, type, from, to, String(days), reason || "-"],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendLeaveAppliedHR:", err.message);
  }
}

// ─── Attendance (HR copy) ─────────────────────────────────────────────────────

/**
 * Template: neshr_checkin_hr
 * Body:  Employee {{1}} (ID: {{2}}) checked in at {{3}} at {{4}}.
 */
async function sendCheckInHR(
  phone,
  { empName, empId, locationName, time },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyCheckIn", companyId);
    if (!s) return;
    const t = new Date(time).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
    await sendTemplate(
      phone,
      "neshr_checkin_hr",
      [empName, empId, locationName, t],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendCheckInHR:", err.message);
  }
}

/**
 * Template: neshr_checkout_hr
 * Body:  Employee {{1}} (ID: {{2}}) checked out at {{3}} at {{4}}. Total hours: {{5}}.
 */
async function sendCheckOutHR(
  phone,
  { empName, empId, locationName, time, workHours },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyCheckIn", companyId);
    if (!s) return;
    const t = new Date(time).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
    const hrs = workHours ? `${Number(workHours).toFixed(1)}h` : "-";
    await sendTemplate(
      phone,
      "neshr_checkout_hr",
      [empName, empId, locationName, t, hrs],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendCheckOutHR:", err.message);
  }
}

// ─── Payroll ──────────────────────────────────────────────────────────────────

/**
 * Template: neshr_salary_paid
 * Body:  Hi {{1}}, your salary for {{2}} of {{3}} has been processed and credited to your bank account.
 */
async function sendSalaryPaid(
  phone,
  { firstName, period, netSalary },
  companyId,
) {
  try {
    const s = await getCompanySetting("whatsappNotifyPayroll", companyId);
    if (!s) return;
    const amt = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(netSalary);
    await sendTemplate(
      phone,
      "neshr_salary_paid",
      [firstName, period, amt],
      s.whatsappLang || "en",
    );
  } catch (err) {
    console.error("[WhatsApp] sendSalaryPaid:", err.message);
  }
}

// ─── Attendance Status Notification (single template for all statuses) ────────

const ATTENDANCE_STATUS_LABELS = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half Day",
};

/**
 * Template: neshr_attendance_status  (ONE template handles all 4 statuses)
 * Body:  Hi {{1}}, your attendance for {{2}} has been marked as *{{3}}*.
 *
 * Params: [firstName, date (DD/MM/YYYY), statusLabel]
 * statusLabel is one of: Present | Absent | Late | Half Day
 *
 * Triggered on: markAttendance and updateAttendance for statuses
 * present / late / absent / half_day.
 * Holiday, weekend, on_leave do NOT trigger this notification.
 */
async function sendAttendanceStatus(
  phone,
  { firstName, date, status },
  companyId,
) {
  const statusLabel = ATTENDANCE_STATUS_LABELS[status];
  if (!statusLabel) return; // skip holiday / weekend / on_leave
  try {
    const s = await getCompanySetting("whatsappNotifyCheckIn", companyId);
    if (!s) return;
    const d = new Date(date).toLocaleDateString("en-IN");
    await sendTemplate(
      phone,
      "neshr_attendance_status",
      [firstName, d, statusLabel],
      s.whatsappLang || "en",
    );
    console.log(
      `[WA-DEBUG] ✅ Attendance status (${statusLabel}) sent to ${phone}`,
    );
  } catch (err) {
    console.error("[WhatsApp] sendAttendanceStatus:", err.message);
  }
}

// ─── Phone OTP Login (no per-company gate) ───────────────────────────────────

/**
 * Template: neshr_otp
 * Body:  {{1}} is your NestHR login OTP. It expires in 10 minutes. Do not share this code.
 */
async function sendPhoneOtp(phone, { otp }) {
  const accessToken = process.env.META_WA_TOKEN;
  const phoneNumberId = process.env.META_WA_PHONE_ID;
  if (!accessToken || !phoneNumberId) {
    console.warn("[WA-DEBUG] ABORT: META_WA_TOKEN or META_WA_PHONE_ID not set");
    return;
  }

  let toNumber = phone.replace(/^\+/, "").replace(/\s/g, "");
  if (/^[6-9]\d{9}$/.test(toNumber)) toNumber = "91" + toNumber;

  // Authentication templates require body + button components with the OTP
  const body = JSON.stringify({
    messaging_product: "whatsapp",
    to: toNumber,
    type: "template",
    template: {
      name: "neshr_otp",
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: String(otp) }],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: String(otp) }],
        },
      ],
    },
  });

  try {
    await new Promise((resolve, reject) => {
      const req = require("https").request(
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
    console.log(`[WA-DEBUG] ✅ OTP sent to ${phone}`);
  } catch (err) {
    console.error(`[WA-DEBUG] ❌ OTP FAILED to ${phone}:`, err.message);
    throw err;
  }
}

// ─── NestHR Billing (no per-company gate) ────────────────────────────────────

/**
 * Template: neshr_subscription
 * Body:  Welcome {{1}}! Your {{2}} plan for {{3}} is active. Amount: {{4}}, Renewal: {{5}}. Login: {{6}}
 */
async function sendSubscriptionWA(
  phone,
  { toName, planName, companyName, amount, renewalDate, dashboardUrl },
) {
  try {
    const amt =
      typeof amount === "number"
        ? new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
          }).format(amount)
        : String(amount);
    const renewal = new Date(renewalDate).toLocaleDateString("en-IN");
    await sendTemplate(phone, "neshr_subscription", [
      toName,
      planName,
      companyName,
      amt,
      renewal,
      dashboardUrl,
    ]);
  } catch (err) {
    console.error("[WhatsApp] sendSubscriptionWA:", err.message);
  }
}

module.exports = {
  sendPhoneOtp,
  sendCheckIn,
  sendCheckOut,
  sendCheckInHR,
  sendCheckOutHR,
  sendLeaveSubmitted,
  sendLeaveApproved,
  sendLeaveRejected,
  sendLeaveAppliedHR,
  sendAttendanceStatus,
  sendSalaryPaid,
  sendSubscriptionWA,
};
