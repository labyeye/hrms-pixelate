const LocationLog = require("../models/LocationLog");
const Employee = require("../models/Employee");
const Setting = require("../models/Setting");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");
const Attendance = require("../models/Attendance");

// Haversine formula to compute distance between two coords in kilometers
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// POST /api/tracking/ping
// Called periodically by the mobile app during work hours
exports.recordPing = async (req, res) => {
  try {
    const { latitude, longitude, accuracy, speed, battery, recordedAt } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: "Coordinates required" });
    }

    const companyId = req.user.company;
    let employeeId = req.user.employee;

    if (!employeeId) {
      const emp = await Employee.findOne({ company: companyId, user: req.user._id });
      if (!emp) {
        return res.status(404).json({ success: false, message: "Employee profile not found" });
      }
      employeeId = emp._id;
    }

    // Check company setting: is GPS Live Tracking enabled?
    const setting = await Setting.findOne({ company: companyId });
    if (!setting?.gpsLiveTrackingEnabled) {
      return res.json({
        success: true,
        message: "Live tracking is disabled for this company",
        trackingEnabled: false,
      });
    }

    // Check if employee has tracking enabled
    const employee = await Employee.findById(employeeId);
    // Nothing in the UI ever set the per-employee flag, so tracking never started: the company switch decides.
    if (!employee) {
      return res.json({
        success: true,
        message: "Live tracking is not active for this employee",
        trackingEnabled: false,
      });
    }

    // Duty-Hour Guard: check if employee has checked in and not yet checked out today
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const startOfDay = new Date(todayStr);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const attendance = await Attendance.findOne({
      company: companyId,
      employee: employeeId,
      date: { $gte: startOfDay, $lt: endOfDay },
    });

    // If no check-in yet, or already checked out: do not record
    const hasPunchedIn = !!attendance?.checkIn;
    const hasPunchedOut = !!attendance?.checkOut;

    if (!hasPunchedIn || hasPunchedOut) {
      return res.json({
        success: true,
        message: hasPunchedOut ? "Shift ended (punched out)" : "Shift not started (not punched in)",
        trackingEnabled: true,
        dutyActive: false,
      });
    }

    const pingTime = recordedAt ? new Date(recordedAt) : now;
    const newPing = {
      latitude,
      longitude,
      accuracy: accuracy || null,
      speed: speed || null,
      battery: battery != null ? battery : null,
      recordedAt: pingTime,
    };

    let log = await LocationLog.findOne({
      company: companyId,
      employee: employeeId,
      date: todayStr,
    });

    let additionalDist = 0;
    if (log && log.lastLocation?.latitude && log.lastLocation?.longitude) {
      const dist = getDistanceKm(
        log.lastLocation.latitude,
        log.lastLocation.longitude,
        latitude,
        longitude,
      );
      // Filter out small GPS jitter (< 30 meters) and absurd jumps (> 150 km/h)
      if (dist >= 0.03 && dist < 50) {
        additionalDist = dist;
      }
    }

    if (!log) {
      log = new LocationLog({
        company: companyId,
        employee: employeeId,
        date: todayStr,
        pings: [newPing],
        lastLocation: {
          latitude,
          longitude,
          accuracy,
          battery,
          updatedAt: pingTime,
        },
        totalDistanceKm: 0,
      });
    } else {
      log.pings.push(newPing);
      log.lastLocation = {
        latitude,
        longitude,
        accuracy,
        battery,
        updatedAt: pingTime,
      };
      log.totalDistanceKm = Math.round((log.totalDistanceKm + additionalDist) * 100) / 100;
    }

    await log.save();

    res.json({
      success: true,
      data: {
        totalDistanceKm: log.totalDistanceKm,
        pingCount: log.pings.length,
        dutyActive: true,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/tracking/live
// For Admin/HR: get the most recent positions of all tracked staff today
exports.getLiveTracking = async (req, res) => {
  try {
    const companyId = req.user.company;
    const todayStr = new Date().toISOString().slice(0, 10);

    const logs = await LocationLog.find({
      company: companyId,
      date: todayStr,
    })
      .populate("employee", "firstName lastName employeeId designation avatar department phone")
      .select("employee lastLocation totalDistanceKm updatedAt");

    const setting = await Setting.findOne({ company: companyId }).select("gpsLiveTrackingEnabled");
    const seen = new Set(logs.map((l) => String(l.employee?._id)));
    const waiting = (
      await Employee.find({ company: companyId, status: { $nin: ["terminated", "exited"] } })
        .select("firstName lastName employeeId designation")
        .lean()
    ).filter((e) => !seen.has(String(e._id)));
    res.json({
      success: true,
      data: logs,
      waiting,
      enabled: !!setting?.gpsLiveTrackingEnabled,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/tracking/history/:employeeId
// For Admin/HR: get route breadcrumb history for an employee on a given date
exports.getEmployeeRouteHistory = async (req, res) => {
  try {
    const companyId = req.user.company;
    const { employeeId } = req.params;
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);

    const log = await LocationLog.findOne({
      company: companyId,
      employee: employeeId,
      date: dateStr,
    }).populate("employee", "firstName lastName employeeId designation");

    if (!log) {
      return res.json({
        success: true,
        data: {
          employeeId,
          date: dateStr,
          pings: [],
          totalDistanceKm: 0,
        },
      });
    }

    res.json({
      success: true,
      data: log,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/tracking/settings
// Admin toggles live tracking addon or interval
exports.updateTrackingSettings = async (req, res) => {
  try {
    const companyId = req.user.company;
    const { enabled, intervalMinutes } = req.body;

    if (enabled) {
      const company = await Company.findById(companyId).select("subscription");
      const sub = company?.subscription
        ? await Subscription.findById(company.subscription).select("geoTracking")
        : null;
      if (sub && sub.geoTracking === false)
        return res.status(403).json({
          success: false,
          message:
            "Live GPS tracking is part of the Geo Tracking plan. Contact Pixelate Nest to upgrade.",
        });
    }

    const setting = await Setting.findOneAndUpdate(
      { company: companyId },
      {
        ...(enabled !== undefined ? { gpsLiveTrackingEnabled: !!enabled } : {}),
        ...(intervalMinutes ? { gpsTrackingIntervalMinutes: Math.max(2, Number(intervalMinutes)) } : {}),
      },
      { new: true, upsert: true },
    );

    res.json({
      success: true,
      data: {
        gpsLiveTrackingEnabled: setting.gpsLiveTrackingEnabled,
        gpsTrackingIntervalMinutes: setting.gpsTrackingIntervalMinutes,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

