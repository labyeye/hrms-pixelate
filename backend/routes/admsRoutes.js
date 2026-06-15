const express = require("express");
const router = express.Router();
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const BiometricDevice = require("../models/BiometricDevice");
const BiometricCommand = require("../models/BiometricCommand");
const Shift = require("../models/Shift");
const User = require("../models/User");
const { getEffectiveCheckOut } = require("../utils/shiftUtils");
const { sendCheckIn, sendCheckInHR, sendCheckOut, sendCheckOutHR } = require("../services/whatsappService");

const GRACE_MINUTES = 15;
const HALF_DAY_MINUTES = 120;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

async function resolveAttendanceStatus(employee, checkIn) {
  if (!checkIn) return "present";
  const shiftId = employee.shift;
  if (!shiftId) return "present";
  const shift = await Shift.findById(shiftId).select("startTime");
  if (!shift?.startTime) return "present";
  const [h, m] = shift.startTime.split(":").map(Number);
  const shiftStartMins = h * 60 + m;
  const ist = new Date(new Date(checkIn).getTime() + IST_OFFSET_MS);
  const checkInMins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const minutesLate = checkInMins - shiftStartMins;
  if (minutesLate > HALF_DAY_MINUTES) return "half_day";
  if (minutesLate > GRACE_MINUTES) return "late";
  return "present";
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function serverTimeStr() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function parseAttLog(raw) {
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const cols = line.split("\t");
      return {
        userId: cols[0]?.trim(),
        datetime: cols[1]?.trim(),

        punchState: parseInt(cols[2]?.trim() || "0", 10),
        verifyType: parseInt(cols[3]?.trim() || "1", 10),
      };
    })
    .filter((r) => r.userId && r.datetime);
}

function mapVerifyMode(verifyType) {
  if (verifyType === 1) return "fingerprint";
  if (verifyType === 4 || verifyType === 6) return "card";
  if (verifyType === 7 || verifyType === 15) return "face";
  if (verifyType === 0 || verifyType === 3) return "password";
  return "fingerprint";
}

async function notifyCheckIn(employee, locationName, time, companyId) {
  console.log(`[WA-DEBUG] notifyCheckIn called — emp=${employee.firstName} phone=${employee.phone || "MISSING"} companyId=${companyId}`);
  try {
    const empFullName = `${employee.firstName} ${employee.lastName}`;
    const hrUsers = await User.find({
      company: companyId,
      role: { $in: ["super_admin", "hr_manager"] },
    }).select("phone name");
    console.log(`[WA-DEBUG] HR users found: ${hrUsers.length} — phones: ${hrUsers.map(h => h.phone || "MISSING").join(", ")}`);

    if (employee.phone) {
      console.log(`[WA-DEBUG] Sending check-in WA to staff: ${employee.phone}`);
      await sendCheckIn(employee.phone, { firstName: employee.firstName, locationName, time }, companyId);
      console.log(`[WA-DEBUG] Staff check-in WA sent OK`);
    } else {
      console.warn(`[WA-DEBUG] SKIP staff check-in WA — employee.phone is empty`);
    }

    for (const hr of hrUsers) {
      if (hr.phone) {
        console.log(`[WA-DEBUG] Sending check-in WA to HR/admin: ${hr.phone}`);
        await sendCheckInHR(hr.phone, { empName: empFullName, empId: employee.employeeId, locationName, time }, companyId);
      } else {
        console.warn(`[WA-DEBUG] SKIP HR check-in WA — hr.phone is empty for user ${hr._id}`);
      }
    }
  } catch (err) {
    console.error("[WA-DEBUG] notifyCheckIn ERROR:", err.message);
  }
}

async function notifyCheckOut(employee, locationName, time, workHours, companyId) {
  console.log(`[WA-DEBUG] notifyCheckOut called — emp=${employee.firstName} phone=${employee.phone || "MISSING"} companyId=${companyId}`);
  try {
    const empFullName = `${employee.firstName} ${employee.lastName}`;
    const hrUsers = await User.find({
      company: companyId,
      role: { $in: ["super_admin", "hr_manager"] },
    }).select("phone name");
    console.log(`[WA-DEBUG] HR users found: ${hrUsers.length} — phones: ${hrUsers.map(h => h.phone || "MISSING").join(", ")}`);

    if (employee.phone) {
      console.log(`[WA-DEBUG] Sending check-out WA to staff: ${employee.phone}`);
      await sendCheckOut(employee.phone, { firstName: employee.firstName, locationName, time, workHours }, companyId);
    } else {
      console.warn(`[WA-DEBUG] SKIP staff check-out WA — employee.phone is empty`);
    }

    for (const hr of hrUsers) {
      if (hr.phone) {
        console.log(`[WA-DEBUG] Sending check-out WA to HR/admin: ${hr.phone}`);
        await sendCheckOutHR(hr.phone, { empName: empFullName, empId: employee.employeeId, locationName, time, workHours }, companyId);
      } else {
        console.warn(`[WA-DEBUG] SKIP HR check-out WA — hr.phone is empty for user ${hr._id}`);
      }
    }
  } catch (err) {
    console.error("[WA-DEBUG] notifyCheckOut ERROR:", err.message);
  }
}

