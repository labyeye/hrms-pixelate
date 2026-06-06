const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const Employee = require("../models/Employee");
const User = require("../models/User");
const {
  escapeRegex,
  safePagination,
  validateBody,
  validateMongoId,
} = require("../middleware/validate");

// ── Validation schemas ────────────────────────────────────────────────────────

const createSchema = {
  firstName: { required: true, type: "string", minLength: 1, maxLength: 80 },
  lastName: { required: true, type: "string", minLength: 1, maxLength: 80 },
  email: { required: true, email: true },
  designation: { required: true, type: "string", minLength: 1, maxLength: 100 },
  joinDate: { required: true, type: "string" },
};

const updateSchema = {
  firstName: { type: "string", minLength: 1, maxLength: 80 },
  lastName: { type: "string", minLength: 1, maxLength: 80 },
  designation: { type: "string", minLength: 1, maxLength: 100 },
};

// ── Controllers ───────────────────────────────────────────────────────────────

const getEmployees = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { search, department, status, type } = req.query;

  const filter = { company: req.user.company };
  if (status) filter.status = status;
  if (department) filter.department = department;
  if (type) filter.employmentType = type;
  if (search) {
    const s = escapeRegex(search.slice(0, 100));
    filter.$or = [
      { firstName: { $regex: s, $options: "i" } },
      { lastName: { $regex: s, $options: "i" } },
      { email: { $regex: s, $options: "i" } },
      { employeeId: { $regex: s, $options: "i" } },
    ];
  }

  const total = await Employee.countDocuments(filter);
  const employees = await Employee.find(filter)
    .populate("department", "name code")
    .populate("reportingTo", "firstName lastName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: employees,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

const getEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({
    _id: req.params.id,
    company: req.user.company,
  })
    .populate("department", "name code")
    .populate("reportingTo", "firstName lastName designation");
  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
  }
  res.json({ success: true, data: employee });
});

const createEmployee = [
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const {
      firstName,
      lastName,
      email,
      designation,
      joinDate,
      phone,
      department,
      employmentType,
      salary,
      bankAccount,
      ifscCode,
      panNumber,
      address,
      emergencyContact,
      gender,
      dateOfBirth,
      reportingTo,
      avatar,
    } = req.body;

    const normalizedEmail = email.toLowerCase().trim();

    // Validate optional numeric fields
    if (salary !== undefined && (isNaN(Number(salary)) || Number(salary) < 0)) {
      res.status(400);
      throw new Error("Invalid salary value");
    }

    let userId;
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      userId = existingUser._id;
    } else {
      // Generate a random temporary password instead of hardcoding one
      const tempPassword = crypto.randomBytes(16).toString("hex");
      const user = await User.create({
        name: `${firstName.trim()} ${lastName.trim()}`,
        email: normalizedEmail,
        password: tempPassword,
        role: "employee",
        company: req.user.company,
      });
      userId = user._id;
    }

    // Company-scoped employee ID generation
    const lastEmp = await Employee.findOne({ company: req.user.company }).sort({
      createdAt: -1,
    });
    const lastNum = lastEmp
      ? parseInt(lastEmp.employeeId?.replace(/\D/g, "") || "0")
      : 0;
    const empId = `EMP${String(lastNum + 1).padStart(4, "0")}`;

    const employee = await Employee.create({
      user: userId,
      company: req.user.company,
      employeeId: empId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      designation: designation.trim(),
      joinDate,
      phone: phone || undefined,
      department: department || undefined,
      employmentType: employmentType || "full_time",
      salary: salary !== undefined ? Number(salary) : 0,
      bankAccount: bankAccount || undefined,
      ifscCode: ifscCode || undefined,
      panNumber: panNumber || undefined,
      address: address || undefined,
      emergencyContact: emergencyContact || undefined,
      gender: gender || undefined,
      dateOfBirth: dateOfBirth || undefined,
      reportingTo: reportingTo || undefined,
      avatar: avatar || undefined,
    });

    res.status(201).json({ success: true, data: employee });
  }),
];

const updateEmployee = [
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const employee = await Employee.findOne({
      _id: req.params.id,
      company: req.user.company,
    });
    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    // Whitelist updatable fields — never allow user/company/employeeId changes
    const allowed = [
      "firstName",
      "lastName",
      "designation",
      "phone",
      "department",
      "employmentType",
      "salary",
      "bankAccount",
      "ifscCode",
      "panNumber",
      "address",
      "emergencyContact",
      "gender",
      "dateOfBirth",
      "reportingTo",
      "avatar",
      "status",
      "exitDate",
      "biometricUserId",
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        employee[key] = req.body[key];
      }
    }

    if (
      employee.salary !== undefined &&
      (isNaN(Number(employee.salary)) || Number(employee.salary) < 0)
    ) {
      res.status(400);
      throw new Error("Invalid salary value");
    }

    await employee.save();
    await employee.populate("department", "name code");
    res.json({ success: true, data: employee });
  }),
];

const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
  }
  employee.status = "terminated";
  await employee.save();
  res.json({ success: true, message: "Employee terminated" });
});

module.exports = {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
