// PF (Provident Fund) maths shared by payroll and the employee salary preview.
// When PF is on for an employee, the monthly salary entered is the CTC. PF is 12% of the PF wage
// (capped at the statutory ₹15,000 wage ceiling) from the employee AND 12% from the employer; the employer share is part of CTC.
const PF_RATE = 0.12;
const PF_WAGE_CEILING = 15000;

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const pfOnWage = (wage) => round2(Math.min(Math.max(wage, 0), PF_WAGE_CEILING) * PF_RATE);

// Full-month breakdown from CTC.
function pfBreakdown(ctc, enabled) {
  const c = Number(ctc) || 0;
  if (!enabled) return { ctc: c, employerPf: 0, grossSalary: c, employeePf: 0, inHand: c };
  const employerPf = pfOnWage(c);
  const grossSalary = round2(c - employerPf);
  const employeePf = pfOnWage(grossSalary);
  return { ctc: c, employerPf, grossSalary, employeePf, inHand: round2(grossSalary - employeePf) };
}

module.exports = { PF_RATE, PF_WAGE_CEILING, pfBreakdown, pfOnWage };
