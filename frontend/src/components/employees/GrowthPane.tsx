import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Award, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { promotionAPI } from "@/services/api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { NbTooltip } from "@/components/ui/ChartCard";

type Rev = {
  _id: string;
  effectiveDate: string;
  previousSalary: number;
  newSalary: number;
  changeAmount: number;
  changePct: number;
  kind: "promotion" | "increment" | "decrease";
  reason: string;
  previousDesignation?: string;
  newDesignation?: string;
};
type Growth = {
  currentSalary: number;
  currentDesignation: string;
  joinDate?: string;
  startSalary: number;
  totalGrowthAmount: number;
  totalGrowthPct: number;
  revisions: Rev[];
};

const shortDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

/** "My Profile → Growth": the employee's own salary journey (their reasons and designation, no internal remarks). */
export function GrowthPane() {
  const [data, setData] = useState<Growth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    promotionAPI
      .getMy()
      .then((r: any) => r?.success && setData(r.data))
      .catch((e: any) => setError(e.message || "Could not load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  if (error || !data)
    return (
      <div className="border-2 border-black bg-white p-10 text-center text-muted-foreground">
        {error || "No data"}
      </div>
    );

  const { revisions } = data;
  const chart = [
    ...(data.joinDate
      ? [{ label: shortDate(data.joinDate), salary: data.startSalary }]
      : [{ label: "Start", salary: data.startSalary }]),
    ...revisions.map((r) => ({
      label: shortDate(r.effectiveDate),
      salary: r.newSalary,
    })),
  ];
  const newestFirst = [...revisions].reverse();

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="nb-rise border-2 border-black bg-white p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Started at",
              node: (
                <AnimatedNumber value={Math.round(data.startSalary)} prefix="₹" />
              ),
              color: "#6B7280",
            },
            {
              label: "Now",
              node: (
                <AnimatedNumber value={Math.round(data.currentSalary)} prefix="₹" />
              ),
              color: "#024BAB",
            },
            {
              label: "Total growth",
              node: (
                <span>
                  {data.totalGrowthAmount >= 0 ? "+" : "−"}
                  <AnimatedNumber
                    value={Math.round(Math.abs(data.totalGrowthAmount))}
                    prefix="₹"
                  />
                </span>
              ),
              color: data.totalGrowthAmount >= 0 ? "#00C48C" : "#EF4444",
            },
            {
              label: "Growth %",
              node: (
                <span>
                  {data.totalGrowthPct > 0 ? "+" : ""}
                  {data.totalGrowthPct}
                  <span className="text-xl">%</span>
                </span>
              ),
              color: "#A855F7",
            },
          ].map((k) => (
            <div
              key={k.label}
              className="border-l-4 pl-3"
              style={{ borderColor: k.color }}
            >
              <p className="text-2xl sm:text-3xl font-bold tabular-nums leading-none">
                {k.node}
              </p>
              <p className="text-xs font-bold text-black mt-1.5">{k.label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          {data.currentDesignation}
          {data.joinDate ? ` · joined ${formatDate(data.joinDate)}` : ""}
        </p>
      </div>

      {revisions.length === 0 ? (
        <div className="border-2 border-black bg-white p-10 text-center">
          <Award className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-bold text-black">No salary changes yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Raises and promotions will show up here, with the reason.
          </p>
        </div>
      ) : (
        <>
          {/* Salary over time */}
          <div className="nb-rise border-2 border-black bg-white p-5">
            <h3 className="font-display font-bold text-base text-black mb-1">
              Salary journey
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Monthly salary after each change
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={chart}
                margin={{ top: 18, right: 24, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fontWeight: 700, fill: "#0A0A0A" }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v) => `₹${Math.round(v / 1000)}K`}
                  domain={[
                    (min: number) => Math.max(0, Math.floor((min * 0.9) / 1000) * 1000),
                    (max: number) => Math.ceil((max * 1.08) / 1000) * 1000,
                  ]}
                />
                <Tooltip
                  content={
                    <NbTooltip />
                  }
                />
                <Line
                  type="stepAfter"
                  dataKey="salary"
                  name="Salary ₹"
                  stroke="#00C48C"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "#00C48C", stroke: "#0A0A0A", strokeWidth: 1.5 }}
                  activeDot={{ r: 7, stroke: "#0A0A0A", strokeWidth: 1.5 }}
                  animationDuration={1100}
                >
                  <LabelList
                    dataKey="salary"
                    position="top"
                    offset={10}
                    formatter={(v: number) => `₹${Math.round(v / 1000)}K`}
                    style={{ fontSize: 10, fontWeight: 700, fill: "#0A0A0A" }}
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Timeline */}
          <div className="border-2 border-black bg-white">
            <div className="px-4 py-3 bg-[#024BAB]/5 border-b-2 border-black">
              <p className="text-xs font-bold uppercase tracking-wider text-black">
                What changed, and why
              </p>
            </div>
            <ul className="divide-y divide-black/10">
              {newestFirst.map((r) => {
                const up = r.changeAmount >= 0;
                return (
                  <li key={r._id} className="flex gap-3 p-4">
                    <div
                      className={cn(
                        "w-9 h-9 border-2 border-black flex items-center justify-center shrink-0",
                        r.kind === "promotion"
                          ? "bg-[#A855F7]"
                          : up
                            ? "bg-[#00C48C]"
                            : "bg-[#EF4444]",
                      )}
                    >
                      {r.kind === "promotion" ? (
                        <Award className="w-4 h-4 text-white" />
                      ) : up ? (
                        <ArrowUpRight className="w-4 h-4 text-white" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <p className="text-sm font-bold text-black tabular-nums">
                          {formatCurrency(r.previousSalary)} →{" "}
                          {formatCurrency(r.newSalary)}
                        </p>
                        <p
                          className={cn(
                            "text-xs font-bold tabular-nums",
                            up ? "text-[#00A36C]" : "text-[#EF4444]",
                          )}
                        >
                          {up ? "+" : "−"}
                          {formatCurrency(Math.abs(r.changeAmount))} (
                          {r.changePct > 0 ? "+" : ""}
                          {r.changePct}%)
                        </p>
                        <p className="text-[11px] text-muted-foreground ml-auto">
                          {formatDate(r.effectiveDate)}
                        </p>
                      </div>
                      {r.newDesignation && (
                        <p className="text-xs mt-1">
                          <span className="text-muted-foreground line-through">
                            {r.previousDesignation}
                          </span>{" "}
                          → <b>{r.newDesignation}</b>
                        </p>
                      )}
                      <p className="text-xs text-black mt-1">{r.reason}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
