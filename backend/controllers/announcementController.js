const asyncHandler = require("express-async-handler");
const Announcement = require("../models/Announcement");
const Employee = require("../models/Employee");
const { moveToTrash } = require("./trashController");

exports.createAnnouncement = asyncHandler(async (req, res) => {
  const {
    title,
    content,
    category,
    priority,
    pinned,
    expiryDate,
    targetAudience,
    departments,
    roles,
    acknowledgementRequired,
    attachments,
  } = req.body;

  if (!title || !content) {
    res.status(400);
    throw new Error("Title and content are required");
  }

  const announcement = await Announcement.create({
    company: req.user.company,
    title,
    content,
    postedBy: req.user._id,
    category: category || "general",
    priority: priority || "medium",
    pinned: !!pinned,
    expiryDate: expiryDate || null,
    targetAudience: targetAudience || "all",
    departments: targetAudience === "department" ? departments || [] : [],
    roles: targetAudience === "role" ? roles || [] : [],
    acknowledgementRequired: !!acknowledgementRequired,
    attachments: attachments || [],
  });

  const populated = await Announcement.findById(announcement._id).populate(
    "postedBy",
    "name email",
  );
  res.status(201).json({ success: true, data: populated });
});

const ADMIN_ROLES = ["super_admin", "hr_manager"];

exports.getAnnouncements = asyncHandler(async (req, res) => {
  const filter = { company: req.user.company };
  if (req.user.role === "employee") {
    filter.active = true;
    filter.$or = [{ expiryDate: null }, { expiryDate: { $gte: new Date() } }];
  }

  let query = Announcement.find(filter)
    .populate("postedBy", "name email")
    .populate("departments", "name")
    .sort({ pinned: -1, date: -1 });

  if (ADMIN_ROLES.includes(req.user.role)) {
    query = query
      .populate("readBy", "name email")
      .populate("acknowledgedBy", "name email");
  }

  let announcements = await query;

  // Audience targeting for employees: only show "all", their department, or their role
  if (req.user.role === "employee" || req.user.role === "department_head") {
    const emp = await Employee.findOne({ user: req.user._id });
    announcements = announcements.filter((a) => {
      if (a.targetAudience === "all") return true;
      if (a.targetAudience === "department") {
        return (
          emp &&
          a.departments.some((d) => String(d._id) === String(emp.department))
        );
      }
      if (a.targetAudience === "role") {
        return a.roles.includes(req.user.role);
      }
      return true;
    });
  }

  // Attach audience size so HR can see "X of Y viewed"
  if (ADMIN_ROLES.includes(req.user.role)) {
    const totalEmployees = await Employee.countDocuments({
      company: req.user.company,
      status: "active",
    });
    announcements = announcements.map((a) => {
      const obj = a.toObject();
      obj.audienceCount = totalEmployees;
      return obj;
    });
  }

  res.json({ success: true, data: announcements });
});

exports.markRead = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!announcement) {
    res.status(404);
    throw new Error("Announcement not found");
  }
  if (!announcement.readBy.some((id) => String(id) === String(req.user._id))) {
    announcement.readBy.push(req.user._id);
    await announcement.save();
  }
  res.json({ success: true, data: announcement });
});

exports.acknowledgeAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!announcement) {
    res.status(404);
    throw new Error("Announcement not found");
  }
  if (
    !announcement.acknowledgedBy.some(
      (id) => String(id) === String(req.user._id),
    )
  ) {
    announcement.acknowledgedBy.push(req.user._id);
    if (
      !announcement.readBy.some((id) => String(id) === String(req.user._id))
    ) {
      announcement.readBy.push(req.user._id);
    }
    await announcement.save();
  }
  res.json({ success: true, data: announcement });
});

exports.deleteAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!announcement) {
    res.status(404);
    throw new Error("Announcement not found");
  }
  await moveToTrash("Announcement", announcement, req);
  res.json({ success: true, message: "Announcement deleted" });
});
