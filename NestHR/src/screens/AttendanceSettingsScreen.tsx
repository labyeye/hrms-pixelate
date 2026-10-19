import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldAlert,
  Clock,
  Save,
  ChevronLeft,
  IndianRupee,
  Percent,
  Users,
  CalendarClock,
  BarChart2,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { attendanceSettingsAPI, employeeAPI } from '../api/api';
import { C } from '../theme';
import ExportButton from '../components/common/ExportButton';
import PickerField from '../components/common/PickerField';

interface AttendanceSettings {
  shiftStartHour: number;
  shiftStartMinute: number;
  shiftEndHour: number;
  shiftEndMinute: number;
  lateThresholdMinutes: number;
  lateDeductionType: 'fixed' | 'percent';
  lateDeductionAmount: number;
  halfDayThresholdMinutes: number;
  earlyCheckoutThresholdMinutes: number;
  earlyCheckoutDeductionEnabled: boolean;
}

const DEFAULT: AttendanceSettings = {
  shiftStartHour: 9,
  shiftStartMinute: 0,
  shiftEndHour: 18,
  shiftEndMinute: 0,
  lateThresholdMinutes: 15,
  lateDeductionType: 'fixed',
  lateDeductionAmount: 0,
  halfDayThresholdMinutes: 120,
  earlyCheckoutThresholdMinutes: 15,
  earlyCheckoutDeductionEnabled: false,
};

