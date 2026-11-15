import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { employeeAPI, promotionAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import AnimatedValue from '../components/motion/AnimatedValue';
import FadeInUp from '../components/motion/FadeInUp';
import PickerField from '../components/common/PickerField';
import { DatePickerField } from '../components/common/DatePickerField';
import { CENTER } from '../components/common/centerModal';
import { C, useResponsive } from '../theme';
import { titleCase } from '../utils/text';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const money = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const signed = (n: number) =>
  `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n))}`;
const dt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');
const today = () => new Date().toISOString().split('T')[0];

const STATUS: Record<string, { color: string; label: string }> = {
  increased: { color: C.success, label: 'Increased' },
  decreased: { color: C.danger, label: 'Decreased' },
  no_change: { color: C.textMuted, label: 'No change' },
};
const KIND: Record<string, { color: string; label: string }> = {
  promotion: { color: C.primary, label: 'Promotion' },
  increment: { color: C.success, label: 'Increment' },
  decrease: { color: C.danger, label: 'Decrease' },
};

const EMPTY = {
  employee: '',
  newSalary: '',
  designation: '',
  reason: '',
  remarks: '',
  effectiveDate: today(),
};

export default function PromotionsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { isTablet, maxContentWidth } = useResponsive();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'hr_manager';

  const now = new Date();
  const [tab, setTab] = useState<'report' | 'history'>('report');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [mine, setMine] = useState<any>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [employees, setEmployees] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      if (isAdmin) {
        const [r, h] = await Promise.all([
          promotionAPI.getReport({ month: String(month), year: String(year) }),
          promotionAPI.getAll(),
        ]);
        if (r?.success) setReport(r.data);
        if (h?.success) setHistory(h.data || []);
      } else {
        const r = await promotionAPI.getMy();
        if (r?.success) setMine(r.data);
      }
    } catch (e: any) {
      Alert.alert('Could not load', e.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, month, year]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    employeeAPI
      .getAll({ status: 'active' })
      .then((r: any) => setEmployees(r?.data || []))
      .catch(() => {});
  }, [isAdmin]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const shiftMonth = (d: number) => {
    const m = month + d;
    if (m < 1) {
      setMonth(12);
      setYear(y => y - 1);
    } else if (m > 12) {
      setMonth(1);
      setYear(y => y + 1);
    } else setMonth(m);
  };

  const selectedEmp = employees.find(e => e._id === form.employee);
  const current = selectedEmp?.salary ?? 0;
  const newNum = Number(form.newSalary);
  const delta =
    form.newSalary !== '' && !isNaN(newNum) ? newNum - current : null;
  const deltaPct =
    delta !== null && current > 0 ? (delta / current) * 100 : null;

  const submit = async () => {
    if (!form.employee || !(newNum > 0) || !form.reason.trim()) {
      Alert.alert(
        'Missing details',
        'Employee, new salary and reason are required.',
      );
      return;
    }
    setSaving(true);
    try {
      await promotionAPI.create({
        employee: form.employee,
        newSalary: newNum,
        reason: form.reason.trim(),
        designation: form.designation.trim() || undefined,
        remarks: form.remarks.trim() || undefined,
        effectiveDate: form.effectiveDate,
      });
      setModal(false);
      setForm({ ...EMPTY });
      employeeAPI
        .getAll({ status: 'active' })
        .then((r: any) => setEmployees(r?.data || []))
        .catch(() => {});
      load();
      Alert.alert('Saved', 'Salary updated and the employee was notified.');
    } catch (e: any) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(
    () =>
      (report?.rows || []).filter((r: any) => !filter || r.status === filter),
    [report, filter],
  );
  const sum = report?.summary;
  const wrap = isTablet
    ? {
        maxWidth: maxContentWidth,
        width: '100%' as const,
        alignSelf: 'center' as const,
      }
    : null;

  const Header = (
    <View style={[styles.header, wrap]}>
      <View style={styles.headerLeft}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 4 }}
        >
          <ChevronLeft size={24} color={C.black} />
        </TouchableOpacity>
        <Award size={20} color={C.primary} />
        <Text style={styles.headerTitle}>
          {isAdmin ? 'Promotions' : 'My Growth'}
        </Text>
      </View>
      {isAdmin && (
        <TouchableOpacity
          onPress={() => setModal(true)}
          accessibilityLabel="Add promotion or increment"
          hitSlop={8}
          style={{ padding: 4 }}
        >
          <Plus size={24} color={C.primary} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {Header}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Employee: own salary journey ──
  if (!isAdmin) {
    const revs = [...(mine?.revisions || [])].reverse();
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {Header}
        <FlatList
          data={revs}
          keyExtractor={i => i._id}
          contentContainerStyle={[styles.list, wrap]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
            />
          }
          ListHeaderComponent={
            <FadeInUp>
              <View style={styles.statRow}>
                <Stat
                  label="Current salary"
                  value={money(mine?.currentSalary)}
                />
                <Stat
                  label="Total growth"
                  value={`${signed(mine?.totalGrowthAmount || 0)}`}
                  color={
                    (mine?.totalGrowthAmount || 0) >= 0 ? C.success : C.danger
                  }
                  sub={`${mine?.totalGrowthPct ?? 0}%`}
                />
              </View>
              <Text style={styles.section}>Salary history</Text>
            </FadeInUp>
          }
          ListEmptyComponent={<Empty text="No revisions yet" />}
          renderItem={({ item }) => <RevisionCard r={item} />}
        />
      </SafeAreaView>
    );
  }

  // ── Admin / HR ──
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {Header}
      <View style={[styles.tabs, wrap]}>
        {(['report', 'history'] as const).map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && { color: C.white }]}>
              {t === 'report' ? 'Monthly report' : 'History'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'report' ? (
        <FlatList
          key={isTablet ? 'g2' : 'l1'}
          data={rows}
          numColumns={isTablet ? 2 : 1}
          columnWrapperStyle={isTablet ? { gap: 12 } : undefined}
          keyExtractor={i => i.employeeId}
          contentContainerStyle={[styles.list, wrap]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
            />
          }
          ListHeaderComponent={
            <View>
              <View style={styles.monthRow}>
                <TouchableOpacity
                  onPress={() => shiftMonth(-1)}
                  style={styles.monthBtn}
                >
                  <ChevronLeft size={18} color={C.black} />
                </TouchableOpacity>
                <Text style={styles.monthText}>
                  {MONTHS[month - 1]} {year}
                </Text>
                <TouchableOpacity
                  onPress={() => shiftMonth(1)}
                  style={styles.monthBtn}
                >
                  <ChevronRight size={18} color={C.black} />
                </TouchableOpacity>
              </View>
              {sum && (
                <View style={styles.statRow}>
                  <Stat
                    label="Increased"
                    value={String(sum.increased)}
                    color={C.success}
                  />
                  <Stat
                    label="Promotions"
                    value={String(sum.promotions)}
                    color={C.primary}
                  />
                  <Stat label="Avg raise" value={`${sum.avgIncreasePct}%`} />
                </View>
              )}
              {sum && (
                <View style={styles.statRow}>
                  <Stat
                    label="Payroll before"
                    value={money(sum.monthlyPayrollBefore)}
                  />
                  <Stat
                    label="Payroll after"
                    value={money(sum.monthlyPayrollAfter)}
                  />
                </View>
              )}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {[
                  ['', 'All'],
                  ['increased', 'Increased'],
                  ['no_change', 'No change'],
                  ['decreased', 'Decreased'],
                ].map(([k, l]) => (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setFilter(k)}
                    style={[styles.chip, filter === k && styles.chipActive]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        filter === k && { color: C.white },
                      ]}
                    >
                      {l}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={<Empty text="No employees for this month" />}
          renderItem={({ item }) => <ReportCard r={item} wide={isTablet} />}
        />
      ) : (
        <FlatList
          key={isTablet ? 'h2' : 'h1'}
          data={history}
          numColumns={isTablet ? 2 : 1}
          columnWrapperStyle={isTablet ? { gap: 12 } : undefined}
          keyExtractor={i => i._id}
          contentContainerStyle={[styles.list, wrap]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
            />
          }
          ListEmptyComponent={<Empty text="No promotions or increments yet" />}
          renderItem={({ item }) => (
            <RevisionCard r={item} showEmployee wide={isTablet} />
          )}
        />
      )}

      <Modal
        visible={modal}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(false)}
      >
        <View style={CENTER.overlay}>
          <View style={CENTER.card}>
            <SafeAreaView style={styles.safe} edges={[]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Promotion / increment</Text>
                <TouchableOpacity onPress={() => setModal(false)}>
                  <X size={24} color={C.black} />
                </TouchableOpacity>
              </View>
              <ScrollView
                contentContainerStyle={{ padding: 20, gap: 16 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View>
                  <Text style={styles.label}>Employee *</Text>
                  <PickerField
                    title="Employee"
                    placeholder="Select employee"
                    value={form.employee}
                    onChange={v => setForm(p => ({ ...p, employee: v }))}
                    options={employees.map(e => ({
                      value: e._id,
                      label: `${e.firstName} ${e.lastName} · ${e.employeeId}`,
                    }))}
                  />
                  {selectedEmp && (
                    <Text style={styles.hint}>
                      Current salary {money(current)}
                      {selectedEmp.designation
                        ? ` · ${selectedEmp.designation}`
                        : ''}
                    </Text>
                  )}
                </View>
                <View>
                  <Text style={styles.label}>New salary (₹/month) *</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={form.newSalary}
                    onChangeText={v =>
                      setForm(p => ({
                        ...p,
                        newSalary: v.replace(/[^0-9.]/g, ''),
                      }))
                    }
                    placeholder="0"
                    placeholderTextColor={C.textLight}
                  />
                  {delta !== null && (
                    <Text
                      style={[
                        styles.hint,
                        { color: delta >= 0 ? C.success : C.danger },
                      ]}
                    >
                      {signed(delta)}
                      {deltaPct !== null ? ` (${deltaPct.toFixed(1)}%)` : ''}
                    </Text>
                  )}
                </View>
                <View>
                  <Text style={styles.label}>
                    New designation (for a promotion)
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={form.designation}
                    onChangeText={v => setForm(p => ({ ...p, designation: v }))}
                    placeholder="Leave empty if unchanged"
                    placeholderTextColor={C.textLight}
                  />
                </View>
                <View>
                  <Text style={styles.label}>Reason *</Text>
                  <TextInput
                    style={styles.input}
                    value={form.reason}
                    onChangeText={v => setForm(p => ({ ...p, reason: v }))}
                    placeholder="Annual appraisal, promotion…"
                    placeholderTextColor={C.textLight}
                  />
                </View>
                <View>
                  <DatePickerField
                    label="Effective date"
                    value={form.effectiveDate}
                    onChange={v => setForm(p => ({ ...p, effectiveDate: v }))}
                  />
                </View>
                <View>
                  <Text style={styles.label}>Remarks (HR only)</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 70 }]}
                    multiline
                    value={form.remarks}
                    onChangeText={v => setForm(p => ({ ...p, remarks: v }))}
                    placeholderTextColor={C.textLight}
                  />
                </View>
                <TouchableOpacity
                  style={styles.submit}
                  onPress={submit}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <Text style={styles.submitText}>Save and notify</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  color = C.black,
  sub,
}: {
  label: string;
  value: string;
  color?: string;
  sub?: string;
}) {
  return (
    <View style={styles.stat}>
      <AnimatedValue style={[styles.statVal, { color }]} value={value} />
      {sub ? <Text style={[styles.statSub, { color }]}>{sub}</Text> : null}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Award size={40} color="#D1D5DB" />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function ReportCard({ r, wide }: { r: any; wide?: boolean }) {
  const st = STATUS[r.status] || STATUS.no_change;
  const Icon =
    r.status === 'increased'
      ? ArrowUpRight
      : r.status === 'decreased'
      ? ArrowDownRight
      : Minus;
  return (
    <View style={[styles.card, wide && { flex: 1 }]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{r.name}</Text>
          <Text style={styles.meta}>
            {r.code} · {r.designation || '—'}
            {r.department ? ` · ${r.department}` : ''}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: st.color }]}>
          <Icon size={12} color={C.white} />
          <Text style={styles.badgeText}>{st.label}</Text>
        </View>
      </View>
      <View style={styles.salRow}>
        <Text style={styles.salOld}>{money(r.openingSalary)}</Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.salNew}>{money(r.closingSalary)}</Text>
        {r.change !== 0 && (
          <Text style={[styles.delta, { color: st.color }]}>
            {signed(r.change)} ({r.changePct}%)
          </Text>
        )}
      </View>
      {!!r.previousDesignation && r.previousDesignation !== r.designation && (
        <Text style={styles.meta}>
          {r.previousDesignation} → {r.designation}
        </Text>
      )}
      {r.reasons?.length > 0 && (
        <Text style={styles.reason} numberOfLines={2}>
          {r.reasons.join(', ')}
        </Text>
      )}
    </View>
  );
}

