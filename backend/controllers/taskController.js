const asyncHandler = require("express-async-handler");
const Task = require("../models/Task");
const path = require("path");
const { moveToTrash } = require("./trashController");
const files = require("./taskFiles");

const ASSIGN_ROLES = ["super_admin", "hr_manager", "department_head"];

// ponytail: sweeps on read instead of a cron job — fine at this volume, add a
// scheduled job if task counts get large enough to make per-request sweeps costly.
async function markOverdueTasks(companyId) {
  await Task.updateMany(
    {
      company: companyId,
      status: { $ne: "completed" },
      dueDate: { $lt: new Date() },
      late: false,
    },
    { $set: { late: true, lateMarkedAt: new Date() } },
  );
}

const POP = (q) =>
  q
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("statusHistory.changedBy", "name email")
    .populate("comments.user", "name email")
    .populate("attachments.uploadedBy", "name");

// multipart bodies send arrays as JSON strings
const asArray = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v !== "string" || !v.trim()) return [];
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? a : [];
  } catch (_) {
    return v.split(",");
  }
};
const cleanTags = (v) => [...new Set(asArray(v).map((t) => String(t).trim().slice(0, 30)).filter(Boolean))].slice(0, 10);
const cleanChecklist = (v) =>
  asArray(v)
    .map((i) => (typeof i === "string" ? { text: i } : i))
    .filter((i) => i && String(i.text || "").trim())
    .slice(0, 50)
    .map((i) => ({ ...(i._id ? { _id: i._id } : {}), text: String(i.text).trim().slice(0, 200), done: !!i.done }));
const numOrUndef = (v) => (v === undefined || v === "" || isNaN(Number(v)) ? undefined : Math.max(0, Number(v)));

exports.createTask = asyncHandler(async (req, res) => {
  try {
    await createTaskInner(req, res);
  } catch (e) {
    files.dropAll(req.files);
    throw e;
  }
});

async function createTaskInner(req, res) {
  const { title, description, assignedTo, priority, dueDate, department } =
    req.body;
  if (!title || !String(title).trim()) {
    res.status(400);
    throw new Error("Title is required");
  }
  if (!assignedTo) {
    res.status(400);
    throw new Error("assignedTo is required");
  }

  const { ok: attachments } = req.files?.length
    ? await files.vetTaskFiles(req.files, req.user._id, "reference")
    : { ok: [] };

  const task = await Task.create({
    company: req.user.company,
    title: title.trim(),
    description: description?.trim() || "",
    instructions: (req.body.instructions || "").trim().slice(0, 5000),
    startDate: req.body.startDate || undefined,
    estimatedHours: numOrUndef(req.body.estimatedHours),
    tags: cleanTags(req.body.tags),
    checklist: cleanChecklist(req.body.checklist),
    attachments,
    assignedTo,
    assignedBy: req.user._id,
    department: department || undefined,
    priority: priority || "medium",
    dueDate: dueDate || undefined,
    statusHistory: [{ status: "pending", changedBy: req.user._id }],
  });

  res.status(201).json({ success: true, data: await POP(Task.findById(task._id)) });
}

exports.updateTask = asyncHandler(async (req, res) => {
  const { title, description, assignedTo, priority, dueDate } = req.body;

  const task = await Task.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }

  if (title !== undefined) {
    if (!title.trim()) {
      res.status(400);
      throw new Error("Title is required");
    }
    task.title = title.trim();
  }
  if (description !== undefined) task.description = description?.trim() || "";
  if (req.body.instructions !== undefined) task.instructions = String(req.body.instructions || "").trim().slice(0, 5000);
  if (req.body.startDate !== undefined) task.startDate = req.body.startDate || undefined;
  if (req.body.estimatedHours !== undefined) task.estimatedHours = numOrUndef(req.body.estimatedHours);
  if (req.body.tags !== undefined) task.tags = cleanTags(req.body.tags);
  if (req.body.checklist !== undefined) {
    // keep who-ticked-what for items that survive the edit
    const prev = new Map(task.checklist.map((i) => [String(i._id), i]));
    task.checklist = cleanChecklist(req.body.checklist).map((i) => {
      const old = i._id && prev.get(String(i._id));
      return old ? { _id: old._id, text: i.text, done: old.done, doneBy: old.doneBy, doneAt: old.doneAt } : { text: i.text };
    });
  }
  if (assignedTo !== undefined) task.assignedTo = assignedTo;
  if (priority !== undefined) task.priority = priority;
  if (dueDate !== undefined) {
    task.dueDate = dueDate || undefined;
    if (task.late && task.dueDate && task.dueDate.getTime() > Date.now()) {
      task.late = false;
      task.lateMarkedAt = undefined;
    }
  }

  await task.save();
  res.json({ success: true, data: await POP(Task.findById(task._id)) });
});

exports.getTasks = asyncHandler(async (req, res) => {
  await markOverdueTasks(req.user.company);
  const filter = { company: req.user.company };
  if (!ASSIGN_ROLES.includes(req.user.role)) {
    filter.assignedTo = req.user._id;
  } else if (req.query.mine === "true") {
    filter.assignedTo = req.user._id;
  } else if (req.query.assignedByMe === "true") {
    filter.assignedBy = req.user._id;
  }
  if (req.query.status) filter.status = req.query.status;

  const tasks = await POP(Task.find(filter)).sort({ createdAt: -1 });

  res.json({ success: true, data: tasks });
});

