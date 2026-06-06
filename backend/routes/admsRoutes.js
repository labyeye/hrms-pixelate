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

// Upsert attendance for the day — keeps earliest checkIn and latest checkOut
async function processLog({ userId, datetime, punchState }, companyId) {
  const employee = await Employee.findOne({
    biometricUserId: userId,
    ...(companyId ? { company: companyId } : {}),
    status: { $ne: "terminated" },
  });
  if (!employee) return;

  const punchTime = new Date(datetime.replace(" ", "T"));
  if (isNaN(punchTime.getTime())) return;

  const dayStart = new Date(punchTime);
  dayStart.setHours(0, 0, 0, 0);

  const isIn = punchState === 0 || punchState === 4;
  const isOut = punchState === 1 || punchState === 5;

  const existing = await Attendance.findOne({
    employee: employee._id,
    date: dayStart,
  });

  if (!existing) {
    const doc = { employee: employee._id, date: dayStart, status: "present" };
    if (isIn) doc.checkIn = punchTime;
    if (isOut) doc.checkOut = punchTime;
    await Attendance.create(doc);
    return;
  }

  const upd = {};
  if (isIn && (!existing.checkIn || punchTime < existing.checkIn))
    upd.checkIn = punchTime;
  if (isOut && (!existing.checkOut || punchTime > existing.checkOut))
    upd.checkOut = punchTime;

  if (upd.checkIn || upd.checkOut) {
    const ci = upd.checkIn || existing.checkIn;
    const co = upd.checkOut || existing.checkOut;
    if (ci && co && co > ci) {
      upd.workHours = parseFloat(((co - ci) / 3_600_000).toFixed(2));
    }
    upd.status = "present";
    await Attendance.updateOne({ _id: existing._id }, { $set: upd });
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

  // Register SN on device record on first contact
  if (SN) {
    BiometricDevice.findOneAndUpdate(
      { serialNumber: SN },
      { lastSeenAt: new Date() },
    ).catch(() => {});
  }

  res.send(
    [
      `GET OPTION FROM: ${SN || "DEVICE"}`,
      `ATTLOGStamp=None`,
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
router.post(["/cdata", "/cdata.aspx"], express.text({ type: "*/*" }), async (req, res) => {
  const { SN, table } = req.query;
  res.set("Content-Type", "text/plain");

  if (table !== "ATTLOG") return res.send("OK");

  const body = req.body;
  console.log(`[ADMS] ATTLOG from ${SN} | body type: ${typeof body} | length: ${body?.length ?? "N/A"} | body: ${JSON.stringify(body)}`);
  if (!body || typeof body !== "string") return res.send("OK");

  try {
    const device = await resolveDevice(SN);
    console.log(`[ADMS] device lookup for SN=${SN}:`, device ? `found (company=${device.company})` : "NOT FOUND");
    const companyId = device?.company || null;

    const logs = parseAttLog(body);
    console.log(`[ADMS] parsed ${logs.length} logs:`, JSON.stringify(logs));
    const results = await Promise.allSettled(logs.map((log) => processLog(log, companyId)));
    results.forEach((r, i) => {
      if (r.status === "rejected") console.error(`[ADMS] processLog[${i}] failed:`, r.reason?.message);
    });

    res.send("OK");
  } catch (err) {
    console.error("[ADMS] cdata POST error:", err.message);
    res.send("OK"); // always ACK — device retries on error response
  }
});

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
router.post(["/devicecmd", "/devicecmd.aspx"], express.text({ type: "*/*" }), async (req, res) => {
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
});

module.exports = router;
