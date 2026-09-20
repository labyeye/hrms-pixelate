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
import LottieView from 'lottie-react-native';
import { Mail, Lock, Eye, EyeOff, LogIn, Smartphone, ArrowRight, Fingerprint } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../api/api';
import { C } from '../../theme';

const loginAnim = require('../../assets/lottie/login.json');
const otpAnim = require('../../assets/lottie/otp.json');

export default function LoginScreen({ navigation }: any) {
  const { login, loginWithToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  // Set once the password step succeeded for an account with 2FA on.
  const [pending2FA, setPending2FA] = useState<string | null>(null);
  const [tfaCode, setTfaCode] = useState('');

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
    if (result.requires2FA) {
      setPending2FA(result.userId || '');
      return;
    }
    if (!result.success)
      Alert.alert('Login Failed', result.error || 'Invalid credentials');
  };

  const handleVerify2FA = async () => {
    setLoading(true);
    try {
      const res = await authAPI.verify2FA(pending2FA || '', tfaCode.trim());
      const { token, ...userData } = res.data;
      await loginWithToken(userData, token);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Invalid authentication code');
    } finally {
      setLoading(false);
    }
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

  const handleBiometricLogin = async () => {
    try {
      Alert.alert('Passkey / Biometric', 'Biometric authentication requires device key registration. Ensure face/fingerprint unlock is enabled on your device.');
    } catch (err: any) {
      Alert.alert('Biometric Error', err.message || 'Biometric authentication failed.');
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
          {pending2FA === null && (
            <LottieView
              key={mode}
              source={mode === 'phone' ? otpAnim : loginAnim}
              autoPlay
              loop
              style={mode === 'phone' ? styles.lottieOtp : styles.lottieLogin}
            />
          )}
          <>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSub}></Text>

            {pending2FA !== null ? (
              /* ── 2FA code step ────────────────────────────────── */
              <>
                <Text style={styles.cardSub}>
                  Enter the 6-digit code from your authenticator app, or a backup code.
                </Text>
                <View style={styles.field}>
                  <Text style={styles.label}>Authentication Code</Text>
                  <TextInput
                    style={[styles.inputRow, styles.otpInput]}
                    value={tfaCode}
                    onChangeText={setTfaCode}
                    placeholder="000000"
                    placeholderTextColor={C.textLight}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={8}
                    autoFocus
                  />
                </View>
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={handleVerify2FA}
                  disabled={loading || tfaCode.length < 6}
                >
                  {loading ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <>
                      <ArrowRight size={16} color={C.white} />
                      <Text style={styles.btnPrimaryText}>Verify Code</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.forgotBtn}
                  onPress={() => { setPending2FA(null); setTfaCode(''); }}
                >
                  <Text style={styles.forgotText}>← Back to login</Text>
                </TouchableOpacity>
              </>
            ) : mode === 'phone' ? (
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
                      disabled={otpLoading || !phone.trim()}
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
              </>
            )}

            {pending2FA === null && (
              <>
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>Or login with</Text>
                  <View style={styles.orLine} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
                  <View style={{ alignItems: 'center' }}>
                    <TouchableOpacity
                      style={styles.altBtn}
                      onPress={() => {
                        if (mode === 'phone') {
                          setMode('email');
                          setOtpSent(false);
                          setPhone('');
                          setOtp('');
                        } else {
                          setMode('phone');
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={mode === 'phone' ? 'Sign in with email' : 'Sign in with phone OTP'}
                    >
                      {mode === 'phone' ? (
                        <Mail size={24} color={C.white} />
                      ) : (
                        <Smartphone size={24} color={C.white} />
                      )}
                    </TouchableOpacity>
                    <Text style={styles.altLabel}>{mode === 'phone' ? 'Email' : 'Phone'}</Text>
                  </View>

                  <View style={{ alignItems: 'center' }}>
                    <TouchableOpacity
                      style={[styles.altBtn, { backgroundColor: '#10B981' }]}
                      onPress={handleBiometricLogin}
                      accessibilityRole="button"
                      accessibilityLabel="Sign in with Biometrics / Passkey"
                    >
                      <Fingerprint size={24} color={C.white} />
                    </TouchableOpacity>
                    <Text style={styles.altLabel}>Passkey</Text>
                  </View>
                </View>
              </>
            )}
          </>
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
  // Same box + negative top margin as NestSports' login/OTP screens: both animations have
  // generous transparent padding in their canvas, so the art floats above the centred form.
  lottieLogin: { width: '100%', height: 250, marginTop: -74, marginBottom: 24 },
  lottieOtp: { width: '100%', height: 300, marginTop: -204, marginBottom: 24 },
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
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, marginBottom: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  orText: { fontSize: 12, fontWeight: '600', color: C.textMuted },
  altBtn: {
    alignSelf: 'center',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  altLabel: { textAlign: 'center', marginTop: 6, fontSize: 12, fontWeight: '600', color: C.textMuted },
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