exports.getTask = asyncHandler(async (req, res) => {
  await markOverdueTasks(req.user.company);
  const task = await POP(Task.findOne({
    _id: req.params.id,
    company: req.user.company,
  }));

  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }
  if (
    !ASSIGN_ROLES.includes(req.user.role) &&
    String(task.assignedTo._id) !== String(req.user._id)
  ) {
    res.status(403);
    throw new Error("Access denied");
  }
  res.json({ success: true, data: task });
});

exports.updateTaskStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["pending", "in_progress", "completed"].includes(status)) {
    res.status(400);
    throw new Error("Invalid status");
  }

  const task = await Task.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }
  if (
    !ASSIGN_ROLES.includes(req.user.role) &&
    String(task.assignedTo) !== String(req.user._id)
  ) {
    res.status(403);
    throw new Error("Access denied");
  }

  task.status = status;
  task.statusHistory.push({ status, changedBy: req.user._id });
  await task.save();
  const populated = await Task.findById(task._id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("statusHistory.changedBy", "name email");
  res.json({ success: true, data: populated });
});

exports.addComment = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    res.status(400);
    throw new Error("Message is required");
  }

  const task = await Task.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }
  if (
    !ASSIGN_ROLES.includes(req.user.role) &&
    String(task.assignedTo) !== String(req.user._id)
  ) {
    res.status(403);
    throw new Error("Access denied");
  }

  task.comments.push({ user: req.user._id, message: message.trim() });
  await task.save();
  const populated = await Task.findById(task._id).populate(
    "comments.user",
    "name email",
  );
  res.json({ success: true, data: populated });
});

exports.deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }
  await moveToTrash("Task", task, req);
  res.json({ success: true, message: "Task deleted" });
});

// ── Attachments ──────────────────────────────────────────────────────────────
async function accessibleTask(req, res) {
  const task = await Task.findOne({ _id: req.params.id, company: req.user.company });
  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }
  const isManager = ASSIGN_ROLES.includes(req.user.role);
  if (!isManager && String(task.assignedTo) !== String(req.user._id)) {
    res.status(403);
    throw new Error("Access denied");
  }
  return { task, isManager };
}

// Managers add reference material (or work); the assignee can only submit work.
exports.addTaskFiles = asyncHandler(async (req, res) => {
  try {
    const { task, isManager } = await accessibleTask(req, res);
    if (!req.files?.length) {
      res.status(400);
      throw new Error("Choose at least one file");
    }
    if (task.attachments.length + req.files.length > 50) {
      res.status(400);
      throw new Error("A task can hold at most 50 files");
    }
    const purpose = isManager && req.body.purpose !== "work" ? "reference" : "work";
    let ok;
    try {
      ({ ok } = await files.vetTaskFiles(req.files, req.user._id, purpose));
    } catch (e) {
      res.status(400);
      throw e;
    }
    task.attachments.push(...ok);
    await task.save();
    res.status(201).json({ success: true, data: await POP(Task.findById(task._id)) });
  } catch (e) {
    files.dropAll(req.files);
    throw e;
  }
});

exports.deleteTaskFile = asyncHandler(async (req, res) => {
  const { task, isManager } = await accessibleTask(req, res);
  const att = task.attachments.id(req.params.fileId);
  if (!att) {
    res.status(404);
    throw new Error("File not found");
  }
  if (!isManager && String(att.uploadedBy) !== String(req.user._id)) {
    res.status(403);
    throw new Error("You can only remove files you uploaded");
  }
  const stored = att.file;
  att.deleteOne();
  await task.save();
  files.removeStored([stored]);
  res.json({ success: true, data: await POP(Task.findById(task._id)) });
});

// Short-lived signed link so <img>/<video> tags and the phone's viewer can open a private file.
exports.getTaskFileLink = asyncHandler(async (req, res) => {
  const { task } = await accessibleTask(req, res);
  const att = task.attachments.id(req.params.fileId);
  if (!att) {
    res.status(404);
    throw new Error("File not found");
  }
  res.json({ success: true, data: { path: `/tasks/file/${files.signLink(att.file, att.mime, att.name)}` } });
});

// Public: the token is the credential (purpose-bound, 10 min). res.sendFile handles Range, so video can seek.
exports.serveTaskFile = asyncHandler(async (req, res) => {
  let d;
  try {
    d = files.verifyLink(req.params.token);
  } catch (_) {
    res.status(401);
    throw new Error("Link expired");
  }
  const safeName = String(d.name || "file").replace(/[^\w.\- ]/g, "_");
  const inline = /^(image|video)\//.test(d.mime) || d.mime === "application/pdf";
  res.set({
    "Content-Type": d.mime,
    "Content-Disposition": `${req.query.download === "1" || !inline ? "attachment" : "inline"}; filename="${safeName}"`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Cache-Control": "private, no-store",
  });
  res.sendFile(path.join(files.DIR, path.basename(d.file)));
});

exports.toggleChecklistItem = asyncHandler(async (req, res) => {
  const { task } = await accessibleTask(req, res);
  const item = task.checklist.id(req.params.itemId);
  if (!item) {
    res.status(404);
    throw new Error("Checklist item not found");
  }
  item.done = req.body.done === undefined ? !item.done : !!req.body.done;
  item.doneBy = item.done ? req.user._id : undefined;
  item.doneAt = item.done ? new Date() : undefined;
  await task.save();
  res.json({ success: true, data: await POP(Task.findById(task._id)) });
});
