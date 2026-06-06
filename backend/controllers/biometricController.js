const asyncHandler = require("express-async-handler");
const BiometricLocation = require("../models/BiometricLocation");
const BiometricDevice = require("../models/BiometricDevice");
const BiometricCommand = require("../models/BiometricCommand");
const BiometricLog = require("../models/BiometricLog");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const { isHolidayDate } = require("./holidayController");
const {
  sendWhatsApp,
  checkInMsg,
  checkOutMsg,
} = require("../services/whatsappService");

// ─── ADMS Command helpers ─────────────────────────────────────────────────────

// Build the raw ADMS userinfo command string for an employee
function buildSetUserCmd(employee) {
  const uid = employee.biometricUserId;
  // Strip control characters (tabs, newlines, etc.) that would break the protocol,
  // then trim and fall back to biometricUserId so Name= is never blank on the device.
  const rawName = `${employee.firstName || ""} ${employee.lastName || ""}`;
  const name = (
    rawName.replace(/[\x00-\x1F\x7F]/g, " ").trim() || `User-${uid}`
  ).slice(0, 24);
  const card = (employee.rfidCard || "").replace(/[\x00-\x1F\x7F]/g, "");
  // Fields are tab-separated; trailing tab required
  return `DATA UPDATE USERINFO PIN=${uid}\tName=${name}\tPri=0\tPasswd=\tCard=${card}\tGrp=1\tTZ=1\tVerify=0\t`;
}

async function nextCmdId(deviceId) {
  const last = await BiometricCommand.findOne({ device: deviceId })
    .sort({ cmdId: -1 })
    .select("cmdId");
  return (last?.cmdId || 0) + 1;
}

// ─── Locations ────────────────────────────────────────────────────────────────

const getLocations = asyncHandler(async (req, res) => {
  const locations = await BiometricLocation.find({
    company: req.user.company,
  }).sort({ createdAt: -1 });
  res.json({ success: true, data: locations });
});

const createLocation = asyncHandler(async (req, res) => {
  const { name, address, description } = req.body;
  if (!name) {
    res.status(400);
    throw new Error("Location name is required");
  }
  const location = await BiometricLocation.create({
    company: req.user.company,
    name,
    address,
    description,
  });
  res.status(201).json({ success: true, data: location });
});

const updateLocation = asyncHandler(async (req, res) => {
  const location = await BiometricLocation.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!location) {
    res.status(404);
    throw new Error("Location not found");
  }
  const { name, address, description, isActive } = req.body;
  if (name !== undefined) location.name = name;
  if (address !== undefined) location.address = address;
  if (description !== undefined) location.description = description;
  if (isActive !== undefined) location.isActive = isActive;
  await location.save();
  res.json({ success: true, data: location });
});

const deleteLocation = asyncHandler(async (req, res) => {
  const location = await BiometricLocation.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!location) {
    res.status(404);
    throw new Error("Location not found");
  }
  await BiometricDevice.updateMany(
    { location: location._id },
    { isActive: false },
  );
  await location.deleteOne();
  res.json({ success: true, message: "Location deleted" });
});

// ─── Devices ──────────────────────────────────────────────────────────────────

const getDevices = asyncHandler(async (req, res) => {
  const devices = await BiometricDevice.find({ company: req.user.company })
    .populate("location", "name address")
    .populate("nfcCards.employee", "firstName lastName employeeId")
    .sort({ createdAt: -1 });
  res.json({ success: true, data: devices });
});

const createDevice = asyncHandler(async (req, res) => {
  const { name, location } = req.body;
  if (!name || !location) {
    res.status(400);
    throw new Error("Name and location are required");
  }
  const loc = await BiometricLocation.findOne({
    _id: location,
    company: req.user.company,
  });
  if (!loc) {
    res.status(404);
    throw new Error("Location not found");
  }
  const device = await BiometricDevice.create({
    company: req.user.company,
    location,
    name,
  });
  await device.populate("location", "name address");
  res.status(201).json({ success: true, data: device });
});

