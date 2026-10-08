import { useState } from "react";
import { cn } from "@/lib/utils";

export type LiveMetrics = {
  employeeId?: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  designation?: string;
  attendancePct: number | null;
  taskPct: number | null;
  score: number | null;
  presentDays: number;
  totalTasks: number;
  completedTasks: number;
};

export function scoreColor(score: number | null) {
  if (score == null) return "text-gray-500";
  if (score >= 80) return "text-[#00815A]";
  if (score >= 50) return "text-[#B5540E]";
  return "text-[#B91C1C]";
}

function barColor(score: number | null) {
  if (score == null) return "#9CA3AF";
  if (score >= 80) return "#00C48C";
  if (score >= 50) return "#FA731C";
  return "#EF4444";
}

// Plain bordered progress bar — thin border, no shadow.
export function ProgressBar({ value }: { value: number | null }) {
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2.5 border border-black/40 bg-white">
        <div
          className="h-full"
          style={{
            width: `${Math.max(0, Math.min(100, value ?? 0))}%`,
            backgroundColor: barColor(value),
          }}
        />
      </div>
      <span className={cn("text-xs font-bold w-9 text-right", scoreColor(value))}>
        {value != null ? `${value}%` : "—"}
      </span>
    </div>
  );
}

export function Avatar({ m }: { m: LiveMetrics }) {
  return m.avatar ? (
    <img
      src={m.avatar}
      alt={m.firstName}
      className="w-8 h-8 rounded-full border border-black/30 object-cover shrink-0"
    />
  ) : (
    <div className="w-8 h-8 rounded-full bg-[#024BAB] flex items-center justify-center text-xs font-bold text-white shrink-0">
      {m.firstName?.[0]?.toUpperCase()}
    </div>
  );
}

export function LiveMetricsTable({
  data,
  initialCount = 5,
}: {
  data: LiveMetrics[];
  initialCount?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...data].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const rows = showAll ? sorted : sorted.slice(0, initialCount);

  return (
    <>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              {["#", "Employee", "Score", "Attendance", "Tasks"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left text-xs font-bold text-black uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={m.employeeId} className="border-b border-black/10">
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {i + 1}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar m={m} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-black truncate">
                        {m.firstName} {m.lastName}
                      </p>
                      {m.designation && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {m.designation}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <ProgressBar value={m.score} />
                </td>
                <td className="px-3 py-2 text-xs text-black">
                  {m.attendancePct != null ? `${m.attendancePct}%` : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-black">
                  {m.totalTasks > 0
                    ? `${m.completedTasks}/${m.totalTasks}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > initialCount && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-xs font-bold text-[#024BAB] hover:underline"
        >
          {showAll ? "Show less" : `View more (${sorted.length - initialCount})`}
        </button>
      )}
    </>
  );
}