function RevisionCard({
  r,
  showEmployee,
  wide,
}: {
  r: any;
  showEmployee?: boolean;
  wide?: boolean;
}) {
  const k = KIND[r.kind] || KIND.increment;
  const emp = r.employee;
  return (
    <View style={[styles.card, wide && { flex: 1 }]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          {showEmployee && emp ? (
            <Text style={styles.name}>
              {emp.firstName} {emp.lastName}
              <Text style={styles.meta}> · {emp.employeeId}</Text>
            </Text>
          ) : (
            <Text style={styles.name}>{titleCase(r.reason) || k.label}</Text>
          )}
          <Text style={styles.meta}>
            {dt(r.effectiveDate)}
            {showEmployee && r.reason ? ` · ${r.reason}` : ''}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: k.color }]}>
          <Text style={styles.badgeText}>{k.label}</Text>
        </View>
      </View>
      <View style={styles.salRow}>
        <Text style={styles.salOld}>{money(r.previousSalary)}</Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.salNew}>{money(r.newSalary)}</Text>
        <Text style={[styles.delta, { color: k.color }]}>
          {signed(r.changeAmount)} ({r.changePct}%)
        </Text>
      </View>
      {!!r.newDesignation && (
        <Text style={styles.meta}>
          {r.previousDesignation ? `${r.previousDesignation} → ` : ''}
          {r.newDesignation}
        </Text>
      )}
    </View>
  );
}