const updateDevice = asyncHandler(async (req, res) => {
  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  const { name, isActive } = req.body;
  if (name !== undefined) device.name = name;
  if (isActive !== undefined) device.isActive = isActive;
  await device.save();
  res.json({ success: true, data: device });
});

const deleteDevice = asyncHandler(async (req, res) => {
  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  await device.deleteOne();
  res.json({ success: true, message: "Device deleted" });
});

const regenerateDeviceToken = asyncHandler(async (req, res) => {
  const crypto = require("crypto");
  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  device.deviceToken = crypto.randomBytes(32).toString("hex");
  device.activationCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  device.activated = false;
  device.activatedAt = undefined;
  await device.save();
  res.json({
    success: true,
    data: {
      deviceToken: device.deviceToken,
      activationCode: device.activationCode,
    },
  });
});

// ─── NFC Cards ────────────────────────────────────────────────────────────────

const assignNfcCard = asyncHandler(async (req, res) => {
  const { uid, employeeId, label } = req.body;
  if (!uid || !employeeId) {
    res.status(400);
    throw new Error("NFC UID and employee ID are required");
  }

  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }

  const employee = await Employee.findOne({
    _id: employeeId,
    company: req.user.company,
  });
  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
  }

  // Check if UID already assigned on ANY device in this company
  const existingDevice = await BiometricDevice.findOne({
    company: req.user.company,
    "nfcCards.uid": uid,
  });
  if (existingDevice) {
    res.status(400);
    throw new Error("This NFC card UID is already assigned");
  }

  if (device.nfcCards.length >= 10) {
    res.status(400);
    throw new Error("Maximum 10 NFC cards per device");
  }

  device.nfcCards.push({ uid, employee: employeeId, label });
  await device.save();
  await device.populate("nfcCards.employee", "firstName lastName employeeId");
  res.json({ success: true, data: device });
});

const removeNfcCard = asyncHandler(async (req, res) => {
  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  device.nfcCards = device.nfcCards.filter((c) => c.uid !== req.params.uid);
  await device.save();
  res.json({ success: true, data: device });
});

// ─── Device Registration (hardware device / agent calls this once) ───────────

const registerDevice = asyncHandler(async (req, res) => {
  const { activationCode, model, mac, ip } = req.body;
  if (!activationCode) {
    res.status(400);
    throw new Error("activationCode is required");
  }

  const device = await BiometricDevice.findOne({
    activationCode: activationCode.toUpperCase().trim(),
    isActive: true,
  }).populate("location", "name address");

  if (!device) {
    res.status(404);
    throw new Error("Invalid activation code");
  }

  // Mark activated and store device metadata
  device.activated = true;
  device.activatedAt = new Date();
  device.lastSeenAt = new Date();
  if (model) device.deviceMeta.model = model;
  if (mac) device.deviceMeta.mac = mac;
  if (ip) device.deviceMeta.ip = ip;
  await device.save();

  res.json({
    success: true,
    data: {
      deviceToken: device.deviceToken,
      deviceName: device.name,
      location: device.location?.name,
      nfcUids: device.nfcCards.map((c) => c.uid),
    },
  });
});

// ─── Device Public Endpoint (no user auth — uses device token) ────────────────

const getDeviceInfo = asyncHandler(async (req, res) => {
  const device = await BiometricDevice.findOne({
    deviceToken: req.params.token,
    isActive: true,
  })
    .populate("location", "name address")
    .populate("nfcCards.employee", "firstName lastName employeeId");
  if (!device) {
    res.status(404);
    throw new Error("Device not found or inactive");
  }
  device.lastSeenAt = new Date();
  await device.save();
  // Only expose NFC UIDs needed for matching — do NOT expose employee names/IDs to the device
  res.json({
    success: true,
    data: {
      _id: device._id,
      name: device.name,
      location: device.location,
      nfcUids: device.nfcCards.map((c) => c.uid),
    },
  });
});

