import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, Eye, EyeOff, LogIn, Smartphone, ArrowRight } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../api/api';
import { C } from '../../theme';

export default function LoginScreen({ navigation }: any) {
  const { login, loginWithToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // Phone OTP state
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation', 'Email and password are required');
      return;
    }
    setLoading(true);
    const result = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (!result.success)
      Alert.alert('Login Failed', result.error || 'Invalid credentials');
  };

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      Alert.alert('Validation', 'Phone number is required');
      return;
    }
    setOtpLoading(true);
    try {
      await authAPI.sendPhoneOtp(phone.trim());
      setOtpSent(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) {
      Alert.alert('Validation', 'Enter the 6-digit OTP from WhatsApp');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await authAPI.verifyPhoneOtp(phone.trim(), otp.trim());
      const { token, ...userData } = res.data;
      await loginWithToken(userData, token);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Invalid or expired OTP.');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSub}></Text>

            {mode === 'phone' ? (
              /* ── Phone OTP flow ───────────────────────────────── */
              <>
                {!otpSent ? (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.label}>Phone Number</Text>
                      <View style={styles.inputRow}>
                        <Smartphone size={16} color={C.textMuted} style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          value={phone}
                          onChangeText={setPhone}
                          placeholder="+91 98765 43210"
                          placeholderTextColor={C.textLight}
                          keyboardType="phone-pad"
                          autoComplete="tel"
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.btnPrimary}
                      onPress={handleSendOtp}
                      disabled={otpLoading}
                    >
                      {otpLoading ? (
                        <ActivityIndicator color={C.white} />
                      ) : (
                        <>
                          <ArrowRight size={16} color={C.white} />
                          <Text style={styles.btnPrimaryText}>Send OTP on WhatsApp</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.label}>Enter OTP (from WhatsApp)</Text>
                      <TextInput
                        style={[styles.inputRow, styles.otpInput]}
                        value={otp}
                        onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        placeholderTextColor={C.textLight}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoFocus
                      />
                    </View>

                    <TouchableOpacity
                      style={styles.btnPrimary}
                      onPress={handleVerifyOtp}
                      disabled={otpLoading || otp.length < 6}
                    >
                      {otpLoading ? (
                        <ActivityIndicator color={C.white} />
                      ) : (
                        <>
                          <ArrowRight size={16} color={C.white} />
                          <Text style={styles.btnPrimaryText}>Verify OTP</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.forgotBtn}
                      onPress={() => { setOtpSent(false); setOtp(''); }}
                    >
                      <Text style={styles.forgotText}>← Change number / Resend</Text>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity
                  style={styles.forgotBtn}
                  onPress={() => { setMode('email'); setOtpSent(false); setPhone(''); setOtp(''); }}
                >
                  <Text style={styles.forgotText}>← Sign in with Email</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* ── Email / Password flow ────────────────────────── */
              <>
                {/* Email */}
                <View style={styles.field}>
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputRow}>
                    <Mail size={16} color={C.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="admin@company.com"
                      placeholderTextColor={C.textLight}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                  </View>
                </View>

                {/* Password */}
                <View style={styles.field}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputRow}>
                    <Lock size={16} color={C.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor={C.textLight}
                      secureTextEntry={!showPw}
                      autoComplete="password"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPw(p => !p)}
                      style={styles.eyeBtn}
                    >
                      {showPw ? (
                        <EyeOff size={16} color={C.textMuted} />
                      ) : (
                        <Eye size={16} color={C.textMuted} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <>
                      <LogIn size={16} color={C.white} />
                      <Text style={styles.btnPrimaryText}>Sign In</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.forgotBtn}
                  onPress={() => navigation.navigate('ForgotPassword')}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>

                {/* Phone OTP option */}
                <TouchableOpacity
                  style={styles.forgotBtn}
                  onPress={() => setMode('phone')}
                >
                  <Text style={[styles.forgotText, { color: C.primary }]}>
                   Login using OTP
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logoImg: { width: 100, height: 100, marginBottom: 8 },
  appSub: { fontSize: 19, color: C.textMuted, fontWeight: '500', marginTop: 4 },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 24,
  },
  cardTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: C.black,
    marginBottom: 4,
    textAlign: 'center',
    marginTop: 10,
  },
  cardSub: {
    fontSize: 13,
    color: C.textMuted,
    fontWeight: '500',
    marginBottom: 10,
  },
  field: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.black,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
  },
  inputIcon: { marginHorizontal: 10 },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 12,
    fontSize: 14,
    fontWeight: '500',
    color: C.black,
  },
  eyeBtn: { padding: 12 },
  btnPrimary: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  btnPrimaryText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  forgotBtn: { alignItems: 'center', paddingVertical: 10 },
  forgotText: { fontSize: 13, fontWeight: '700', color: C.primary },
  otpInput: {
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 10,
    textAlign: 'center',
    color: C.black,
    width: '100%',
  },
});
