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

    // Attendance has no company field (the employee already scopes it), and check-in stores the row
    // at server-local midnight — match it the same way the attendance controller does.
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const attendance = await Attendance.findOne({
      employee: employeeId,
      date: today,
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
          speed: speed ?? null,
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
        speed: speed ?? null,
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
    // ?date=YYYY-MM-DD shows a past day; default is today
    const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || "")
      ? req.query.date
      : new Date().toISOString().slice(0, 10);

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

    if (req.user.role === "employee") {
      const self = await Employee.findOne({ user: req.user._id, company: companyId }).select("_id");
      if (!self || String(self._id) !== String(employeeId)) {
        return res.status(403).json({ success: false, message: "Not allowed" });
      }
    }

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

// GET /api/tracking/timeline/:employeeId?date=YYYY-MM-DD
// The day as a story: check-in, each place they stopped (with address), each trip between stops, check-out.
const STOP_RADIUS_KM = 0.12; // points within 120 m of each other count as one place
const STOP_MIN_MS = 8 * 60 * 1000; // staying 8+ minutes counts as a stop

function buildTimeline(pings) {
  const pts = pings
    .filter((p) => p.latitude != null && p.longitude != null && p.recordedAt)
    .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
  const clusters = [];
  for (const p of pts) {
    const c = clusters[clusters.length - 1];
    if (c && getDistanceKm(c.lat, c.lng, p.latitude, p.longitude) <= STOP_RADIUS_KM) {
      c.points.push(p);
      c.to = p.recordedAt;
    } else {
      clusters.push({ lat: p.latitude, lng: p.longitude, from: p.recordedAt, to: p.recordedAt, points: [p] });
    }
  }
  const events = [];
  let trip = null;
  const addTripPoint = (p) => {
    if (!trip) trip = { type: "move", from: p.recordedAt, to: p.recordedAt, km: 0, last: p };
    else {
      const d = getDistanceKm(trip.last.latitude, trip.last.longitude, p.latitude, p.longitude);
      if (d >= 0.03 && d < 50) trip.km += d;
      trip.to = p.recordedAt;
      trip.last = p;
    }
  };
  const closeTrip = () => {
    if (trip && trip.km >= 0.05) {
      events.push({ type: "move", from: trip.from, to: trip.to, km: Math.round(trip.km * 100) / 100 });
    }
    trip = null;
  };
  for (const c of clusters) {
    const dur = new Date(c.to) - new Date(c.from);
    if (dur >= STOP_MIN_MS) {
      addTripPoint(c.points[0]);
      closeTrip();
      const n = c.points.length;
      events.push({
        type: "stop",
        from: c.from,
        to: c.to,
        minutes: Math.round(dur / 60000),
        latitude: c.points.reduce((s, p) => s + p.latitude, 0) / n,
        longitude: c.points.reduce((s, p) => s + p.longitude, 0) / n,
      });
      trip = { type: "move", from: c.to, to: c.to, km: 0, last: c.points[n - 1] };
    } else {
      c.points.forEach(addTripPoint);
    }
  }
  closeTrip();

  // Merge "stop, short hop, stop" at the same place into one longer stop (GPS drift, moving between rooms).
  const merged = [];
  for (const e of events) {
    const prev = merged[merged.length - 1];
    const prev2 = merged[merged.length - 2];
    if (e.type === "stop" && prev?.type === "move" && prev.km < 0.25 && prev2?.type === "stop" &&
        getDistanceKm(prev2.latitude, prev2.longitude, e.latitude, e.longitude) < 0.25) {
      merged.pop();
      prev2.to = e.to;
      prev2.minutes = Math.round((new Date(e.to) - new Date(prev2.from)) / 60000);
      continue;
    }
    if (e.type === "stop" && prev?.type === "stop" &&
        getDistanceKm(prev.latitude, prev.longitude, e.latitude, e.longitude) < 0.25) {
      prev.to = e.to;
      prev.minutes = Math.round((new Date(e.to) - new Date(prev.from)) / 60000);
      continue;
    }
    merged.push(e);
  }
  return merged;
}

exports.getEmployeeTimeline = async (req, res) => {
  try {
    const companyId = req.user.company;
    const { employeeId } = req.params;
    const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || "")
      ? req.query.date
      : new Date().toISOString().slice(0, 10);

    const emp = await Employee.findOne({ _id: employeeId, company: companyId }).select(
      "firstName lastName employeeId designation user",
    );
    if (!emp) return res.status(404).json({ success: false, message: "Employee not found" });
    if (req.user.role === "employee" && String(emp.user) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    const log = await LocationLog.findOne({ company: companyId, employee: employeeId, date: dateStr });
    // Attendance rows are stored at server-local midnight
    const day = new Date(`${dateStr}T00:00:00`);
    const att = await Attendance.findOne({ employee: employeeId, date: day }).select("checkIn checkOut status");

    const events = buildTimeline(log?.pings || []);
    // Name up to 8 stops (free OpenStreetMap lookup: about 1 per second, cached after the first time)
    const { reverseGeocode } = require("../utils/geocode");
    for (const e of events.filter((x) => x.type === "stop").slice(0, 8)) {
      e.address = await reverseGeocode(e.latitude, e.longitude);
    }
    if (att?.checkIn) events.unshift({ type: "checkin", at: att.checkIn });
    if (att?.checkOut) events.push({ type: "checkout", at: att.checkOut });

    res.json({
      success: true,
      data: {
        employee: emp,
        date: dateStr,
        totalDistanceKm: log?.totalDistanceKm || 0,
        pingCount: log?.pings?.length || 0,
        firstPingAt: log?.pings?.[0]?.recordedAt || null,
        lastPingAt: log?.lastLocation?.updatedAt || null,
        route: (log?.pings || []).map((p) => [p.latitude, p.longitude]),
        events,
      },
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

