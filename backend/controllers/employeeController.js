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
    .populate("shift", "name startTime endTime")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // Convert large binary fields to lightweight flags before sending to client
  const data = employees.map((e) => {
    const obj = e.toObject();
    obj.deviceFaceTemplate = !!obj.deviceFaceTemplate;
    return obj;
  });

  res.json({
    success: true,
    data,
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

const getMyEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({ user: req.user._id })
    .populate("department", "name code shiftStartTime shiftEndTime")
    .populate("reportingTo", "firstName lastName designation");
  if (!employee) {
    res.status(404);
    throw new Error("No employee record linked to your account");
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
      accountHolderName,
      ifscCode,
      bankName,
      panNumber,
      aadharNumber,
      uanNumber,
      esicNumber,
      address,
      emergencyContact,
      gender,
      dateOfBirth,
      reportingTo,
      avatar,
      shift,
      shiftName,
    } = req.body;

    const normalizedEmail = email.toLowerCase().trim();

    if (salary !== undefined && (isNaN(Number(salary)) || Number(salary) < 0)) {
      res.status(400);
      throw new Error("Invalid salary value");
    }

    let userId;
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      userId = existingUser._id;
    } else {
      const { password: providedPassword } = req.body;
      const tempPassword =
        providedPassword && providedPassword.length >= 6
          ? providedPassword
          : crypto.randomBytes(8).toString("hex") + "A1";
      const user = await User.create({
        name: `${firstName.trim()} ${lastName.trim()}`,
        email: normalizedEmail,
        password: tempPassword,
        role: "employee",
        company: req.user.company,
      });
      userId = user._id;
    }

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
      accountHolderName: accountHolderName || undefined,
      ifscCode: ifscCode || undefined,
      bankName: bankName || undefined,
      panNumber: panNumber || undefined,
      aadharNumber: aadharNumber || undefined,
      uanNumber: uanNumber || undefined,
      esicNumber: esicNumber || undefined,
      address: address || undefined,
      emergencyContact: emergencyContact || undefined,
      gender: gender || undefined,
      dateOfBirth: dateOfBirth || undefined,
      reportingTo: reportingTo || undefined,
      avatar: avatar || undefined,
      shift: shift || undefined,
      shiftName: shiftName || "General",
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

    const allowed = [
      "firstName",
      "lastName",
      "designation",
      "phone",
      "department",
      "employmentType",
      "salary",
      "bankAccount",
      "accountHolderName",
      "ifscCode",
      "bankName",
      "panNumber",
      "aadharNumber",
      "uanNumber",
      "esicNumber",
      "address",
      "emergencyContact",
      "gender",
      "dateOfBirth",
      "reportingTo",
      "avatar",
      "status",
      "exitDate",
      "biometricUserId",
      "shift",
      "shiftName",
    ];

    // Fields that hold ObjectId references — empty string must become undefined,
    // otherwise Mongoose throws a BSONError trying to cast "" to ObjectId.
    const objectIdFields = new Set(["shift", "department", "reportingTo"]);

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        const val = req.body[key];
        employee[key] = objectIdFields.has(key) && val === "" ? undefined : val;
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

const resetEmployeePassword = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
  }

  const { password } = req.body;
  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }
  if (password.length > 128) {
    res.status(400);
    throw new Error("Password too long");
  }

  const linkedUser = await User.findOne({ email: employee.email });
  if (!linkedUser) {
    res.status(404);
    throw new Error("No login account found for this employee");
  }

  linkedUser.password = password;
  await linkedUser.save();

  res.json({ success: true, message: "Password updated successfully" });
});

const bulkImportEmployees = asyncHandler(async (req, res) => {
  const { employees: rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400);
    throw new Error("employees array is required");
  }
  if (rows.length > 200) {
    res.status(400);
    throw new Error("Maximum 200 employees per import");
  }

  const Department = require("../models/Department");
  const Shift = require("../models/Shift");

  const [allDepts, allShifts] = await Promise.all([
    Department.find({ company: req.user.company }),
    Shift.find({ company: req.user.company }),
  ]);

  const lastEmp = await Employee.findOne({ company: req.user.company }).sort({
    createdAt: -1,
  });
  let lastNum = lastEmp
    ? parseInt(lastEmp.employeeId?.replace(/\D/g, "") || "0")
    : 0;

  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const firstName = (row.firstName || "").trim();
      const lastName = (row.lastName || "").trim();
      const email = (row.email || "").toLowerCase().trim();
      const designation = (row.designation || "").trim();
      const joinDate = row.joinDate;

      if (!firstName || !lastName || !email || !designation || !joinDate) {
        results.push({
          row: i + 1,
          status: "error",
          message:
            "Missing required field (firstName, lastName, email, designation, joinDate)",
        });
        continue;
      }

      const deptMatch = allDepts.find(
        (d) => d.name.toLowerCase() === (row.department || "").toLowerCase(),
      );
      const shiftMatch = allShifts.find(
        (s) => s.name.toLowerCase() === (row.shiftName || "").toLowerCase(),
      );

      let userId;
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        userId = existingUser._id;
      } else {
        const tempPassword =
          row.password && row.password.length >= 6
            ? row.password
            : crypto.randomBytes(8).toString("hex") + "A1";
        const user = await User.create({
          name: `${firstName} ${lastName}`,
          email,
          password: tempPassword,
          role: "employee",
          company: req.user.company,
        });
        userId = user._id;
      }

      lastNum += 1;
      const empId = `EMP${String(lastNum).padStart(4, "0")}`;

      const employee = await Employee.create({
        user: userId,
        company: req.user.company,
        employeeId: empId,
        firstName,
        lastName,
        email,
        designation,
        joinDate,
        phone: row.phone || undefined,
        department: deptMatch?._id || undefined,
        employmentType: row.employmentType || "full_time",
        salary: Number(row.salary) || 0,
        gender: row.gender || undefined,
        dateOfBirth: row.dateOfBirth || undefined,
        address: row.address || undefined,
        emergencyContact: row.emergencyContact || undefined,
        bankAccount: row.bankAccount || undefined,
        accountHolderName: row.accountHolderName || undefined,
        ifscCode: row.ifscCode || undefined,
        bankName: row.bankName || undefined,
        panNumber: row.panNumber || undefined,
        aadharNumber: row.aadharNumber || undefined,
        uanNumber: row.uanNumber || undefined,
        esicNumber: row.esicNumber || undefined,
        pfNumber: row.pfNumber || undefined,
        shift: shiftMatch?._id || undefined,
        shiftName: shiftMatch?.name || row.shiftName || "General",
      });

      results.push({
        row: i + 1,
        status: "success",
        employeeId: employee.employeeId,
        name: `${firstName} ${lastName}`,
      });
    } catch (err) {
      results.push({ row: i + 1, status: "error", message: err.message });
    }
  }

  const imported = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;

  res.json({ success: true, imported, failed, results });
});

module.exports = {
  getEmployees,
  getEmployee,
  getMyEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  resetEmployeePassword,
  bulkImportEmployees,
};
