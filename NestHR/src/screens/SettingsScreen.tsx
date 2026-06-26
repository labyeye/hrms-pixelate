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
  Modal,
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
  DollarSign,
  ShieldCheck,
  ShieldOff,
  Eye,
  EyeOff,
  X,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { settingsAPI, authAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../theme';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [qrUri, setQrUri] = useState('');
  const [secret2FA, setSecret2FA] = useState('');
  const [token2FA, setToken2FA] = useState('');
  const [disable2FAToken, setDisable2FAToken] = useState('');
  const [show2FADisable, setShow2FADisable] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
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
        const [settRes, meRes] = await Promise.all([
          settingsAPI.get(),
          authAPI.getMe(),
        ]);
        const s = settRes.data || {};
        setSettings(s);
        setForm(prev => ({
          ...prev,
          ...s,
          companyName: s.companyName || s.company?.name || prev.companyName,
        }));
        const me = meRes.data || meRes;
        setTwoFAEnabled(me.twoFactorEnabled || false);
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

        {/* Payroll Settings */}
        <View>
          <View style={styles.sectionHeader}>
            <DollarSign size={14} color={C.primary} />
            <Text style={styles.sectionTitle}>Payroll Settings</Text>
          </View>
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('PayrollSettings')}
            activeOpacity={0.7}
          >
            <View style={styles.navRow}>
              <View style={styles.navRowLeft}>
                <View style={styles.navIconWrap}>
                  <DollarSign size={16} color={C.primary} />
                </View>
                <View>
                  <Text style={styles.navRowLabel}>Payroll Configuration</Text>
                  <Text style={styles.navRowDesc}>Shift timings, late rules & deductions</Text>
                </View>
              </View>
              <ChevronRight size={16} color={C.textMuted} />
            </View>
          </TouchableOpacity>
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

        {/* Two-Factor Authentication */}
        <View>
          <View style={styles.sectionHeader}>
            <ShieldCheck size={14} color={C.primary} />
            <Text style={styles.sectionTitle}>Security</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Two-Factor Authentication (2FA)</Text>
                <Text style={styles.toggleDesc}>
                  {twoFAEnabled
                    ? 'Your account is protected with an authenticator app'
                    : 'Add an extra layer of security to your account'}
                </Text>
              </View>
              <View style={[styles.twoFABadge, { backgroundColor: twoFAEnabled ? '#F0FDF4' : '#FEF2F2', borderColor: twoFAEnabled ? C.success : C.danger }]}>
                <Text style={[styles.twoFABadgeText, { color: twoFAEnabled ? C.success : C.danger }]}>
                  {twoFAEnabled ? 'ON' : 'OFF'}
                </Text>
              </View>
            </View>

            {twoFAEnabled ? (
              <TouchableOpacity
                style={[styles.twoFABtn, { borderColor: C.danger, backgroundColor: '#FEF2F2' }]}
                onPress={() => { setDisable2FAToken(''); setShow2FADisable(true); }}
              >
                <ShieldOff size={15} color={C.danger} />
                <Text style={[styles.twoFABtnText, { color: C.danger }]}>Disable 2FA</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.twoFABtn, { borderColor: C.success, backgroundColor: '#F0FDF4' }]}
                onPress={async () => {
                  setTwoFALoading(true);
                  try {
                    const res = await authAPI.setup2FA();
                    setQrUri(res.data?.qrCodeUrl || res.qrCodeUrl || '');
                    setSecret2FA(res.data?.secret || res.secret || '');
                    setToken2FA('');
                    setShow2FASetup(true);
                  } catch (e: any) {
                    Alert.alert('Error', e.message);
                  } finally {
                    setTwoFALoading(false);
                  }
                }}
                disabled={twoFALoading}
              >
                {twoFALoading ? <ActivityIndicator size="small" color={C.success} /> : (
                  <>
                    <ShieldCheck size={15} color={C.success} />
                    <Text style={[styles.twoFABtnText, { color: C.success }]}>Enable 2FA</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* 2FA Setup Modal */}
      <Modal visible={show2FASetup} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Enable 2FA</Text>
            <TouchableOpacity onPress={() => setShow2FASetup(false)}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={styles.twoFANote}>
              <ShieldCheck size={20} color={C.primary} />
              <Text style={styles.twoFANoteText}>
                Scan the QR code with Google Authenticator, Authy, or any TOTP app. Then enter the 6-digit code to confirm.
              </Text>
            </View>

            {qrUri ? (
              <View style={styles.qrContainer}>
                <Text style={styles.qrLabel}>Scan this QR Code</Text>
                <View style={styles.qrBox}>
                  <Text style={styles.qrPlaceholder}>{qrUri}</Text>
                </View>
              </View>
            ) : null}

            {secret2FA ? (
              <View>
                <Text style={styles.fieldLabel2FA}>Manual Entry Key</Text>
                <TouchableOpacity
                  style={styles.secretRow}
                  onPress={() => setShowSecret(s => !s)}
                >
                  <Text style={styles.secretText} numberOfLines={showSecret ? undefined : 1}>
                    {showSecret ? secret2FA : '••••••••••••••••••••'}
                  </Text>
                  {showSecret ? <EyeOff size={16} color="#6B7280" /> : <Eye size={16} color="#6B7280" />}
                </TouchableOpacity>
              </View>
            ) : null}

            <View>
              <Text style={styles.fieldLabel2FA}>Enter 6-digit code from your app *</Text>
              <TextInput
                style={styles.codeInput}
                value={token2FA}
                onChangeText={setToken2FA}
                keyboardType="numeric"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <TouchableOpacity
              style={[styles.twoFASubmitBtn, { backgroundColor: twoFALoading ? '#9CA3AF' : C.primary }]}
              onPress={async () => {
                if (token2FA.length !== 6) { Alert.alert('Validation', 'Enter a 6-digit code'); return; }
                setTwoFALoading(true);
                try {
                  await authAPI.confirm2FA(token2FA);
                  setTwoFAEnabled(true);
                  setShow2FASetup(false);
                  Alert.alert('Success', '2FA has been enabled on your account');
                } catch (e: any) {
                  Alert.alert('Invalid Code', e.message);
                } finally {
                  setTwoFALoading(false);
                }
              }}
              disabled={twoFALoading}
            >
              {twoFALoading ? <ActivityIndicator color={C.white} /> : <Text style={styles.twoFASubmitBtnText}>Confirm & Enable 2FA</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* 2FA Disable Modal */}
      <Modal visible={show2FADisable} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Disable 2FA</Text>
            <TouchableOpacity onPress={() => setShow2FADisable(false)}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={[styles.twoFANote, { borderColor: C.danger, backgroundColor: '#FEF2F2' }]}>
              <ShieldOff size={20} color={C.danger} />
              <Text style={[styles.twoFANoteText, { color: C.danger }]}>
                You will lose the extra protection 2FA provides. Enter your current 6-digit code to confirm.
              </Text>
            </View>

            <View>
              <Text style={styles.fieldLabel2FA}>Enter 6-digit code from your authenticator app *</Text>
              <TextInput
                style={styles.codeInput}
                value={disable2FAToken}
                onChangeText={setDisable2FAToken}
                keyboardType="numeric"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <TouchableOpacity
              style={[styles.twoFASubmitBtn, { backgroundColor: C.danger }]}
              onPress={async () => {
                if (disable2FAToken.length !== 6) { Alert.alert('Validation', 'Enter a 6-digit code'); return; }
                setTwoFALoading(true);
                try {
                  await authAPI.disable2FA(disable2FAToken);
                  setTwoFAEnabled(false);
                  setShow2FADisable(false);
                  Alert.alert('Done', '2FA has been disabled');
                } catch (e: any) {
                  Alert.alert('Invalid Code', e.message);
                } finally {
                  setTwoFALoading(false);
                }
              }}
              disabled={twoFALoading}
            >
              {twoFALoading ? <ActivityIndicator color={C.white} /> : <Text style={styles.twoFASubmitBtnText}>Confirm Disable 2FA</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  navRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  navIconWrap: {
    width: 32,
    height: 32,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.black,
  },
  navRowLabel: { fontSize: 13, fontWeight: '700', color: C.black },
  navRowDesc: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  twoFABadge: { borderWidth: 2, paddingHorizontal: 8, paddingVertical: 3 },
  twoFABadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  twoFABtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    paddingVertical: 10,
    marginHorizontal: 14,
    marginBottom: 14,
  },
  twoFABtnText: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.black },
  twoFANote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 2,
    borderColor: C.primary,
    backgroundColor: '#EFF6FF',
    padding: 14,
  },
  twoFANoteText: { flex: 1, fontSize: 13, fontWeight: '500', color: C.black },
  qrContainer: { alignItems: 'center', gap: 8 },
  qrLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' },
  qrBox: {
    borderWidth: 2,
    borderColor: C.black,
    padding: 16,
    backgroundColor: '#F9FAFB',
    maxWidth: '100%',
  },
  qrPlaceholder: { fontSize: 11, color: C.primary, fontFamily: 'monospace', textAlign: 'center' },
  fieldLabel2FA: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: C.black, marginBottom: 6, letterSpacing: 0.5 },
  secretRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  secretText: { flex: 1, fontSize: 13, fontFamily: 'monospace', color: C.black, fontWeight: '600' },
  codeInput: {
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700',
    color: C.black,
    textAlign: 'center',
    letterSpacing: 8,
    backgroundColor: C.white,
  },
  twoFASubmitBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.black,
    marginTop: 4,
  },
  twoFASubmitBtnText: { color: C.white, fontWeight: '700', fontSize: 14, textTransform: 'uppercase' },
});
