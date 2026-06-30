import { PIXELATE_NEST_LOGO } from './invoiceLogo';

export function buildPayslipHTML(payroll: any, companyName?: string): string {
  const emp = payroll.employee as any;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthName = payroll.month ? months[(payroll.month - 1)] : '—';
  const period = payroll.month && payroll.year ? `${monthName} ${payroll.year}` : '—';
  const empName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : '—';

  function fmt(n: number): string {
    return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const earnings = [
    { label: 'Basic Salary', value: payroll.basicSalary || 0 },
    { label: 'Earned Basic', value: payroll.earnedBasic || 0 },
    { label: 'Allowances / Bonus', value: payroll.otherAllowances || 0 },
    { label: 'Overtime Pay', value: payroll.otPay || 0 },
  ];

  const deductions = [
    { label: `Absent (${payroll.absentDays || 0} days)`, value: payroll.absentDeduction || 0 },
    { label: 'Late Deduction', value: payroll.lateDeductionAmount || 0 },
    { label: 'Half-Day Deduction', value: payroll.halfDayDeduction || 0 },
    { label: 'Penalty', value: payroll.penaltyAmount || 0 },
    { label: 'Loan / Advance EMI', value: payroll.loanDeduction || 0 },
  ];

  const earningsRows = earnings.map(e => `<tr><td>${e.label}</td><td class="amount">${fmt(e.value)}</td></tr>`).join('');
  const deductionsRows = deductions.map(d => `<tr><td>${d.label}</td><td class="amount neg">${fmt(d.value)}</td></tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Payslip — ${period}</title>
<style>
@page { margin: 0; size: A4; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; background:#fff; }
.page { margin: 8mm; border: 2pt solid #111; }
.header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom: 2pt solid #111; background:#f8f8f8; }
.company { }
.company-name { font-size:13pt; font-weight:700; }
.company-sub { font-size:8pt; color:#555; margin-top:2px; }
.slip-title { text-align:right; }
.slip-title h2 { font-size:14pt; font-weight:700; letter-spacing:1px; }
.slip-title .period { font-size:9pt; color:#555; margin-top:2px; }
.emp-section { display:flex; border-bottom:1pt solid #ddd; }
.emp-block { flex:1; padding:12px 16px; }
.emp-block + .emp-block { border-left:1pt solid #ddd; }
.field-label { font-size:7.5pt; font-weight:700; text-transform:uppercase; color:#777; letter-spacing:0.5px; margin-bottom:2px; }
.field-value { font-size:10pt; font-weight:600; color:#111; }
.tables { display:flex; border-bottom:1pt solid #ddd; }
.table-block { flex:1; }
.table-block + .table-block { border-left:1pt solid #ddd; }
.table-header { background:#111; color:#fff; padding:8px 12px; font-size:9pt; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
table { width:100%; border-collapse:collapse; }
td { padding:7px 12px; font-size:9pt; border-bottom:0.5pt solid #f0f0f0; }
td.amount { text-align:right; font-weight:600; }
td.neg { color:#DC2626; }
.totals-row { display:flex; border-bottom:2pt solid #111; }
.total-block { flex:1; padding:10px 16px; background:#f8f8f8; }
.total-block + .total-block { border-left:1pt solid #ddd; }
.total-label { font-size:8pt; font-weight:700; color:#555; text-transform:uppercase; }
.total-value { font-size:13pt; font-weight:700; margin-top:2px; }
.net-section { padding:14px 16px; background:#111; display:flex; justify-content:space-between; align-items:center; }
.net-label { font-size:11pt; font-weight:700; color:#fff; }
.net-amount { font-size:16pt; font-weight:700; color:#4ADE80; }
.summary-row { display:flex; border-bottom:1pt solid #ddd; }
.summary-item { flex:1; padding:8px 16px; text-align:center; }
.summary-item + .summary-item { border-left:1pt solid #ddd; }
.s-label { font-size:7.5pt; font-weight:700; color:#777; text-transform:uppercase; }
.s-value { font-size:10pt; font-weight:700; color:#111; margin-top:2px; }
.footer { padding:8px 16px; text-align:center; }
.footer p { font-size:7.5pt; color:#888; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="company">
      <div class="company-name">${companyName || 'Company'}</div>
      <div class="company-sub">Salary Slip</div>
    </div>
    <div class="slip-title">
      <h2>PAY SLIP</h2>
      <div class="period">${period}</div>
    </div>
  </div>

  <div class="emp-section">
    <div class="emp-block">
      <div class="field-label">Employee Name</div>
      <div class="field-value">${empName}</div>
    </div>
    <div class="emp-block">
      <div class="field-label">Employee ID</div>
      <div class="field-value">${emp?.employeeId || '—'}</div>
    </div>
    <div class="emp-block">
      <div class="field-label">Designation</div>
      <div class="field-value">${emp?.designation || '—'}</div>
    </div>
    <div class="emp-block">
      <div class="field-label">Department</div>
      <div class="field-value">${(emp?.department as any)?.name || emp?.department || '—'}</div>
    </div>
  </div>

  <div class="summary-row">
    <div class="summary-item">
      <div class="s-label">Days Present</div>
      <div class="s-value">${payroll.presentDays || 0}</div>
    </div>
    <div class="summary-item">
      <div class="s-label">Working Days</div>
      <div class="s-value">${payroll.workingDays || 0}</div>
    </div>
    <div class="summary-item">
      <div class="s-label">Days Absent</div>
      <div class="s-value" style="color:#DC2626">${payroll.absentDays || 0}</div>
    </div>
    <div class="summary-item">
      <div class="s-label">Hours Worked</div>
      <div class="s-value">${Number(payroll.totalWorkHours || 0).toFixed(1)}h</div>
    </div>
    <div class="summary-item">
      <div class="s-label">Status</div>
      <div class="s-value">${(payroll.status || '').toUpperCase()}</div>
    </div>
  </div>

  <div class="tables">
    <div class="table-block">
      <div class="table-header">Earnings</div>
      <table><tbody>
        ${earningsRows}
        <tr style="background:#f8f8f8;font-weight:700"><td>Gross Salary</td><td class="amount">${fmt(payroll.grossSalary || 0)}</td></tr>
      </tbody></table>
    </div>
    <div class="table-block">
      <div class="table-header">Deductions</div>
      <table><tbody>
        ${deductionsRows}
        <tr style="background:#fff0f0;font-weight:700"><td>Total Deductions</td><td class="amount neg">${fmt(payroll.totalDeductions || 0)}</td></tr>
      </tbody></table>
    </div>
  </div>

  <div class="totals-row">
    <div class="total-block">
      <div class="total-label">Gross Salary</div>
      <div class="total-value">₹${(payroll.grossSalary || 0).toLocaleString('en-IN')}</div>
    </div>
    <div class="total-block">
      <div class="total-label">Total Deductions</div>
      <div class="total-value" style="color:#DC2626">-₹${(payroll.totalDeductions || 0).toLocaleString('en-IN')}</div>
    </div>
  </div>

  <div class="net-section">
    <div class="net-label">NET SALARY PAYABLE</div>
    <div class="net-amount">₹${(payroll.netSalary || 0).toLocaleString('en-IN')}</div>
  </div>

  <div class="footer">
    <p>This is a computer-generated pay slip and does not require a signature. | Generated on ${new Date().toLocaleDateString('en-IN')}</p>
  </div>
</div>
</body>
</html>`;
}