async function processLog(
  { userId, datetime, punchState, verifyType },
  companyId,
  locationName,
) {
  const employee = await Employee.findOne({
    biometricUserId: userId,
    ...(companyId ? { company: companyId } : {}),
    status: { $ne: "terminated" },
  });
  if (!employee) {
    console.log(
      `[ADMS] No employee found for biometricUserId=${userId} company=${companyId}`,
    );
    return;
  }

  const punchTime = new Date(datetime.replace(" ", "T") + "+05:30");
  if (isNaN(punchTime.getTime())) {
    console.log(`[ADMS] Invalid datetime for userId=${userId}: "${datetime}"`);
    return;
  }

  const datePart = datetime.split(" ")[0];
  const dayStart = new Date(datePart + "T00:00:00.000Z");

  console.log(
    `[ADMS] Punch: emp=${employee.firstName} ${employee.lastName} uid=${userId} time=${punchTime.toISOString()} punchState=${punchState}`,
  );

  const existing = await Attendance.findOne({
    employee: employee._id,
    date: dayStart,
  });

  const verifyMode = mapVerifyMode(verifyType);
  const loc = locationName || "Office";

  if (!existing) {
    const status = await resolveAttendanceStatus(employee, punchTime);
    await Attendance.create({
      employee: employee._id,
      date: dayStart,
      status,
      checkIn: punchTime,
      verifyMode,
    });
    console.log(
      `[ADMS] Created attendance checkIn=${punchTime.toISOString()} status=${status} verifyMode=${verifyMode} for ${employee.firstName}`,
    );
    await notifyCheckIn(employee, loc, punchTime, companyId);
    return;
  }

  if (existing.checkOut) {
    console.log(
      `[ADMS] Attendance locked (already checked out) for ${employee.firstName} ${employee.lastName}`,
    );
    return;
  }

  const upd = {};
  let logType = null;

  if (!existing.checkIn || punchTime < existing.checkIn) {
    upd.checkIn = punchTime;
    upd.verifyMode = verifyMode;
    upd.status = await resolveAttendanceStatus(employee, punchTime);
    logType = "check_in";
  } else if (punchTime > existing.checkIn) {
    upd.checkOut = await getEffectiveCheckOut(
      companyId,
      employee._id,
      punchTime,
    );
    logType = "check_out";
  }

  if (Object.keys(upd).length) {
    const ci = upd.checkIn || existing.checkIn;
    const co = upd.checkOut;
    if (ci && co && co > ci) {
      upd.workHours = parseFloat(((co - ci) / 3_600_000).toFixed(2));
    }
    if (!upd.status) upd.status = existing.status || "present";
    await Attendance.updateOne({ _id: existing._id }, { $set: upd });
    console.log(
      `[ADMS] Updated attendance for ${employee.firstName}: checkIn=${ci?.toISOString()} checkOut=${co?.toISOString()} status=${upd.status}`,
    );
    if (logType === "check_in") {
      await notifyCheckIn(employee, loc, upd.checkIn, companyId);
    } else if (logType === "check_out") {
      await notifyCheckOut(employee, loc, upd.checkOut, upd.workHours, companyId);
    }
  }
}

async function resolveDevice(sn) {
  if (!sn) return null;
  // Find by SN regardless of isActive — if the device is polling, it IS active.
  // Auto-heal isActive so admin routes also see it correctly.
  return BiometricDevice.findOneAndUpdate(
    { serialNumber: sn },
    { $set: { isActive: true, lastSeenAt: new Date() } },
    { new: true },
  );
}

router.get(["/cdata", "/cdata.aspx"], async (req, res) => {
  const { SN } = req.query;
  res.set("Content-Type", "text/plain");

  let attlogStamp = "None";
  if (SN) {
    const device = await BiometricDevice.findOneAndUpdate(
      { serialNumber: SN },
      { lastSeenAt: new Date() },
      { new: true },
    ).catch(() => null);
    if (device?.attlogStamp) attlogStamp = device.attlogStamp;
  }

  res.send(
    [
      `GET OPTION FROM: ${SN || "DEVICE"}`,
      `ATTLOGStamp=${attlogStamp}`,
      `OPERLOGStamp=9999`,
      `ATTPHOTOStamp=None`,
      `ErrorDelay=30`,
      `Delay=10`,
      `TransTimes=00:00;23:59`,
      `TransInterval=1`,
      `TransFlag=111100000001000`,
      `Realtime=1`,
      `Encrypt=0`,
      `ServerVer=2.4.1`,
      `PushProtVer=2.4.1`,
      `PushOptionsFlag=1`,
      `datetime=${serverTimeStr()}`,
      ``,
    ].join("\n"),
  );
});

