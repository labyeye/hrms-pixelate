const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { uploadTaskFiles } = require("../middleware/upload");
const {
  addTaskFiles,
  deleteTaskFile,
  getTaskFileLink,
  serveTaskFile,
  toggleChecklistItem,
  createTask,
  getTasks,
  getTask,
  updateTask,
  updateTaskStatus,
  addComment,
  deleteTask,
} = require("../controllers/taskController");

const ASSIGN_ROLES = ["super_admin", "hr_manager", "department_head"];

// multer errors (file too large, too many files) become a readable 400 instead of a 500
const upload = (req, res, next) =>
  uploadTaskFiles(req, res, (err) => {
    if (!err) return next();
    res.status(400);
    next(new Error(err.code === "LIMIT_FILE_SIZE" ? "Each file must be 100 MB or smaller" : err.code === "LIMIT_FILE_COUNT" ? "Up to 10 files at a time" : err.message));
  });

router
  .route("/")
  .get(protect, getTasks)
  .post(protect, authorize(...ASSIGN_ROLES), upload, createTask);

router.get("/file/:token", serveTaskFile);
router.post("/:id/files", protect, upload, addTaskFiles);
router.delete("/:id/files/:fileId", protect, deleteTaskFile);
router.get("/:id/files/:fileId/link", protect, getTaskFileLink);
router.patch("/:id/checklist/:itemId", protect, toggleChecklistItem);

router.get("/:id", protect, getTask);
router.put("/:id", protect, authorize(...ASSIGN_ROLES), updateTask);
router.patch("/:id/status", protect, updateTaskStatus);
router.post("/:id/comments", protect, addComment);
router.delete("/:id", protect, authorize(...ASSIGN_ROLES), deleteTask);

module.exports = router;
