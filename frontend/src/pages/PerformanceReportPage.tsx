import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, FileBarChart } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { performanceAPI } from "@/services/api";
import {
  LiveMetrics,
  LiveMetricsTable,
} from "@/components/performance/LiveMetricsTable";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PerformanceReportPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<LiveMetrics[] | null>(null);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const r: any = await performanceAPI.getLive({
        month: String(month),
        year: String(year),
      });
      const list = Array.isArray(r.data) ? r.data : r.data ? [r.data] : [];
      setData(list);
      setLabel(`${MONTHS[month - 1]} ${year}`);
    } catch (e: any) {
      setError(e.message || "Failed to generate report");
    }
    setLoading(false);
  };

  const scored = (data ?? []).filter((m) => m.score != null);
  const avg = scored.length
    ? Math.round(scored.reduce((s, m) => s + (m.score as number), 0) / scored.length)
    : null;

  const downloadCsv = () => {
    if (!data) return;
    const rows = [...data].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    const csv = [
      ["Rank", "Employee", "Score %", "Attendance %", "Tasks Done", "Tasks Total"],
      ...rows.map((m, i) => [
        i + 1,
        `${m.firstName} ${m.lastName}`,
        m.score ?? "",
        m.attendancePct ?? "",
        m.completedTasks,
        m.totalTasks,
      ]),
    ]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `performance-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <AppLayout title="Performance Report">
      <Link
        to="/performance"
        className="inline-flex items-center gap-1 text-xs font-bold text-[#024BAB] hover:underline mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Performance
      </Link>

      <div className="border-2 bg-white p-4 mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-bold text-black mb-1">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border-2 px-3 py-2 text-sm"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-black mb-1">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border-2 px-3 py-2 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm font-bold flex items-center gap-1.5"
        >
          <FileBarChart className="w-4 h-4" />
          {loading ? "Generating…" : "Generate Report"}
        </button>
        {data && data.length > 0 && (
          <button
            onClick={downloadCsv}
            className="border-2 bg-white text-black px-4 py-2 text-sm font-bold flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      {data === null ? (
        <p className="text-xs text-muted-foreground">
          Pick a month and click Generate Report.
        </p>
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No employee data for {label}.
        </p>
      ) : (
        <div className="border-2 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-xs font-bold text-black uppercase tracking-wider">
              Performance — {label}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.length} employees · Average score{" "}
              <span className="font-bold text-black">
                {avg != null ? `${avg}%` : "—"}
              </span>
            </p>
          </div>
          <LiveMetricsTable data={data} />
        </div>
      )}
    </AppLayout>
  );
}