const recordBiometric = asyncHandler(async (req, res) => {
  const { deviceToken, method, nfcUid, employeeId, type } = req.body;
  // type: check_in | check_out

  const device = await BiometricDevice.findOne({
    deviceToken,
    isActive: true,
  }).populate("location");
  if (!device) {
    res.status(404);
    throw new Error("Device not found or inactive");
  }

  let employee;

  if (method === "nfc") {
    if (!nfcUid) {
      res.status(400);
      throw new Error("NFC UID is required");
    }
    const card = device.nfcCards.find((c) => c.uid === nfcUid);
    if (!card) {
      res.status(404);
      throw new Error("NFC card not registered on this device");
    }
    employee = await Employee.findById(card.employee).select(
      "firstName lastName employeeId phone",
    );
  } else if (method === "pin" || method === "face") {
    if (!employeeId) {
      res.status(400);
      throw new Error("Employee ID is required");
    }
    employee = await Employee.findOne({
      _id: employeeId,
      company: device.company,
    }).select("firstName lastName employeeId phone");
    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }
  } else {
    res.status(400);
    throw new Error("Invalid method");
  }

  // Auto-determine check_in / check_out if not provided
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Check if today is a company holiday
  const holiday = await isHolidayDate(device.company, today);

  let logType = type;
  if (!logType) {
    const existingLog = await BiometricLog.findOne({
      employee: employee._id,
      timestamp: { $gte: today },
    }).sort({ timestamp: -1 });
    logType = existingLog?.type === "check_in" ? "check_out" : "check_in";
  }

  // Update attendance — mark as holiday if applicable
  const attendanceUpdate = {
    employee: employee._id,
    date: today,
    markedBy: null,
  };

  if (holiday) {
    attendanceUpdate.status = "holiday";
    attendanceUpdate.notes = `Holiday: ${holiday.name}`;
  } else if (logType === "check_in") {
    attendanceUpdate.checkIn = now;
    attendanceUpdate.status = now.getHours() >= 10 ? "late" : "present";
  } else {
    const existing = await Attendance.findOne({
      employee: employee._id,
      date: today,
    });
    if (existing?.checkIn) {
      attendanceUpdate.checkOut = now;
      attendanceUpdate.workHours = (now - existing.checkIn) / 3600000;
    }
  }

  const attendance = await Attendance.findOneAndUpdate(
    { employee: employee._id, date: today },
    { $set: attendanceUpdate },
    { upsert: true, new: true },
  );

  const log = await BiometricLog.create({
    company: device.company,
    employee: employee._id,
    device: device._id,
    location: device.location._id,
    method,
    type: logType,
    nfcUid: method === "nfc" ? nfcUid : undefined,
    attendance: attendance._id,
    timestamp: now,
  });

  device.lastSeenAt = now;
  await device.save();

  if (employee.phone) {
    try {
      if (logType === "check_in") {
        await sendWhatsApp(
          employee.phone,
          checkInMsg(employee, device.location.name, now),
          "whatsappNotifyCheckIn",
          device.company,
        );
      } else {
        await sendWhatsApp(
          employee.phone,
          checkOutMsg(
            employee,
            device.location.name,
            now,
            attendanceUpdate.workHours,
          ),
          "whatsappNotifyCheckIn",
          device.company,
        );
      }
    } catch {}
  }

  res.json({
    success: true,
    data: {
      employee: {
        name: `${employee.firstName} ${employee.lastName}`,
        employeeId: employee.employeeId,
      },
      type: logType,
      timestamp: now,
      location: device.location.name,
      attendance,
      holiday: holiday ? holiday.name : null,
    },
  });
});

// ─── Logs ─────────────────────────────────────────────────────────────────────

