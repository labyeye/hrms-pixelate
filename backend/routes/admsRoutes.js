/**
 * ADMS push protocol handler for ESSL / ZKTeco devices (MB-20, MB-160, etc.)
 *
 * Device configuration on the MB-20:
 *   Server Mode    : ADMS
 *   Enable Domain  : ON
 *   Server Address : hrms-backend.pixelatenest.com
 *   Port           : 443
 *
 * Flow:
 *   1. Device heartbeat   → GET  /iclock/cdata?SN=<serial>
 *   2. Device push logs   → POST /iclock/cdata?SN=<serial>&table=ATTLOG
 *   3. Device poll cmds   → GET  /iclock/getrequest?SN=<serial>
 *   4. Device cmd result  → POST /iclock/devicecmd?SN=<serial>&ID=<cmdId>
 *
 * Multi-tenant: SN is matched to BiometricDevice.serialNumber → device.company
 * is the tenant. All attendance records are scoped to that company.
 */

const express = require("express");
const router = express.Router();
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const BiometricDevice = require("../models/BiometricDevice");
const BiometricCommand = require("../models/BiometricCommand");

// ── Helpers ────────────────────────────────────────────────────────────────────

function pad(n) {
  return String(n).padStart(2, "0");
}

function serverTimeStr() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

// Parse tab-separated ATTLOG pushed by device
// Format per line: USERID\tDATETIME\tSTATUS\tVERIFYTYPE\tWORKCODE\tSNO
function parseAttLog(raw) {
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const cols = line.split("\t");
      return {
        userId: cols[0]?.trim(),
        datetime: cols[1]?.trim(), // "YYYY-MM-DD HH:MM:SS"
        // 0=check-in  1=check-out  4=break-out  5=break-in
        punchState: parseInt(cols[2]?.trim() || "0", 10),
        verifyType: parseInt(cols[3]?.trim() || "1", 10), // 1=finger 4=pwd 15=face
      };
    })
    .filter((r) => r.userId && r.datetime);
}

// Upsert attendance for the day.
// Strategy: first punch of the day = checkIn, any later punch = checkOut.
// We intentionally ignore punchState because most ZKTeco MB-series devices
// send ALL punches as punchState=0 regardless of check-in vs check-out.
function mapVerifyMode(verifyType) {
  if (verifyType === 1) return "fingerprint";
  if (verifyType === 4 || verifyType === 6) return "card";
  if (verifyType === 7 || verifyType === 15) return "face";
  if (verifyType === 0 || verifyType === 3) return "password";
  return "fingerprint"; // default for unknown types from device
}

async function processLog(
  { userId, datetime, punchState, verifyType },
  companyId,
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

  // Device sends local IST time without timezone info (e.g. "2026-06-07 00:41:05").
  // Append +05:30 so the stored UTC value is correct and the browser can display IST.
  const punchTime = new Date(datetime.replace(" ", "T") + "+05:30");
  if (isNaN(punchTime.getTime())) {
    console.log(`[ADMS] Invalid datetime for userId=${userId}: "${datetime}"`);
    return;
  }

  // dayStart: store as UTC midnight of the IST date string reported by the device.
  // Using the date portion directly avoids UTC/IST boundary issues with the month filter.
  const datePart = datetime.split(" ")[0]; // "YYYY-MM-DD"
  const dayStart = new Date(datePart + "T00:00:00.000Z");

  console.log(
    `[ADMS] Punch: emp=${employee.firstName} ${employee.lastName} uid=${userId} time=${punchTime.toISOString()} punchState=${punchState}`,
  );

  const existing = await Attendance.findOne({
    employee: employee._id,
    date: dayStart,
  });

  const verifyMode = mapVerifyMode(verifyType);

  if (!existing) {
    // First punch of the day → always check-in
    await Attendance.create({
      employee: employee._id,
      date: dayStart,
      status: "present",
      checkIn: punchTime,
      verifyMode,
    });
    console.log(
      `[ADMS] Created attendance checkIn=${punchTime.toISOString()} verifyMode=${verifyMode} for ${employee.firstName}`,
    );
    return;
  }

  // Once checkOut is recorded, the day is locked — ignore any further device pushes
  if (existing.checkOut) {
    console.log(
      `[ADMS] Attendance locked (already checked out) for ${employee.firstName} ${employee.lastName}`,
    );
    return;
  }

  const upd = {};

  if (!existing.checkIn || punchTime < existing.checkIn) {
    // Earlier punch → shift checkIn earlier
    upd.checkIn = punchTime;
    upd.verifyMode = verifyMode;
  } else if (punchTime > existing.checkIn) {
    // Later punch → set checkOut (first time only, since we returned above if already set)
    upd.checkOut = punchTime;
  }

  if (Object.keys(upd).length) {
    const ci = upd.checkIn || existing.checkIn;
    const co = upd.checkOut;
    if (ci && co && co > ci) {
      upd.workHours = parseFloat(((co - ci) / 3_600_000).toFixed(2));
    }
    upd.status = "present";
    await Attendance.updateOne({ _id: existing._id }, { $set: upd });
    console.log(
      `[ADMS] Updated attendance for ${employee.firstName}: checkIn=${ci?.toISOString()} checkOut=${co?.toISOString()}`,
    );
  }
}

