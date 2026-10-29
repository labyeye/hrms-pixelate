import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StatusBar,
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { Passkey } from 'react-native-passkey';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Smartphone,
  ArrowRight,
  Phone,
  Key,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../api/api';
import LegalLinks from '../../components/LegalLinks';
import { C } from '../../theme';
import WhatsAppIcon from '../../components/common/WhatsAppIcon';

const loginAnim = require('../../assets/lottie/login.json');
const otpAnim = require('../../assets/lottie/otp.json');

export default function LoginScreen({ navigation }: any) {
  const { login, loginWithToken } = useAuth();
  const insets = useSafeAreaInsets();
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
  const [otpVia, setOtpVia] = useState<'whatsapp' | 'email'>('whatsapp');
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    entrance.setValue(0);
    Animated.timing(entrance, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    }).start();
  }, [mode, pending2FA, entrance]);

  const slideUp = (distance = 24) => ({
    opacity: entrance,
    transform: [
      {
        translateY: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [distance, 0],
        }),
      },
    ],
  });

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation', 'Email and password are required');
      return;
    }
    setLoading(true);
    const result = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (result.requires2FA) {
      setPending2FA(result.pendingToken || ''); // pending-2FA token from the password step
      return;
    }
    if (!result.success) {
      setBlocked(/blocked/i.test(result.error || ''));
      Alert.alert('Login Failed', result.error || 'Invalid credentials');
    }
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
    const viaEmail = otpVia === 'email';
    if (viaEmail ? !email.trim() : !phone.trim()) {
      Alert.alert(
        'Validation',
        viaEmail ? 'Email is required' : 'Phone number is required',
      );
      return;
    }
    setOtpLoading(true);
    try {
      if (viaEmail) await authAPI.loginSendEmailOtp(email.trim().toLowerCase());
      else await authAPI.sendPhoneOtp(phone.trim());
      setOtpSent(true);
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.message || 'Failed to send OTP. Please try again.',
      );
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) {
      Alert.alert('Validation', 'Enter the 6-digit OTP');
      return;
    }
    setOtpLoading(true);
    try {
      const res =
        otpVia === 'email'
          ? await authAPI.loginVerifyEmailOtp(
              email.trim().toLowerCase(),
              otp.trim(),
            )
          : await authAPI.verifyPhoneOtp(phone.trim(), otp.trim());
      const { token, ...userData } = res.data;
      await loginWithToken(userData, token);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Invalid or expired OTP.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!Passkey.isSupported()) {
      Alert.alert(
        'Not supported',
        'Passkeys are not supported on this device.',
      );
      return;
    }
    setPasskeyLoading(true);
    try {
      const { data: opts }: any = await authAPI.passkeyLoginOptions();
      const result = await Passkey.get({
        rpId: opts.rpId,
        challenge: opts.challenge,
        allowCredentials: opts.allowCredentials,
        userVerification: opts.userVerification,
        timeout: opts.timeout,
      });
      const res = await authAPI.biometricLogin({
        challengeToken: opts.challengeToken,
        id: result.id,
        rawId: result.rawId,
        type: 'public-key',
        response: {
          clientDataJSON: result.response.clientDataJSON,
          authenticatorData: result.response.authenticatorData,
          signature: result.response.signature,
          userHandle: result.response.userHandle ?? null,
        },
        clientExtensionResults: {},
      });
      const { token, ...userData } = res.data;
      await loginWithToken(userData, token);
    } catch (err: any) {
      const cancelled =
        err?.error === 'UserCancelled' || err?.name === 'NotAllowedError';
      if (!cancelled)
        Alert.alert(
          'Passkey sign-in failed',
          err?.message || 'Try another sign-in method.',
        );
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <>
          {pending2FA === null && (
            <Animated.View style={slideUp(50)}>
              <LottieView
                key={mode}
                source={mode === 'phone' ? otpAnim : loginAnim}
                autoPlay
                loop
                style={mode === 'phone' ? styles.lottieOtp : styles.lottieLogin}
              />
            </Animated.View>
          )}
          <Text style={styles.cardTitle}>
            {pending2FA !== null ? 'Two-Factor Authentication' : 'Login'}
          </Text>
          {pending2FA !== null ? (
            /* ── 2FA code step ────────────────────────────────── */
            <>
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
                onPress={() => {
                  setPending2FA(null);
                  setTfaCode('');
                }}
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
                    <Text style={styles.label}>
                      {otpVia === 'email' ? 'Email Address' : 'Phone Number'}
                    </Text>
                    <View style={styles.inputRow}>
                      {otpVia === 'email' ? (
                        <Mail
                          size={16}
                          color={C.textMuted}
                          style={styles.inputIcon}
                        />
                      ) : (
                        <Smartphone
                          size={16}
                          color={C.textMuted}
                          style={styles.inputIcon}
                        />
                      )}
                      {otpVia === 'email' ? (
                        <TextInput
                          style={styles.input}
                          value={email}
                          onChangeText={setEmail}
                          placeholder="Enter Email Address"
                          placeholderTextColor={C.textLight}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoComplete="email"
                        />
                      ) : (
                        <TextInput
                          style={styles.input}
                          value={phone}
                          onChangeText={setPhone}
                          placeholder="+91 98765 43210"
                          placeholderTextColor={C.textLight}
                          keyboardType="phone-pad"
                          autoComplete="tel"
                        />
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.btnPrimary}
                    onPress={handleSendOtp}
                    disabled={
                      otpLoading ||
                      (otpVia === 'email' ? !email.trim() : !phone.trim())
                    }
                  >
                    {otpLoading ? (
                      <ActivityIndicator color={C.white} />
                    ) : (
                      <>
                        {otpVia === 'email' ? (
                          <ArrowRight size={16} color={C.white} />
                        ) : (
                          <WhatsAppIcon size={20} />
                        )}
                        <Text style={styles.btnPrimaryText}>
                          {otpVia === 'email'
                            ? 'Send OTP to Email'
                            : 'Send OTP on WhatsApp'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.forgotBtn}
                    onPress={() =>
                      setOtpVia(v => (v === 'email' ? 'whatsapp' : 'email'))
                    }
                  >
                    <Text style={styles.forgotText}>
                      {otpVia === 'email'
                        ? 'Use WhatsApp OTP instead'
                        : 'Use email OTP instead'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>
                      {otpVia === 'email'
                        ? 'Enter OTP (from email)'
                        : 'Enter OTP (from WhatsApp)'}
                    </Text>
                    <TextInput
                      style={[styles.inputRow, styles.otpInput]}
                      value={otp}
                      onChangeText={t =>
                        setOtp(t.replace(/\D/g, '').slice(0, 6))
                      }
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
                    onPress={() => {
                      setOtpSent(false);
                      setOtp('');
                    }}
                  >
                    <Text style={styles.forgotText}>
                      ← Change {otpVia === 'email' ? 'email' : 'number'} /
                      Resend
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          ) : (
            /* ── Email / Password flow ────────────────────────── */
            <>
              {/* Email */}
              <Animated.View style={[styles.field, slideUp(30)]}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputRow}>
                  <Mail
                    size={16}
                    color={C.textMuted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter Email Address"
                    placeholderTextColor={C.textLight}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>
              </Animated.View>

              {/* Password */}
              <Animated.View style={[styles.field, slideUp(30)]}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputRow}>
                  <Lock
                    size={16}
                    color={C.textMuted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter Password"
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
              </Animated.View>

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

              {blocked && (
                <TouchableOpacity
                  style={styles.forgotBtn}
                  onPress={() => {
                    setBlocked(false);
                    setMode('phone');
                  }}
                >
                  <Text style={styles.forgotText}>Recover with an OTP →</Text>
                </TouchableOpacity>
              )}

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

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 20,
                }}
              >
                <View style={{ alignItems: 'center' }}>
                  <TouchableOpacity
                    style={styles.altBtn}
                    onPress={() => {
                      if (mode === 'phone') {
                        setMode('email');
                        setOtpVia('whatsapp');
                        setOtpSent(false);
                        setPhone('');
                        setOtp('');
                      } else {
                        setMode('phone');
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={
                      mode === 'phone'
                        ? 'Sign in with email'
                        : 'Sign in with phone OTP'
                    }
                  >
                    {mode === 'phone' ? (
                      <Mail size={24} color={C.white} />
                    ) : (
                      <Phone size={24} color={C.white} />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.altLabel}>
                    {mode === 'phone' ? 'Email' : 'Phone'}
                  </Text>
                </View>

                <View style={{ alignItems: 'center' }}>
                  <TouchableOpacity
                    style={[styles.altBtn, { backgroundColor: C.primary }]}
                    onPress={handleBiometricLogin}
                    disabled={passkeyLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Sign in with Biometrics / Passkey"
                  >
                    {passkeyLoading ? (
                      <ActivityIndicator color={C.white} />
                    ) : (
                      <Key size={24} color={C.white} />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.altLabel}>Passkey</Text>
                </View>
              </View>
            </>
          )}
        </>
        <LegalLinks
          prefix="By signing in you agree to the"
          style={{ marginTop: 20 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  lottieLogin: { width: '100%', height: 220, marginTop: 5, marginBottom: 6 },
  lottieOtp: { width: '100%', height: 300, marginTop: -204, marginBottom: 24 },
  cardTitle: {
    fontSize: 36,
    fontWeight: '400',
    color: '#000',
    marginBottom: 18,
    textAlign: 'left',
  },
  field: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: '400',
    textTransform: 'uppercase',
    color: C.black,
    marginBottom: 6,
    letterSpacing: 0.5,
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
    backgroundColor: C.white,
  },
  inputIcon: { marginHorizontal: 10 },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 12,
    fontSize: 14,
    fontWeight: '400',
    color: C.black,
  },
  eyeBtn: { padding: 12 },
  btnPrimary: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
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
    fontWeight: '400',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  forgotBtn: { alignItems: 'center', paddingVertical: 10 },
  forgotText: { fontSize: 13, fontWeight: '400', color: C.primary },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    marginBottom: 12,
  },
  orLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  orText: { fontSize: 12, fontWeight: '400', color: C.textMuted },
  altBtn: {
    alignSelf: 'center',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  altLabel: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 12,
    fontWeight: '400',
    color: C.textMuted,
  },
  otpInput: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    backgroundColor: C.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: '400',
    letterSpacing: 10,
    textAlign: 'center',
    color: C.black,
    width: '100%',
  },
});