const getLogs = asyncHandler(async (req, res) => {
  const { safePagination } = require("../middleware/validate");
  const { page, limit, skip } = safePagination(req.query, 50, 200);
  const { locationId, deviceId, employeeId, date } = req.query;

  const filter = { company: req.user.company };
  if (locationId) filter.location = locationId;
  if (deviceId) filter.device = deviceId;
  if (employeeId) filter.employee = employeeId;
  if (date) {
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      filter.timestamp = { $gte: d, $lte: end };
    }
  }

  const total = await BiometricLog.countDocuments(filter);
  const logs = await BiometricLog.find(filter)
    .populate("employee", "firstName lastName employeeId")
    .populate("device", "name")
    .populate("location", "name")
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: logs,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

// ─── Device serial number registration ───────────────────────────────────────

// PUT /api/biometric/devices/:id/serial  { serialNumber: "AB12345678" }
// Called once by admin after adding the device record — links the ADMS SN to DB
const setDeviceSerial = asyncHandler(async (req, res) => {
  const { serialNumber } = req.body;
  if (!serialNumber) {
    res.status(400);
    throw new Error("serialNumber is required");
  }
  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  // Ensure no other device in ANY company uses this SN
  const conflict = await BiometricDevice.findOne({
    serialNumber,
    _id: { $ne: device._id },
  });
  if (conflict) {
    res.status(400);
    throw new Error("Serial number already registered to another device");
  }
  device.serialNumber = serialNumber.trim().toUpperCase();
  await device.save();
  res.json({ success: true, data: device });
});

// ─── Sync employee → device via ADMS command queue ───────────────────────────

// POST /api/biometric/devices/:id/sync-employee
// Body: { employeeId, rfidCard }  (rfidCard optional — scanned via USB reader)
const syncEmployeeToDevice = asyncHandler(async (req, res) => {
  const { employeeId, rfidCard } = req.body;
  if (!employeeId) {
    res.status(400);
    throw new Error("employeeId is required");
  }

  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  if (!device.serialNumber) {
    res.status(400);
    throw new Error("Device has no serial number set — register it first");
  }

  const employee = await Employee.findOne({
    _id: employeeId,
    company: req.user.company,
  });
  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
  }
  if (!employee.biometricUserId) {
    res.status(400);
    throw new Error("Employee has no Biometric User ID — set it first");
  }

  // Persist RFID on employee if provided
  if (rfidCard !== undefined) {
    employee.rfidCard = rfidCard.trim();
    await employee.save();
  }

  // Cancel any existing pending SET_USER command for this employee on this device
  await BiometricCommand.deleteMany({
    device: device._id,
    employee: employee._id,
    type: "SET_USER",
    status: "pending",
  });

  const cmdId = await nextCmdId(device._id);
  const cmd = await BiometricCommand.create({
    device: device._id,
    company: device.company,
    cmdId,
    command: buildSetUserCmd(employee),
    type: "SET_USER",
    employee: employee._id,
  });

  res.json({
    success: true,
    message: "Command queued — device will receive it on next poll",
    data: { cmdId: cmd.cmdId, employee: employee.biometricUserId },
  });
});

// POST /api/biometric/devices/:id/sync-all
// Queues SET_USER commands for every active employee with a biometricUserId
const syncAllToDevice = asyncHandler(async (req, res) => {
  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  if (!device.serialNumber) {
    res.status(400);
    throw new Error("Device has no serial number set");
  }

  const employees = await Employee.find({
    company: req.user.company,
    biometricUserId: { $exists: true, $ne: "" },
    status: { $ne: "terminated" },
  });

  // Cancel all pending SET_USER for this device
  await BiometricCommand.deleteMany({
    device: device._id,
    type: "SET_USER",
    status: "pending",
  });

  let baseId = await nextCmdId(device._id);
  const cmds = employees.map((emp, i) => ({
    device: device._id,
    company: device.company,
    cmdId: baseId + i,
    command: buildSetUserCmd(emp),
    type: "SET_USER",
    employee: emp._id,
  }));

  if (cmds.length) await BiometricCommand.insertMany(cmds);

  res.json({
    success: true,
    message: `${cmds.length} employee(s) queued for sync`,
    data: { queued: cmds.length },
  });
});

// DELETE /api/biometric/devices/:id/sync-employee/:employeeId
// Queues a DELETE USER command
const removeEmployeeFromDevice = asyncHandler(async (req, res) => {
  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }

  const employee = await Employee.findOne({
    _id: req.params.employeeId,
    company: req.user.company,
  });
  if (!employee || !employee.biometricUserId) {
    res.status(404);
    throw new Error("Employee not found or has no biometric ID");
  }

  const cmdId = await nextCmdId(device._id);
  await BiometricCommand.create({
    device: device._id,
    company: device.company,
    cmdId,
    command: `DATA DELETE USERINFO PIN=${employee.biometricUserId}`,
    type: "DELETE_USER",
    employee: employee._id,
  });

  res.json({ success: true, message: "Delete command queued" });
});