// Resolve BiometricDevice + company from serial number
async function resolveDevice(sn) {
  if (!sn) return null;
  return BiometricDevice.findOne({ serialNumber: sn, isActive: true });
}

// ── GET /iclock/cdata(.aspx) — heartbeat ──────────────────────────────────────
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

// ── POST /iclock/cdata(.aspx) — device pushes attendance logs ─────────────────
router.post(
  ["/cdata", "/cdata.aspx"],
  express.text({ type: "*/*" }),
  async (req, res) => {
    const { SN, table } = req.query;
    res.set("Content-Type", "text/plain");

    if (table !== "ATTLOG") return res.send("OK");

    const body = req.body;
    if (!body || typeof body !== "string") return res.send("OK");

    // Stamp from query string — device sends its current record count
    const stamp = parseInt(req.query.Stamp || "0", 10) || 0;

    try {
      const device = await resolveDevice(SN);
      const companyId = device?.company || null;

      console.log(`[ADMS] ATTLOG from SN=${SN} stamp=${stamp}`);
      console.log(`[ADMS] Raw body:\n${body}`);
      const logs = parseAttLog(body);
      console.log(`[ADMS] Parsed logs:`, JSON.stringify(logs));
      await Promise.allSettled(logs.map((log) => processLog(log, companyId)));

      // Save stamp so heartbeat returns ATTLOGStamp=N — device won't re-send old records
      if (device && stamp > (device.attlogStamp || 0)) {
        device.attlogStamp = stamp;
        device.lastSeenAt = new Date();
        await device.save();
      }

      res.send(`OK: ${stamp}`);
    } catch (err) {
      console.error("[ADMS] cdata POST error:", err.message);
      res.send("OK"); // always ACK — device retries on error response
    }
  },
);

// ── GET /iclock/getrequest(.aspx) — device polls for pending commands ─────────
router.get(["/getrequest", "/getrequest.aspx"], async (req, res) => {
  const { SN } = req.query;
  res.set("Content-Type", "text/plain");

  try {
    const device = await resolveDevice(SN);
    if (!device) return res.send("OK");

    // Fetch next pending command for this device
    const cmd = await BiometricCommand.findOneAndUpdate(
      { device: device._id, status: "pending" },
      { $set: { status: "sent", sentAt: new Date() } },
      { new: true, sort: { createdAt: 1 } },
    );

    if (!cmd) return res.send("OK");

    // ADMS command format: C:{id}:{command}\n
    res.send(`C:${cmd.cmdId}:${cmd.command}\n`);
  } catch (err) {
    console.error("[ADMS] getrequest error:", err.message);
    res.send("OK");
  }
});

// ── POST /iclock/devicecmd(.aspx) — device reports command result ─────────────
router.post(
  ["/devicecmd", "/devicecmd.aspx"],
  express.text({ type: "*/*" }),
  async (req, res) => {
    const { SN, ID } = req.query;
    res.set("Content-Type", "text/plain");

    try {
      if (ID) {
        const device = await resolveDevice(SN);
        if (device) {
          // Parse return code from body: "Return=0&CMD=DATA UPDATE USERINFO"
          const body = req.body || "";
          const returnMatch = body.match(/Return=(\d+)/);
          const returnCode = returnMatch ? returnMatch[1] : "0";

          await BiometricCommand.findOneAndUpdate(
            { device: device._id, cmdId: Number(ID) },
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