const brutal = {
  borderWidth: 2,
  borderRadius: 8,
  borderRightWidth: 4,
  borderBottomWidth: 4,
  borderColor: C.black,
  borderRightColor: '#0A0A0A',
  borderBottomColor: '#0A0A0A',
} as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, color: C.black },
  tabs: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    backgroundColor: C.white,
    ...brutal,
  },
  tabActive: { backgroundColor: C.primary },
  tabText: { fontSize: 13, color: C.black },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthBtn: { padding: 8, backgroundColor: C.white, ...brutal },
  monthText: { fontSize: 16, color: C.black },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stat: {
    flex: 1,
    minWidth: 0,
    backgroundColor: C.white,
    padding: 12,
    alignItems: 'center',
    ...brutal,
  },
  statVal: { fontSize: 18, color: C.black },
  statSub: { fontSize: 12 },
  statLabel: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  section: { fontSize: 11, color: C.textMuted, marginTop: 6, marginBottom: 4 },
  chips: { gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: C.white,
    ...brutal,
  },
  chipActive: { backgroundColor: C.primary },
  chipText: { fontSize: 12, color: C.black },
  card: { backgroundColor: C.white, padding: 14, gap: 8, ...brutal },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: 15, color: C.black },
  meta: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2,
    borderRadius: 999,
    borderColor: C.black,
  },
  badgeText: { fontSize: 11, color: C.white },
  salRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  salOld: {
    fontSize: 13,
    color: C.textMuted,
    textDecorationLine: 'line-through',
  },
  arrow: { fontSize: 13, color: C.black },
  salNew: { fontSize: 15, color: C.black },
  delta: { fontSize: 12 },
  reason: { fontSize: 12, color: C.textMuted },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, color: C.textMuted },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  modalTitle: { fontSize: 20, color: C.black },
  label: { fontSize: 12, color: C.black, marginBottom: 4 },
  hint: { fontSize: 12, color: C.textMuted, marginTop: 6 },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: C.black,
    backgroundColor: C.white,
    ...brutal,
  },
  submit: {
    backgroundColor: C.primary,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    ...brutal,
  },
  submitText: { color: C.white, fontSize: 14 },
});