// GET /api/biometric/devices/:id/commands — list recent commands + status
const getDeviceCommands = asyncHandler(async (req, res) => {
  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }

  const cmds = await BiometricCommand.find({ device: device._id })
    .populate("employee", "firstName lastName employeeId biometricUserId")
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({ success: true, data: cmds });
});

// POST /api/biometric/employees/:id/rfid  { rfidCard: "scanned-value" }
// Saves RFID card scanned via USB reader (no device needed)
const saveRfidCard = asyncHandler(async (req, res) => {
  const { rfidCard } = req.body;
  if (!rfidCard) {
    res.status(400);
    throw new Error("rfidCard is required");
  }

  const employee = await Employee.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
  }

  // Ensure unique within company
  const conflict = await Employee.findOne({
    company: req.user.company,
    rfidCard: rfidCard.trim(),
    _id: { $ne: employee._id },
  });
  if (conflict) {
    res.status(400);
    throw new Error(
      `RFID card already assigned to ${conflict.firstName} ${conflict.lastName} (${conflict.employeeId})`,
    );
  }

  employee.rfidCard = rfidCard.trim();
  await employee.save();

  res.json({
    success: true,
    message: "RFID card saved",
    data: { rfidCard: employee.rfidCard },
  });
});

// ─── Face Recognition (PC webcam) ────────────────────────────────────────────

// POST /api/biometric/employees/:id/face  { descriptor: number[] }
const saveFaceDescriptor = asyncHandler(async (req, res) => {
  const { descriptor } = req.body;
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    res.status(400);
    throw new Error("descriptor must be an array of 128 numbers");
  }

  const employee = await Employee.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
  }

  employee.faceDescriptor = descriptor;
  await employee.save();

  res.json({ success: true, message: "Face descriptor saved" });
});

// GET /api/biometric/face-descriptors
// Returns all employees' face descriptors for client-side matching (no raw images)
const getFaceDescriptors = asyncHandler(async (req, res) => {
  const employees = await Employee.find({
    company: req.user.company,
    faceDescriptor: { $exists: true, $not: { $size: 0 } },
    status: { $ne: "terminated" },
  }).select("_id firstName lastName employeeId faceDescriptor");

  const data = employees.map((e) => ({
    employeeId: e._id,
    name: `${e.firstName} ${e.lastName}`,
    empCode: e.employeeId,
    descriptor: e.faceDescriptor,
  }));

  res.json({ success: true, data });
});