const LEAVE_TYPES = [
  'casual',
  'sick',
  'earned',
  'maternity',
  'paternity',
  'unpaid',
  'compensatory',
  'hourly',
  'wfh',
  'outdoor_duty',
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function AttendanceSettingsScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<AttendanceSettings>(DEFAULT);
  const [employees, setEmployees] = useState<any[]>([]);

  // Late allowance state
  const [lateMode, setLateMode] = useState<'bulk' | 'custom'>('bulk');
  const [lateBulk, setLateBulk] = useState('0');
  const [latePerEmp, setLatePerEmp] = useState<Record<string, string>>({});
  const [savingLate, setSavingLate] = useState(false);

  // Leave allowance state
  const [leaveType, setLeaveType] = useState('casual');
  const [leaveMode, setLeaveMode] = useState<'bulk' | 'custom'>('bulk');
  const [leaveBulk, setLeaveBulk] = useState('0');
  const [leavePerEmp, setLeavePerEmp] = useState<Record<string, string>>({});
  const [savingLeave, setSavingLeave] = useState(false);

  // Balance summary
  const [summary, setSummary] = useState<any[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    Promise.all([attendanceSettingsAPI.get(), employeeAPI.getAll()])
      .then(([settingsRes, empRes]) => {
        if (settingsRes?.data) setRules({ ...DEFAULT, ...settingsRes.data });
        setEmployees(empRes?.data || []);
      })
      .catch(e => Alert.alert('Error', e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof AttendanceSettings, value: any) =>
    setRules(p => ({ ...p, [key]: value }));

  const numField = (
    key: keyof AttendanceSettings,
    label: string,
    hint?: string,
    suffix?: string,
  ) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.fieldInput, { flex: 1 }]}
          value={String((rules as any)[key] ?? '')}
          onChangeText={v => set(key, Number(v) || 0)}
          keyboardType="numeric"
          placeholderTextColor="#9CA3AF"
        />
        {suffix && (
          <View style={styles.suffix}>
            <Text style={styles.suffixText}>{suffix}</Text>
          </View>
        )}
      </View>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await attendanceSettingsAPI.update(rules);
      Alert.alert('Saved', 'Attendance settings updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLateAllowance = async () => {
    setSavingLate(true);
    try {
      await attendanceSettingsAPI.upsertLateAllowance(
        lateMode === 'bulk'
          ? { mode: 'bulk', bulkCount: Number(lateBulk) || 0 }
          : {
              mode: 'custom',
              perEmployee: Object.entries(latePerEmp).map(
                ([employee, count]) => ({
                  employee,
                  count: Number(count) || 0,
                }),
              ),
            },
      );
      Alert.alert('Saved', 'Late allowance updated');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingLate(false);
    }
  };

  const handleSaveLeaveAllowance = async () => {
    setSavingLeave(true);
    try {
      await attendanceSettingsAPI.upsertLeaveAllowance(
        leaveMode === 'bulk'
          ? { leaveType, mode: 'bulk', bulkDays: Number(leaveBulk) || 0 }
          : {
              leaveType,
              mode: 'custom',
              perEmployee: Object.entries(leavePerEmp).map(
                ([employee, days]) => ({
                  employee,
                  days: Number(days) || 0,
                }),
              ),
            },
      );
      Alert.alert('Saved', `Leave allowance updated for ${leaveType}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingLeave(false);
    }
  };

  const loadSummary = async () => {
    setShowSummary(p => !p);
    if (summary.length === 0) {
      try {
        const res = await attendanceSettingsAPI.getBalanceSummary();
        setSummary(res?.data || []);
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    }
  };

  // one usage column per leave type that has an allowance or any usage this month
  const usageTypes = LEAVE_TYPES.filter(t =>
    summary.some(r => (r.leaveUsed || []).some((l: any) => l.leaveType === t && (l.daysAllowed > 0 || l.daysUsed > 0))),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 4, marginRight: 4 }}
          >
            <ChevronLeft size={22} color={C.black} />
          </TouchableOpacity>
          <ShieldAlert size={20} color={C.primary} />
          <Text style={styles.headerTitle}>Attendance Settings</Text>
        </View>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : (
            <>
              <Save size={14} color={C.white} />
              <Text style={styles.saveBtnText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Shift Timings */}
        <View>
          <View style={styles.sectionHeader}>
            <Clock size={14} color={C.primary} />
            <Text style={styles.sectionTitle}>Shift Timings</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Shift Start</Text>
                <View style={styles.timeInputs}>
                  <TextInput
                    style={[styles.fieldInput, styles.timeInput]}
                    value={pad(rules.shiftStartHour)}
                    onChangeText={v =>
                      set(
                        'shiftStartHour',
                        Math.min(23, Math.max(0, Number(v) || 0)),
                      )
                    }
                    keyboardType="numeric"
                    maxLength={2}
                    placeholder="HH"
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text style={styles.timeSep}>:</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.timeInput]}
                    value={pad(rules.shiftStartMinute)}
                    onChangeText={v =>
                      set(
                        'shiftStartMinute',
                        Math.min(59, Math.max(0, Number(v) || 0)),
                      )
                    }
                    keyboardType="numeric"
                    maxLength={2}
                    placeholder="MM"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Shift End</Text>
                <View style={styles.timeInputs}>
                  <TextInput
                    style={[styles.fieldInput, styles.timeInput]}
                    value={pad(rules.shiftEndHour)}
                    onChangeText={v =>
                      set(
                        'shiftEndHour',
                        Math.min(23, Math.max(0, Number(v) || 0)),
                      )
                    }
                    keyboardType="numeric"
                    maxLength={2}
                    placeholder="HH"
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text style={styles.timeSep}>:</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.timeInput]}
                    value={pad(rules.shiftEndMinute)}
                    onChangeText={v =>
                      set(
                        'shiftEndMinute',
                        Math.min(59, Math.max(0, Number(v) || 0)),
                      )
                    }
                    keyboardType="numeric"
                    maxLength={2}
                    placeholder="MM"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Late Coming Rules */}
        <View>
          <View style={styles.sectionHeader}>
            <Clock size={14} color={C.warning} />
            <Text style={styles.sectionTitle}>Late Coming</Text>
          </View>
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                {numField('lateThresholdMinutes', 'Grace Period', undefined, 'min')}
              </View>
              <View style={{ flex: 1 }}>
                {numField('halfDayThresholdMinutes', 'Half Day If Late By', undefined, 'min')}
              </View>
            </View>
            <Text style={styles.hint}>
              Late after the grace period; half-day (50% pay) when later than the half-day limit.
            </Text>

            <View style={[styles.field, styles.fieldBorder]}>
              <Text style={styles.fieldLabel}>Deduction Type</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[styles.typeBtn, rules.lateDeductionType === 'fixed' && styles.typeBtnActive]}
                  onPress={() => set('lateDeductionType', 'fixed')}
                >
                  <IndianRupee size={12} color={rules.lateDeductionType === 'fixed' ? C.white : C.black} />
                  <Text style={[styles.typeBtnText, rules.lateDeductionType === 'fixed' && styles.typeBtnTextActive]}>
                    Fixed (₹)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, rules.lateDeductionType === 'percent' && styles.typeBtnActive]}
                  onPress={() => set('lateDeductionType', 'percent')}
                >
                  <Percent size={12} color={rules.lateDeductionType === 'percent' ? C.white : C.black} />
                  <Text style={[styles.typeBtnText, rules.lateDeductionType === 'percent' && styles.typeBtnTextActive]}>
                    % of Daily
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.field, styles.fieldBorder]}>
              {numField(
                'lateDeductionAmount',
                rules.lateDeductionType === 'fixed' ? 'Amount per Late Day (₹)' : '% of Daily Salary',
                undefined,
                rules.lateDeductionType === 'fixed' ? '₹' : '%',
              )}
            </View>
          </View>
        </View>

        {/* Early Checkout */}
        <View>
          <View style={styles.sectionHeader}>
            <Clock size={14} color={C.danger} />
            <Text style={styles.sectionTitle}>Early Checkout</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>
                  Enable Early Checkout Deduction
                </Text>
                <Text style={styles.toggleDesc}>
                  Deduct salary for employees who leave early
                </Text>
              </View>
              <Switch
                value={rules.earlyCheckoutDeductionEnabled}
                onValueChange={v => set('earlyCheckoutDeductionEnabled', v)}
                trackColor={{ false: '#E5E7EB', true: C.primary }}
                thumbColor={C.white}
              />
            </View>
            {rules.earlyCheckoutDeductionEnabled && (
              <View style={[styles.field, styles.fieldBorder]}>
                {numField(
                  'earlyCheckoutThresholdMinutes',
                  'Early Checkout Grace',
                  'Minutes before shift end that triggers deduction',
                  'min',
                )}
              </View>
            )}
          </View>
        </View>

        {/* Late + Leave allowance, side by side */}
        <View>
          <View style={styles.sectionHeader}>
            <CalendarClock size={14} color={C.primary} />
            <Text style={styles.sectionTitle}>Late & Leave Allowance / Month</Text>
          </View>
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={styles.fieldLabel}>Late</Text>
                {(['bulk', 'custom'] as const).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.typeBtn, lateMode === m && styles.typeBtnActive]}
                    onPress={() => setLateMode(m)}
                  >
                    <Text style={[styles.typeBtnText, lateMode === m && styles.typeBtnTextActive]}>
                      {m === 'bulk' ? 'Bulk' : 'Per employee'}
                    </Text>
                  </TouchableOpacity>
                ))}
                {lateMode === 'bulk' && (
                  <TextInput
                    style={styles.standaloneInput}
                    value={lateBulk}
                    onChangeText={setLateBulk}
                    keyboardType="numeric"
                    placeholder="Max lates"
                    placeholderTextColor="#9CA3AF"
                  />
                )}
                <TouchableOpacity style={styles.smallSaveBtn} onPress={handleSaveLateAllowance} disabled={savingLate}>
                  {savingLate ? <ActivityIndicator size="small" color={C.white} /> : <Text style={styles.smallSaveBtnText}>Save Late</Text>}
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={styles.fieldLabel}>Leave</Text>
                <PickerField
                  title="Leave type"
                  value={leaveType}
                  onChange={setLeaveType}
                  options={LEAVE_TYPES.map(t => ({ value: t, label: t.replace('_', ' ').toUpperCase() }))}
                />
                {(['bulk', 'custom'] as const).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.typeBtn, leaveMode === m && styles.typeBtnActive]}
                    onPress={() => setLeaveMode(m)}
                  >
                    <Text style={[styles.typeBtnText, leaveMode === m && styles.typeBtnTextActive]}>
                      {m === 'bulk' ? 'Bulk' : 'Per employee'}
                    </Text>
                  </TouchableOpacity>
                ))}
                {leaveMode === 'bulk' && (
                  <TextInput
                    style={styles.standaloneInput}
                    value={leaveBulk}
                    onChangeText={setLeaveBulk}
                    keyboardType="numeric"
                    placeholder="Days / month"
                    placeholderTextColor="#9CA3AF"
                  />
                )}
                <TouchableOpacity style={styles.smallSaveBtn} onPress={handleSaveLeaveAllowance} disabled={savingLeave}>
                  {savingLeave ? <ActivityIndicator size="small" color={C.white} /> : <Text style={styles.smallSaveBtnText}>Save Leave</Text>}
                </TouchableOpacity>
              </View>
            </View>

            {lateMode === 'custom' && (
              <View style={[styles.field, styles.fieldBorder]}>
                <Text style={styles.fieldLabel}>Late allowance per employee</Text>
                {employees.map(e => (
                  <View key={e._id} style={styles.perEmpRow}>
                    <Text style={styles.perEmpName} numberOfLines={1}>
                      {e.firstName} {e.lastName}
                    </Text>
                    <TextInput
                      style={styles.perEmpInput}
                      value={latePerEmp[e._id] ?? ''}
                      onChangeText={v => setLatePerEmp(p => ({ ...p, [e._id]: v }))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                ))}
              </View>
            )}
            {leaveMode === 'custom' && (
              <View style={[styles.field, styles.fieldBorder]}>
                <Text style={styles.fieldLabel}>{leaveType.replace('_', ' ')} days per employee</Text>
                {employees.map(e => (
                  <View key={e._id} style={styles.perEmpRow}>
                    <Text style={styles.perEmpName} numberOfLines={1}>
                      {e.firstName} {e.lastName}
                    </Text>
                    <TextInput
                      style={styles.perEmpInput}
                      value={leavePerEmp[e._id] ?? ''}
                      onChangeText={v => setLeavePerEmp(p => ({ ...p, [e._id]: v }))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Balance Summary */}
        <View>
          <TouchableOpacity style={styles.sectionHeader} onPress={loadSummary}>
            <BarChart2 size={14} color={C.primary} />
            <Text style={styles.sectionTitle}>
              Balance Summary {showSummary ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          {showSummary && (
            <View style={styles.card}>
              {summary.length === 0 ? (
                <Text style={styles.hint}>No usage recorded this month yet.</Text>
              ) : (
                <>
                  <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
                    <ExportButton
                      name="attendance_balance_summary"
                      rows={summary}
                      cols={[
                        { header: 'Emp Code', value: (r: any) => r.employee?.employeeId },
                        { header: 'Employee', value: (r: any) => `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim() },
                        { header: 'Designation', value: (r: any) => r.employee?.designation },
                        { header: 'Late Used', value: (r: any) => `${r.lateUsed}/${r.lateAllowed}` },
                        ...usageTypes.map(t => ({
                          header: t,
                          value: (r: any) => {
                            const l = (r.leaveUsed || []).find((x: any) => x.leaveType === t);
                            return l ? `${l.daysUsed}/${l.daysAllowed}` : '';
                          },
                        })),
                      ]}
                    />
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator>
                    <View>
                      <View style={[styles.tRow, { backgroundColor: '#EFF6FF' }]}>
                        <Text style={[styles.tCell, styles.tHead, { width: 70 }]}>Code</Text>
                        <Text style={[styles.tCell, styles.tHead, { width: 150 }]}>Employee</Text>
                        <Text style={[styles.tCell, styles.tHead, { width: 110 }]}>Designation</Text>
                        <Text style={[styles.tCell, styles.tHead, { width: 60 }]}>Late</Text>
                        {usageTypes.map(t => (
                          <Text key={t} style={[styles.tCell, styles.tHead, { width: 70 }]}>
                            {t.replace('_', ' ')}
                          </Text>
                        ))}
                      </View>
                      {summary.map((row, i) => (
                        <View key={row.employee?._id || i} style={[styles.tRow, i % 2 ? { backgroundColor: '#F8FAFF' } : null]}>
                          <Text style={[styles.tCell, { width: 70, fontWeight: '800' }]}>{row.employee?.employeeId}</Text>
                          <View style={[styles.tCell, { width: 150, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                            {row.employee?.avatar ? (
                              <Image source={{ uri: row.employee.avatar }} style={styles.tPhoto} />
                            ) : (
                              <View style={[styles.tPhoto, { backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }]}>
                                <Text style={{ color: C.white, fontSize: 10, fontWeight: '700' }}>
                                  {row.employee?.firstName?.[0]}
                                </Text>
                              </View>
                            )}
                            <Text style={{ fontSize: 11, fontWeight: '700', color: C.black, flexShrink: 1 }} numberOfLines={1}>
                              {row.employee?.firstName} {row.employee?.lastName}
                            </Text>
                          </View>
                          <Text style={[styles.tCell, { width: 110 }]} numberOfLines={1}>
                            {row.employee?.designation || '—'}
                          </Text>
                          <Text style={[styles.tCell, { width: 60, fontWeight: '800' }]}>
                            {row.lateUsed}/{row.lateAllowed}
                          </Text>
                          {usageTypes.map(t => {
                            const l = (row.leaveUsed || []).find((x: any) => x.leaveType === t);
                            return (
                              <Text key={t} style={[styles.tCell, { width: 70, fontWeight: '800' }]}>
                                {l ? `${l.daysUsed}/${l.daysAllowed}` : '—'}
                              </Text>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}
            </View>
          )}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            These rules apply globally to all employees. Per-employee overrides
            can be set from the employee profile.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tCell: { paddingHorizontal: 6, paddingVertical: 8, fontSize: 11, color: C.black },
  tHead: { fontWeight: '800', textTransform: 'uppercase', fontSize: 10 },
  tPhoto: { width: 22, height: 22, borderRadius: 11 },
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.black },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.success,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.primary,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 14,
  },
  field: { marginBottom: 12 },
  fieldBorder: {
    borderTopWidth: 2,
    borderTopColor: C.black,
    paddingTop: 12,
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6B7280',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
  },
  fieldInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '500',
    color: C.black,
  },
  standaloneInput: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '500',
    color: C.black,
  },
  suffix: {
    paddingHorizontal: 10,
    borderLeftWidth: 2,
    borderLeftColor: C.black,
    backgroundColor: '#F8F9FA',
    paddingVertical: 10,
  },
  suffixText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  hint: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  timeRow: { flexDirection: 'row', gap: 16 },
  timeInputs: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeInput: { width: 56, textAlign: 'center' },
  timeSep: { fontSize: 18, fontWeight: '700', color: C.black },
  typeRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingVertical: 10,
  },
  typeBtnActive: { backgroundColor: C.primary },
  typeBtnText: { fontSize: 12, fontWeight: '700', color: C.black },
  typeBtnTextActive: { color: C.white },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 13, fontWeight: '700', color: C.black },
  toggleDesc: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.primary,
    padding: 12,
  },
  infoText: {
    fontSize: 12,
    color: C.primary,
    fontWeight: '500',
    lineHeight: 18,
  },
  perEmpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 8,
  },
  perEmpName: { flex: 1, fontSize: 13, fontWeight: '600', color: C.black },
  perEmpInput: {
    width: 60,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    color: C.black,
    textAlign: 'center',
  },
  smallSaveBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  smallSaveBtnText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.black,
  },
  chipActive: { backgroundColor: C.secondary },
  chipText: { fontSize: 10, fontWeight: '700', color: C.black },
  chipTextActive: { color: C.white },
});
