import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { employeeAPI, payrollAPI, attendanceAPI } from '../../api/api';
import { C } from '../../theme';
import AnimatedBarChart from '../common/AnimatedBarChart';
import FadeInUp from '../motion/FadeInUp';

const TABS = [
  { id: 'headcount', label: 'Headcount' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'salary', label: 'Salary' },
  { id: 'compliance', label: 'PF / ESI' },
];
const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const sum = (a: any[], k: string) => a.reduce((s, x) => s + (x[k] || 0), 0);

function Tile({ label, value, color = C.primary, i = 0 }: any) {
  return (
    <FadeInUp delay={i * 60} style={[st.tile, { borderColor: color }]}>
      <Text style={st.tileLabel}>{label}</Text>
      <Text style={[st.tileValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </FadeInUp>
  );
}

/** Mobile twin of the web Reports > Analytics tab (current month). */
export default function AnalyticsView() {
  const [tab, setTab] = useState('headcount');
  const [emps, setEmps] = useState<any[]>([]);
  const [pay, setPay] = useState<any[]>([]);
  const [att, setAtt] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    const n = new Date();
    const q = {
      month: String(n.getMonth() + 1),
      year: String(n.getFullYear()),
      limit: '5000',
    };
    Promise.all([
      employeeAPI.getAll({ status: 'active' }),
      payrollAPI.getAll(q),
      attendanceAPI.getAll(q),
    ])
      .then(([e, p, a]: any[]) => {
        setEmps(e.data || []);
        setPay(p.data || []);
        setAtt(a.data || []);
      })
      .catch((e: any) => setErr(e?.message || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  const depts = useMemo(() => {
    const m = new Map<
      string,
      {
        name: string;
        count: number;
        male: number;
        female: number;
        salary: number;
      }
    >();
    emps.forEach(e => {
      const name = e.department?.name || 'No Dept';
      const d = m.get(name) || {
        name,
        count: 0,
        male: 0,
        female: 0,
        salary: 0,
      };
      d.count++;
      d.salary += e.salary || 0;
      if (e.gender === 'male') d.male++;
      else if (e.gender === 'female') d.female++;
      m.set(name, d);
    });
    return Array.from(m.values()).sort((a, b) => b.count - a.count);
  }, [emps]);

  const a = useMemo(() => {
    const c = (s: string) => att.filter(x => x.status === s).length;
    return {
      present: c('present'),
      late: c('late'),
      absent: c('absent'),
      leave: c('on_leave'),
    };
  }, [att]);

  if (loading)
    return (
      <ActivityIndicator
        style={{ marginTop: 40 }}
        size="large"
        color={C.primary}
      />
    );
  if (err) return <Text style={st.err}>{err}</Text>;

  const male = emps.filter(e => e.gender === 'male').length;
  const female = emps.filter(e => e.gender === 'female').length;
  const slices = [
    { value: a.present, color: '#00C48C', label: 'Present' },
    { value: a.late, color: '#FA731C', label: 'Late' },
    { value: a.absent, color: '#EF4444', label: 'Absent' },
    { value: a.leave, color: '#024BAB', label: 'On Leave' },
  ];
  const total = slices.reduce((s, x) => s + x.value, 0);

  return (
    <View style={{ flex: 1 }}>
      <View style={st.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[st.tab, tab === t.id && st.tabOn]}
            onPress={() => setTab(t.id)}
          >
            <Text style={[st.tabText, tab === t.id && { color: C.white }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      >
        {tab === 'headcount' && (
          <>
            <View style={st.grid}>
              <Tile i={0} label="Total Active" value={emps.length} />
              <Tile i={1} label="Male" value={male} color="#024BAB" />
              <Tile i={2} label="Female" value={female} color="#A855F7" />
              <Tile
                i={3}
                label="Departments"
                value={depts.length}
                color="#FA731C"
              />
            </View>
            {!!depts.length && (
              <View style={st.card}>
                <Text style={st.cardTitle}>Headcount by Department</Text>
                <AnimatedBarChart
                  legend
                  stacked
                  series={[
                    { key: 'male', label: 'Male', color: '#024BAB' },
                    { key: 'female', label: 'Female', color: '#A855F7' },
                  ]}
                  data={depts.slice(0, 8).map(d => ({
                    label: d.name.slice(0, 5),
                    values: { male: d.male, female: d.female },
                  }))}
                />
              </View>
            )}
          </>
        )}
        {tab === 'attendance' && (
          <>
            <View style={st.grid}>
              {slices.map((x, i) => (
                <Tile
                  key={x.label}
                  i={i}
                  label={x.label}
                  value={x.value}
                  color={x.color}
                />
              ))}
            </View>
            <View style={[st.card, { alignItems: 'center' }]}>
              <Text style={st.cardTitle}>This month</Text>
              {total > 0 ? (
                <PieChart
                  data={slices.filter(x => x.value > 0)}
                  donut
                  radius={80}
                  innerRadius={50}
                />
              ) : (
                <Text style={st.muted}>No attendance records this month</Text>
              )}
            </View>
          </>
        )}
        {tab === 'salary' && (
          <>
            <View style={st.grid}>
              <Tile
                i={0}
                label="Total Gross"
                value={inr(sum(pay, 'grossSalary'))}
              />
              <Tile
                i={1}
                label="Total Net"
                value={inr(sum(pay, 'netSalary'))}
                color="#00C48C"
              />
              <Tile
                i={2}
                label="Deductions"
                value={inr(sum(pay, 'totalDeductions'))}
                color="#EF4444"
              />
            </View>
            {!!depts.length && (
              <View style={st.card}>
                <Text style={st.cardTitle}>
                  Monthly salary by department (₹k)
                </Text>
                <AnimatedBarChart
                  series={[
                    { key: 'salary', label: 'Salary', color: C.primary },
                  ]}
                  data={depts.slice(0, 8).map(d => ({
                    label: d.name.slice(0, 5),
                    values: { salary: Math.round(d.salary / 1000) },
                  }))}
                />
              </View>
            )}
          </>
        )}
        {tab === 'compliance' && (
          <View style={st.grid}>
            <Tile i={0} label="PF Contribution" value={inr(sum(pay, 'pf'))} />
            <Tile
              i={1}
              label="ESI Contribution"
              value={inr(sum(pay, 'esi'))}
              color="#00C48C"
            />
            <Tile
              i={2}
              label="TDS Collected"
              value={inr(sum(pay, 'tds'))}
              color="#FA731C"
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderColor: '#000',
    backgroundColor: C.white,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabOn: { backgroundColor: C.primary },
  tabText: { fontSize: 12, color: C.black },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '47%',
    borderWidth: 2,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    backgroundColor: C.white,
    padding: 12,
    borderRadius: 8,
  },
  tileLabel: { fontSize: 11, color: C.textMuted, textTransform: 'uppercase' },
  tileValue: { fontSize: 20, marginTop: 4 },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: '#000',
    padding: 14,
  },
  cardTitle: { fontSize: 13, color: C.black, marginBottom: 8 },
  muted: { color: C.textMuted, fontSize: 12 },
  err: { margin: 24, color: C.danger },
});