// POST /api/biometric/face-attendance  { descriptor: number[], deviceToken }
// Called from browser — matches face against all employees, marks attendance
const faceAttendance = asyncHandler(async (req, res) => {
  const { descriptor, deviceToken } = req.body;
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    res.status(400);
    throw new Error("Invalid face descriptor");
  }

  // Face matching happens client-side before this call —
  // client sends the matched employee ID as confirmation
  // But we still verify by fetching all descriptors and re-matching server-side
  // using euclidean distance (threshold 0.5)
  const employees = await Employee.find({
    faceDescriptor: { $exists: true, $not: { $size: 0 } },
    status: { $ne: "terminated" },
  }).select("_id firstName lastName employeeId phone faceDescriptor company");

  const THRESHOLD = 0.5;
  let bestMatch = null;
  let bestDist = Infinity;

  for (const emp of employees) {
    const stored = emp.faceDescriptor;
    // Euclidean distance between two 128-float vectors
    let dist = 0;
    for (let i = 0; i < 128; i++) {
      const d = (descriptor[i] || 0) - (stored[i] || 0);
      dist += d * d;
    }
    dist = Math.sqrt(dist);
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = emp;
    }
  }

  if (!bestMatch || bestDist > THRESHOLD) {
    res.status(404);
    throw new Error(
      `No matching employee found (best dist: ${bestDist.toFixed(3)})`,
    );
  }

  // Mark attendance for the matched employee
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const existingLog = await BiometricLog.findOne({
    employee: bestMatch._id,
    timestamp: { $gte: today },
  }).sort({ timestamp: -1 });
  const logType = existingLog?.type === "check_in" ? "check_out" : "check_in";

  const attendanceUpdate = {
    employee: bestMatch._id,
    date: today,
    markedBy: null,
  };
  if (logType === "check_in") {
    attendanceUpdate.checkIn = now;
    attendanceUpdate.status = now.getHours() >= 10 ? "late" : "present";
  } else {
    const existing = await Attendance.findOne({
      employee: bestMatch._id,
      date: today,
    });
    if (existing?.checkIn) {
      attendanceUpdate.checkOut = now;
      attendanceUpdate.workHours = (now - existing.checkIn) / 3600000;
    }
  }

  const attendance = await Attendance.findOneAndUpdate(
    { employee: bestMatch._id, date: today },
    { $set: attendanceUpdate },
    { upsert: true, new: true },
  );

  // Device lookup for log (optional — face attendance may not have a device)
  let device = null;
  if (deviceToken) {
    device = await BiometricDevice.findOne({ deviceToken, isActive: true });
  }

  if (device) {
    await BiometricLog.create({
      company: bestMatch.company,
      employee: bestMatch._id,
      device: device._id,
      location: device.location,
      method: "face",
      type: logType,
      attendance: attendance._id,
      timestamp: now,
    });
  }

  res.json({
    success: true,
    data: {
      employee: {
        name: `${bestMatch.firstName} ${bestMatch.lastName}`,
        employeeId: bestMatch.employeeId,
      },
      type: logType,
      confidence: parseFloat(((1 - bestDist / THRESHOLD) * 100).toFixed(1)),
      timestamp: now,
    },
  });
});

// ─── Fingerprint enrollment trigger (via ADMS command queue) ─────────────────

// POST /api/biometric/devices/:id/enroll-fingerprint
// Body: { employeeId, fingerIndex }  fingerIndex 0-9 (0=right thumb)
const triggerFingerprintEnroll = asyncHandler(async (req, res) => {
  const { employeeId, fingerIndex = 0 } = req.body;
  if (!employeeId) {
    res.status(400);
    throw new Error("employeeId is required");
  }

  const device = await BiometricDevice.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!device) {
    res.status(404);
    throw new Error("Device not found");
  }
  if (!device.serialNumber) {
    res.status(400);
    throw new Error("Device serial number not registered");
  }

  const employee = await Employee.findOne({
    _id: employeeId,
    company: req.user.company,
  });
  if (!employee || !employee.biometricUserId) {
    res.status(400);
    throw new Error("Employee not found or has no biometric user ID");
  }

  const cmdId = await nextCmdId(device._id);

  // ADMS fingerprint enrollment command:
  // Sends device into enroll mode for the specified PIN and finger slot
  await BiometricCommand.create({
    device: device._id,
    company: device.company,
    cmdId,
    command: `ENROLL_FP PIN=${employee.biometricUserId}\tNo=${fingerIndex}\tOverWrite=1\tDuress=0`,
    type: "SET_USER",
    employee: employee._id,
  });

  res.json({
    success: true,
    message: `Fingerprint enrollment queued for ${employee.firstName} ${employee.lastName}. Ask them to place their finger on the device when it beeps.`,
    data: { cmdId, fingerIndex },
  });
});

module.exports = {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  getDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  regenerateDeviceToken,
  assignNfcCard,
  removeNfcCard,
  registerDevice,
  getDeviceInfo,
  recordBiometric,
  getLogs,
  setDeviceSerial,
  syncEmployeeToDevice,
  syncAllToDevice,
  removeEmployeeFromDevice,
  getDeviceCommands,
  saveRfidCard,
  saveFaceDescriptor,
  getFaceDescriptors,
  faceAttendance,
  triggerFingerprintEnroll,
};
