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
  Settings,
  Building2,
  Mail,
  Phone,
  Globe,
  Clock,
  ChevronRight,
  Save,
  Bell,
  Shield,
  Palette,
  ChevronLeft,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { settingsAPI } from '../api/api';
import { C } from '../theme';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    email: '',
    phone: '',
    website: '',
    timezone: 'Asia/Kolkata',
    workingHours: '9',
    currency: 'INR',
    leaveApprovalRequired: true,
    attendanceTracking: true,
    payrollAutoCalculate: false,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await settingsAPI.get();
        const s = res.data || {};
        setSettings(s);
        setForm(prev => ({
          ...prev,
          ...s,
          companyName: s.companyName || s.company?.name || prev.companyName,
        }));
      } catch (e: any) {
        Alert.alert('Error', e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.update(form);
      Alert.alert('Saved', 'Settings updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </SafeAreaView>
    );

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
          <Settings size={20} color={C.primary} />
          <Text style={styles.headerTitle}>Settings</Text>
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
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Company Info */}
        <View>
          <View style={styles.sectionHeader}>
            <Building2 size={14} color={C.primary} />
            <Text style={styles.sectionTitle}>Company Information</Text>
          </View>
          <View style={styles.card}>
            {[
              {
                label: 'Company Name',
                key: 'companyName',
                placeholder: 'Acme Corp',
                icon: <Building2 size={14} color={C.textMuted} />,
              },
              {
                label: 'Email',
                key: 'email',
                placeholder: 'hr@company.com',
                icon: <Mail size={14} color={C.textMuted} />,
                keyboard: 'email-address' as const,
              },
              {
                label: 'Phone',
                key: 'phone',
                placeholder: '+91 9876543210',
                icon: <Phone size={14} color={C.textMuted} />,
                keyboard: 'phone-pad' as const,
              },
              {
                label: 'Website',
                key: 'website',
                placeholder: 'https://company.com',
                icon: <Globe size={14} color={C.textMuted} />,
              },
            ].map((f, i) => (
              <View
                key={f.key}
                style={[styles.fieldRow, i > 0 && styles.fieldBorder]}
              >
                <View style={styles.fieldIconWrap}>{f.icon}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={(form as any)[f.key] || ''}
                    onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                    placeholder={f.placeholder}
                    placeholderTextColor={C.textLight}
                    keyboardType={f.keyboard}
                    autoCapitalize="none"
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Work Settings */}
        <View>
          <View style={styles.sectionHeader}>
            <Clock size={14} color={C.primary} />
            <Text style={styles.sectionTitle}>Work Settings</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <View style={styles.fieldIconWrap}>
                <Clock size={14} color={C.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Timezone</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.timezone}
                  onChangeText={v => setForm(p => ({ ...p, timezone: v }))}
                  placeholder="Asia/Kolkata"
                  placeholderTextColor={C.textLight}
                  autoCapitalize="none"
                />
              </View>
            </View>
            <View style={[styles.fieldRow, styles.fieldBorder]}>
              <View style={styles.fieldIconWrap}>
                <Clock size={14} color={C.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Working Hours / Day</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.workingHours}
                  onChangeText={v => setForm(p => ({ ...p, workingHours: v }))}
                  placeholder="9"
                  placeholderTextColor={C.textLight}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={[styles.fieldRow, styles.fieldBorder]}>
              <View style={styles.fieldIconWrap}>
                <Globe size={14} color={C.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Currency</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.currency}
                  onChangeText={v => setForm(p => ({ ...p, currency: v }))}
                  placeholder="INR"
                  placeholderTextColor={C.textLight}
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </View>
        </View>

        {/* Feature Toggles */}
        <View>
          <View style={styles.sectionHeader}>
            <Shield size={14} color={C.primary} />
            <Text style={styles.sectionTitle}>Features</Text>
          </View>
          <View style={styles.card}>
            {[
              {
                label: 'Leave Approval Required',
                key: 'leaveApprovalRequired',
                desc: 'Require manager approval for all leaves',
              },
              {
                label: 'Attendance Tracking',
                key: 'attendanceTracking',
                desc: 'Enable check-in/out tracking',
              },
              {
                label: 'Auto Payroll Calculation',
                key: 'payrollAutoCalculate',
                desc: 'Calculate payroll automatically each month',
              },
            ].map((t, i) => (
              <View
                key={t.key}
                style={[styles.toggleRow, i > 0 && styles.fieldBorder]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>{t.label}</Text>
                  <Text style={styles.toggleDesc}>{t.desc}</Text>
                </View>
                <Switch
                  value={(form as any)[t.key]}
                  onValueChange={v => setForm(p => ({ ...p, [t.key]: v }))}
                  trackColor={{ false: '#E5E7EB', true: C.primary }}
                  thumbColor={C.white}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Notifications placeholder */}
        <View>
          <View style={styles.sectionHeader}>
            <Bell size={14} color={C.primary} />
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>
          <View style={styles.card}>
            {[
              'Leave request notifications',
              'Payroll processing alerts',
              'New hire reminders',
              'Performance review reminders',
            ].map((label, i) => (
              <View
                key={label}
                style={[styles.toggleRow, i > 0 && styles.fieldBorder]}
              >
                <Text style={styles.toggleLabel}>{label}</Text>
                <Switch
                  value={true}
                  onValueChange={() => {}}
                  trackColor={{ false: '#E5E7EB', true: C.primary }}
                  thumbColor={C.white}
                />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.black },
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
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  card: { backgroundColor: C.white, borderWidth: 2, borderColor: C.black },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  fieldIconWrap: { width: 28, alignItems: 'center' },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.textMuted,
    letterSpacing: 0.3,
  },
  fieldInput: {
    fontSize: 14,
    fontWeight: '500',
    color: C.black,
    paddingVertical: 2,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  toggleLabel: { fontSize: 13, fontWeight: '700', color: C.black },
  toggleDesc: { fontSize: 11, color: C.textMuted, marginTop: 2 },
});
