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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldAlert,
  Clock,
  Save,
  ChevronLeft,
  IndianRupee,
  Percent,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { payrollConfigAPI } from '../api/api';
import { C } from '../theme';

interface DeductionRule {
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

const DEFAULT: DeductionRule = {
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

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function PayrollSettingsScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<DeductionRule>(DEFAULT);

  useEffect(() => {
    payrollConfigAPI
      .getDeductionRules()
      .then(res => {
        if (res?.data) setRules({ ...DEFAULT, ...res.data });
      })
      .catch(e => Alert.alert('Error', e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof DeductionRule, value: any) =>
    setRules(p => ({ ...p, [key]: value }));

  const numField = (
    key: keyof DeductionRule,
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
      await payrollConfigAPI.updateDeductionRules(rules);
      Alert.alert('Saved', 'Deduction rules updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

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
          <Text style={styles.headerTitle}>Payroll Settings</Text>
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
            {numField(
              'lateThresholdMinutes',
              'Grace Period',
              'Employee is marked late after this many minutes',
              'min',
            )}

            <View style={[styles.field, styles.fieldBorder]}>
              <Text style={styles.fieldLabel}>Deduction Type</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    rules.lateDeductionType === 'fixed' && styles.typeBtnActive,
                  ]}
                  onPress={() => set('lateDeductionType', 'fixed')}
                >
                  <IndianRupee
                    size={12}
                    color={
                      rules.lateDeductionType === 'fixed' ? C.white : C.black
                    }
                  />
                  <Text
                    style={[
                      styles.typeBtnText,
                      rules.lateDeductionType === 'fixed' &&
                        styles.typeBtnTextActive,
                    ]}
                  >
                    Fixed (₹)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    rules.lateDeductionType === 'percent' &&
                      styles.typeBtnActive,
                  ]}
                  onPress={() => set('lateDeductionType', 'percent')}
                >
                  <Percent
                    size={12}
                    color={
                      rules.lateDeductionType === 'percent' ? C.white : C.black
                    }
                  />
                  <Text
                    style={[
                      styles.typeBtnText,
                      rules.lateDeductionType === 'percent' &&
                        styles.typeBtnTextActive,
                    ]}
                  >
                    Percent (%)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.field, styles.fieldBorder]}>
              {numField(
                'lateDeductionAmount',
                rules.lateDeductionType === 'fixed'
                  ? 'Deduction Amount (₹)'
                  : 'Deduction Percent (%)',
                rules.lateDeductionType === 'percent'
                  ? 'Percentage of daily salary to deduct'
                  : undefined,
                rules.lateDeductionType === 'fixed' ? '₹' : '%',
              )}
            </View>

            <View style={[styles.field, styles.fieldBorder]}>
              {numField(
                'halfDayThresholdMinutes',
                'Half-Day Threshold',
                'Mark as half-day if late by more than this',
                'min',
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
    borderColor: C.black,
    padding: 14,
  },
  field: { marginBottom: 12 },
  fieldBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
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
    borderColor: C.black,
  },
  fieldInput: {
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
    borderColor: C.primary,
    padding: 12,
  },
  infoText: {
    fontSize: 12,
    color: C.primary,
    fontWeight: '500',
    lineHeight: 18,
  },
});
