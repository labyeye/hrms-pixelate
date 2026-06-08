const express = require("express");
const router = express.Router();
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const BiometricDevice = require("../models/BiometricDevice");
const BiometricCommand = require("../models/BiometricCommand");

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

  if (!existing) {
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

  if (existing.checkOut) {
    console.log(
      `[ADMS] Attendance locked (already checked out) for ${employee.firstName} ${employee.lastName}`,
    );
    return;
  }

  const upd = {};

  if (!existing.checkIn || punchTime < existing.checkIn) {
    upd.checkIn = punchTime;
    upd.verifyMode = verifyMode;
  } else if (punchTime > existing.checkIn) {
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

async function resolveDevice(sn) {
  if (!sn) return null;
  return BiometricDevice.findOne({ serialNumber: sn, isActive: true });
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

    if (table !== "ATTLOG") return res.send("OK");

    const body = req.body;
    if (!body || typeof body !== "string") return res.send("OK");

    const stamp = parseInt(req.query.Stamp || "0", 10) || 0;

    try {
      const device = await resolveDevice(SN);
      const companyId = device?.company || null;

      console.log(`[ADMS] ATTLOG from SN=${SN} stamp=${stamp}`);
      console.log(`[ADMS] Raw body:\n${body}`);
      const logs = parseAttLog(body);
      console.log(`[ADMS] Parsed logs:`, JSON.stringify(logs));
      await Promise.allSettled(logs.map((log) => processLog(log, companyId)));

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
    const device = await resolveDevice(SN);
    if (!device) return res.send("OK");

    const cmd = await BiometricCommand.findOneAndUpdate(
      { device: device._id, status: "pending" },
      { $set: { status: "sent", sentAt: new Date() } },
      { new: true, sort: { createdAt: 1 } },
    );

    if (!cmd) return res.send("OK");

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
      if (ID) {
        const device = await resolveDevice(SN);
        if (device) {
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