router.post(
  ["/cdata", "/cdata.aspx"],
  express.text({ type: "*/*" }),
  async (req, res) => {
    const { SN, table } = req.query;
    res.set("Content-Type", "text/plain");

    const body = req.body;
    if (!body || typeof body !== "string") return res.send("OK");

    // Handle face/finger bio template upload from device after ENROLL_BIO command
    if (table === "BIODATA") {
      try {
        const device = await resolveDevice(SN);
        console.log(
          `[ADMS] BIODATA from SN=${SN} body="${body.slice(0, 200)}"`,
        );

        if (device) {
          // Parse PIN= from the body to identify employee
          const pinMatch = body.match(/\bPIN=(\S+)/);
          const typeMatch = body.match(/\bType=(\d+)/);
          const pin = pinMatch ? pinMatch[1] : null;
          const biotype = typeMatch ? parseInt(typeMatch[1], 10) : null;

          if (pin && biotype === 9) {
            // Type=9 = face template on ZKTeco ZLM60
            const Employee = require("../models/Employee");
            const employee = await Employee.findOne({
              biometricUserId: pin,
              company: device.company,
            });
            if (employee) {
              employee.deviceFaceTemplate = Buffer.from(body).toString("hex");
              employee.deviceFaceEnrolledAt = new Date();
              await employee.save();
              console.log(
                `[ADMS] BIODATA: stored face template for emp ${employee.firstName} ${employee.lastName} (PIN=${pin})`,
              );
            } else {
              console.warn(
                `[ADMS] BIODATA: no employee found for PIN=${pin} company=${device.company}`,
              );
            }
          }
        }
      } catch (err) {
        console.error("[ADMS] BIODATA handler error:", err.message);
      }
      return res.send("OK");
    }

    if (table !== "ATTLOG") return res.send("OK");

    const stamp = parseInt(req.query.Stamp || "0", 10) || 0;

    try {
      const device = await resolveDevice(SN);
      const companyId = device?.company || null;

      console.log(`[ADMS] ATTLOG from SN=${SN} stamp=${stamp}`);
      console.log(`[ADMS] Raw body:\n${body}`);
      const logs = parseAttLog(body);
      console.log(`[ADMS] Parsed logs:`, JSON.stringify(logs));

      let devLocationName = "Office";
      if (device?.location) {
        const BiometricLocation = require("../models/BiometricLocation");
        const loc = await BiometricLocation.findById(device.location).select("name");
        if (loc?.name) devLocationName = loc.name;
      }

      await Promise.allSettled(logs.map((log) => processLog(log, companyId, devLocationName)));

      if (device && stamp > (device.attlogStamp || 0)) {
        device.attlogStamp = stamp;
        device.lastSeenAt = new Date();
        await device.save();
      }

      res.send(`OK: ${stamp}`);
    } catch (err) {
      console.error("[ADMS] cdata POST error:", err.message);
      res.send("OK");
    }
  },
);

router.get(["/getrequest", "/getrequest.aspx"], async (req, res) => {
  const { SN } = req.query;
  res.set("Content-Type", "text/plain");

  try {
    if (!SN) {
      console.warn("[ADMS] getrequest: no SN in query");
      return res.send("OK");
    }

    const device = await resolveDevice(SN);
    if (!device) {
      console.warn(`[ADMS] getrequest: unknown device SN=${SN}`);
      return res.send("OK");
    }

    const cmd = await BiometricCommand.findOneAndUpdate(
      { device: device._id, status: "pending" },
      { $set: { status: "sent", sentAt: new Date() } },
      { new: true, sort: { createdAt: 1 } },
    );

    if (!cmd) {
      // Normal quiet poll — no command queued
      return res.send("OK");
    }

    console.log(
      `[ADMS] getrequest: SN=${SN} → C:${cmd.cmdId}:${cmd.command.replace(/\t/g, "\\t")}`,
    );
    res.send(`C:${cmd.cmdId}:${cmd.command}\n`);
  } catch (err) {
    console.error("[ADMS] getrequest error:", err.message);
    res.send("OK");
  }
});

router.post(
  ["/devicecmd", "/devicecmd.aspx"],
  express.text({ type: "*/*" }),
  async (req, res) => {
    const { SN, ID } = req.query;
    res.set("Content-Type", "text/plain");

    try {
      const body = req.body || "";
      // ID may come in the query string OR in the POST body (firmware-dependent)
      const bodyIdMatch = body.match(/\bID=(\d+)/);
      const cmdId = ID || (bodyIdMatch ? bodyIdMatch[1] : null);

      console.log(
        `[ADMS] devicecmd SN=${SN} ID=${cmdId} body="${body.trim()}"`,
      );

      if (cmdId) {
        const device = await resolveDevice(SN);
        if (device) {
          const returnMatch = body.match(/Return=(\d+)/);
          const returnCode = returnMatch ? returnMatch[1] : "0";

          await BiometricCommand.findOneAndUpdate(
            { device: device._id, cmdId: Number(cmdId) },
            {
              $set: {
                status: returnCode === "0" ? "done" : "failed",
                returnCode,
                doneAt: new Date(),
              },
            },
          );
        }
      }
    } catch (err) {
      console.error("[ADMS] devicecmd error:", err.message);
    }

    res.send("OK");
  },
);

module.exports = router;
