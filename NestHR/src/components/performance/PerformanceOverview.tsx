import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import {
  Users,
  Activity,
  CalendarCheck,
  ListChecks,
  Banknote,
  Trophy,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { performanceAPI } from '../../api/api';
import { C } from '../../theme';
import StatTile, { tileGrid } from '../common/StatTile';
import ExportButton from '../common/ExportButton';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SPLIT = [
  { key: 'present', label: 'Present', color: C.success },
  { key: 'late', label: 'Late', color: '#EAB308' },
  { key: 'halfDay', label: 'Half Day', color: '#A855F7' },
  { key: 'onLeave', label: 'Leave', color: C.primary },
  { key: 'absent', label: 'Absent', color: C.danger },
];

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};
const scoreColor = (s: number | null) => (s == null ? '#9CA3AF' : s >= 80 ? C.success : s >= 50 ? C.secondary : C.danger);
const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** HR / admin: every active employee's performance for a month — stat tiles, graphs, then the detail table. */
export default function PerformanceOverview() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<any[] | null>(null); // null = not allowed / failed -> render nothing
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    performanceAPI
      .getOverview({ month: String(month), year: String(year) })
      .then((r: any) => setRows(r.data || []))
      .catch(() => setRows(null))
      .finally(() => setLoading(false));
  }, [month, year]);

  const shift = (d: number) => {
    const dt = new Date(year, month - 1 + d, 1);
    setYear(dt.getFullYear());
    setMonth(dt.getMonth() + 1);
  };

  const sorted = useMemo(() => [...(rows || [])].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)), [rows]);
  if (!loading && rows === null) return null;

  const withLoan = sorted.filter(r => r.hasLoan);
  const top = sorted.find(r => r.score != null);
  const split = SPLIT.map(s => ({ ...s, value: sorted.reduce((t, r) => t + (r[s.key] || 0), 0) })).filter(s => s.value > 0);
  const bars = sorted
    .filter(r => r.score != null)
    .slice(0, 8)
    .map(r => ({
      value: r.score as number,
      label: String(r.firstName || '').slice(0, 6),
      frontColor: scoreColor(r.score),
      topLabelComponent: () => <Text style={{ fontSize: 9, fontWeight: '700' }}>{r.score}</Text>,
    }));
  const pct = (v: number | null) => (v == null ? '—' : `${v}%`);

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.monthRow}>
        <TouchableOpacity onPress={() => shift(-1)} style={styles.navBtn}>
          <ChevronLeft size={16} color={C.black} />
        </TouchableOpacity>
        <Text style={styles.monthText}>
          Employee Performance · {MONTHS[month - 1]} {year}
        </Text>
        <TouchableOpacity onPress={() => shift(1)} style={styles.navBtn}>
          <ChevronRight size={16} color={C.black} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={C.primary} style={{ paddingVertical: 30 }} />
      ) : (
        <>
          <View style={tileGrid}>
            <StatTile label="Employees" value={sorted.length} icon={Users} color={C.primary} />
            <StatTile label="Avg Score" value={pct(avg(sorted.map(r => r.score)))} icon={Activity} color={C.success} />
            <StatTile label="Avg Attendance" value={pct(avg(sorted.map(r => r.attendancePct)))} icon={CalendarCheck} color="#A855F7" />
            <StatTile label="Task Completion" value={pct(avg(sorted.map(r => r.taskPct)))} icon={ListChecks} color={C.secondary} />
            <StatTile
              label="With Loan"
              value={withLoan.length}
              sub={withLoan.length ? `${money(withLoan.reduce((t, r) => t + r.loanBalance, 0))} due` : undefined}
              icon={Banknote}
              color={C.danger}
            />
            <StatTile label="Top Performer" value={top ? top.firstName : '—'} sub={top ? `${top.score}%` : undefined} icon={Trophy} color="#EAB308" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Score by employee (top 8)</Text>
            {bars.length ? (
              <BarChart
                data={bars}
                barWidth={26}
                spacing={14}
                noOfSections={4}
                maxValue={100}
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisLabelTextStyle={{ fontSize: 9, color: C.black }}
                yAxisTextStyle={{ fontSize: 9 }}
                width={250}
                height={140}
                isAnimated
              />
            ) : (
              <Text style={styles.muted}>No scores yet this month.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Attendance split</Text>
            {split.length ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
                <PieChart data={split.map(s => ({ value: s.value, color: s.color }))} donut radius={56} innerRadius={36} innerCircleColor={C.white} />
                <View style={{ gap: 6 }}>
                  {split.map(s => (
                    <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 10, height: 10, backgroundColor: s.color, borderWidth: 1, borderColor: C.black }} />
                      <Text style={styles.legend}>
                        {s.label} {s.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={styles.muted}>No attendance marked yet.</Text>
            )}
          </View>

          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.cardTitle}>All employees</Text>
              <ExportButton
                name={`performance_${year}_${String(month).padStart(2, '0')}`}
                label=""
                rows={sorted}
                cols={[
                  { header: 'Emp Code', value: (r: any) => r.employeeCode },
                  { header: 'Employee', value: (r: any) => `${r.firstName} ${r.lastName}` },
                  { header: 'Designation', value: (r: any) => r.designation },
                  { header: 'Department', value: (r: any) => r.department },
                  { header: 'Salary', value: (r: any) => r.salary },
                  { header: 'Attendance %', value: (r: any) => r.attendancePct },
                  { header: 'Present', value: (r: any) => r.present },
                  { header: 'Late', value: (r: any) => r.late },
                  { header: 'Half Day', value: (r: any) => r.halfDay },
                  { header: 'Absent', value: (r: any) => r.absent },
                  { header: 'Leave Days', value: (r: any) => r.leaveDays },
                  { header: 'Work Hrs', value: (r: any) => r.workHours },
                  { header: 'OT Hrs', value: (r: any) => r.overtimeHours },
                  { header: 'Tasks Done', value: (r: any) => `${r.tasksDone}/${r.tasksTotal}` },
                  { header: 'Loan Taken', value: (r: any) => (r.hasLoan ? 'Yes' : 'No') },
                  { header: 'Loan Balance', value: (r: any) => r.loanBalance },
                  { header: 'Review Rating', value: (r: any) => r.reviewRating },
                  { header: 'Score %', value: (r: any) => r.score },
                ]}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={[styles.tRow, { backgroundColor: '#EFF6FF' }]}>
                  {[
                    ['Code', 70], ['Employee', 150], ['Designation', 110], ['Salary', 80], ['Attend.', 64],
                    ['P/L/H/A', 80], ['Leave', 48], ['Hours', 70], ['Tasks', 60], ['Loan', 80], ['Review', 56], ['Score', 56],
                  ].map(([h, w]) => (
                    <Text key={String(h)} style={[styles.tCell, styles.tHead, { width: Number(w) }]}>
                      {h}
                    </Text>
                  ))}
                </View>
                {sorted.map((r, i) => (
                  <View key={r._id} style={[styles.tRow, i % 2 ? { backgroundColor: '#F8FAFF' } : null]}>
                    <Text style={[styles.tCell, { width: 70, fontWeight: '800' }]}>{r.employeeCode}</Text>
                    <View style={[styles.tCell, { width: 150, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                      {r.avatar ? (
                        <Image source={{ uri: r.avatar }} style={styles.photo} />
                      ) : (
                        <View style={[styles.photo, { backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ color: C.white, fontSize: 10, fontWeight: '700' }}>{r.firstName?.[0]}</Text>
                        </View>
                      )}
                      <Text style={{ fontSize: 11, fontWeight: '700', color: C.black, flexShrink: 1 }} numberOfLines={1}>
                        {r.firstName} {r.lastName}
                      </Text>
                    </View>
                    <Text style={[styles.tCell, { width: 110 }]} numberOfLines={1}>{r.designation || '—'}</Text>
                    <Text style={[styles.tCell, { width: 80, fontWeight: '700' }]}>{r.salary ? money(r.salary) : '—'}</Text>
                    <Text style={[styles.tCell, { width: 64, fontWeight: '800', color: scoreColor(r.attendancePct) }]}>{pct(r.attendancePct)}</Text>
                    <Text style={[styles.tCell, { width: 80, fontWeight: '700' }]}>
                      {r.present}/{r.late}/{r.halfDay}/{r.absent}
                    </Text>
                    <Text style={[styles.tCell, { width: 48 }]}>{r.leaveDays ? `${r.leaveDays}d` : '—'}</Text>
                    <Text style={[styles.tCell, { width: 70 }]}>
                      {r.workHours}h{r.overtimeHours > 0 ? ` +${r.overtimeHours}` : ''}
                    </Text>
                    <Text style={[styles.tCell, { width: 60 }]}>{r.tasksTotal ? `${r.tasksDone}/${r.tasksTotal}` : '—'}</Text>
                    <Text style={[styles.tCell, { width: 80, fontWeight: '700', color: r.hasLoan ? C.danger : C.success }]}>
                      {r.hasLoan ? money(r.loanBalance) : 'No'}
                    </Text>
                    <Text style={[styles.tCell, { width: 56, fontWeight: '700' }]}>{r.reviewRating != null ? `${r.reviewRating}/5` : '—'}</Text>
                    <Text style={[styles.tCell, { width: 56, fontWeight: '800', color: scoreColor(r.score) }]}>{pct(r.score)}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { borderWidth: 2, borderColor: C.black, padding: 5, backgroundColor: C.white },
  monthText: { fontSize: 13, fontWeight: '800', color: C.black, flex: 1, textAlign: 'center' },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 12,
    gap: 8,
  },
  cardTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', color: C.black, letterSpacing: 0.5 },
  muted: { fontSize: 12, color: C.textMuted },
  legend: { fontSize: 11, fontWeight: '700', color: C.black },
  tRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tCell: { paddingHorizontal: 6, paddingVertical: 8, fontSize: 11, color: C.black },
  tHead: { fontWeight: '800', textTransform: 'uppercase', fontSize: 10 },
  photo: { width: 22, height: 22, borderRadius: 11 },
});
