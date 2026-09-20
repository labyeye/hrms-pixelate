import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { authAPI, authAPI_extras } from '../../api/api';
import { C } from '../../theme';

type Step = 'email' | 'choose' | 'code' | 'done';

// Only methods the account has actually set up are offered (see /methods).
const METHOD_INFO: Record<string, { label: string; desc: string }> = {
  email: { label: 'Email link', desc: 'Get a password reset link in your inbox' },
  whatsapp: {
    label: 'WhatsApp code',
    desc: 'Get a 6-digit code on your verified WhatsApp number',
  },
  totp: {
    label: 'Authenticator app',
    desc: 'Enter the code from your authenticator app',
  },
};

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { paddingLeft: 12 }]}
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          {...props}
        />
      </View>
    </View>
  );
}

export default function ForgotPasswordScreen({ navigation }: any) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [methods, setMethods] = useState<string[]>([]);
  const [method, setMethod] = useState<'whatsapp' | 'totp'>('whatsapp');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [doneMsg, setDoneMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setLoading(true);
    try {
      await fn();
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendLink = async (addr: string) => {
    await authAPI_extras.forgotPassword(addr);
    setDoneMsg(
      `If an account with ${addr} exists, you'll receive a password reset link shortly. The link expires in 1 hour.`,
    );
    setStep('done');
  };

  const onContinue = () => {
    const addr = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      return setError('Please enter a valid email address');
    }
    run(async () => {
      const res: any = await authAPI.forgotPasswordMethods(addr);
      setMethods(res.data.methods);
      if (res.data.methods.length > 1) return setStep('choose');
      await sendLink(addr);
    });
  };

  const choose = (m: string) =>
    run(async () => {
      const addr = email.trim().toLowerCase();
      if (m === 'email') return sendLink(addr);
      if (m === 'whatsapp') await authAPI.forgotPasswordWhatsapp(addr);
      setMethod(m as 'whatsapp' | 'totp');
      setCode('');
      setStep('code');
    });

  const onReset = () => {
    if (password !== confirm) return setError("Passwords don't match");
    const addr = email.trim().toLowerCase();
    run(async () => {
      if (method === 'whatsapp')
        await authAPI.resetPasswordWithOtp(addr, code.trim(), password);
      else await authAPI.resetPasswordWithTotp(addr, code.trim(), password);
      setDoneMsg('Your password has been reset. You can now sign in.');
      setStep('done');
    });
  };

  const title =
    step === 'email'
      ? 'Forgot password?'
      : step === 'choose'
      ? 'How do you want to reset it?'
      : step === 'code'
      ? method === 'whatsapp'
        ? 'Enter WhatsApp code'
        : 'Enter authenticator code'
      : 'All set';

  const sub =
    step === 'email'
      ? 'Enter the email address you registered with to see how you can reset your password.'
      : step === 'choose'
      ? 'Choose one of the methods set up on your account.'
      : step === 'code'
      ? method === 'whatsapp'
        ? 'We sent a 6-digit code to your verified WhatsApp number.'
        : 'Open your authenticator app and enter the current 6-digit code (or a backup code).'
      : '';

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
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image
              source={require('../../assets/images/nesthr_bgwhite.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
            <Text style={styles.appSub}>NestHR</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {step === 'done' ? (
              <View style={styles.successBlock}>
                <View style={styles.successIcon}>
                  <CheckCircle2 size={32} color={C.success} />
                </View>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardSub}>{doneMsg}</Text>
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.btnPrimaryText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardSub}>{sub}</Text>

                {!!error && <Text style={styles.errorText}>{error}</Text>}

                {step === 'email' && (
                  <>
                    <View style={styles.field}>
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
                          onChangeText={v => {
                            setEmail(v);
                            setError('');
                          }}
                          placeholder="admin@company.com"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoComplete="email"
                          returnKeyType="send"
                          onSubmitEditing={onContinue}
                        />
                      </View>
                    </View>
                    <Primary title="Continue" loading={loading} onPress={onContinue} />
                  </>
                )}

                {step === 'choose' &&
                  methods.map(m => (
                    <TouchableOpacity
                      key={m}
                      style={styles.method}
                      onPress={() => choose(m)}
                      disabled={loading}
                    >
                      <Text style={styles.methodLabel}>
                        {METHOD_INFO[m]?.label ?? m}
                      </Text>
                      <Text style={styles.methodDesc}>{METHOD_INFO[m]?.desc}</Text>
                    </TouchableOpacity>
                  ))}

                {step === 'code' && (
                  <>
                    <Field
                      label={
                        method === 'whatsapp'
                          ? 'WhatsApp Code'
                          : 'Authenticator Code'
                      }
                      value={code}
                      onChangeText={setCode}
                      keyboardType={method === 'whatsapp' ? 'number-pad' : 'default'}
                      placeholder="123456"
                    />
                    <Field
                      label="New Password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      placeholder="8+ chars, upper, lower & a number"
                    />
                    <Field
                      label="Confirm New Password"
                      value={confirm}
                      onChangeText={setConfirm}
                      secureTextEntry
                    />
                    <Primary
                      title="Reset Password"
                      loading={loading}
                      onPress={onReset}
                    />
                  </>
                )}

                <TouchableOpacity
                  style={styles.backLink}
                  onPress={() => {
                    setError('');
                    if (step === 'code') setStep('choose');
                    else if (step === 'choose') setStep('email');
                    else navigation.goBack();
                  }}
                >
                  <ArrowLeft size={14} color={C.primary} />
                  <Text style={styles.backLinkText}>
                    {step === 'code'
                      ? 'Choose a different method'
                      : step === 'choose'
                      ? 'Back'
                      : 'Back to Sign In'}
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

function Primary({
  title,
  loading,
  onPress,
}: {
  title: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.btnPrimary} onPress={onPress} disabled={loading}>
      {loading ? (
        <ActivityIndicator color={C.white} />
      ) : (
        <Text style={styles.btnPrimaryText}>{title}</Text>
      )}
    </TouchableOpacity>
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
    fontSize: 22,
    fontWeight: '700',
    color: C.black,
    marginBottom: 8,
  },
  cardSub: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 20,
    lineHeight: 20,
  },
  errorText: { color: C.danger, fontWeight: '600', fontSize: 13, marginBottom: 12 },
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
  btnPrimary: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnPrimaryText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  method: {
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
    marginBottom: 12,
  },
  methodLabel: { fontWeight: '700', fontSize: 15, color: C.black },
  methodDesc: { color: '#6B7280', marginTop: 2, fontSize: 12 },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  backLinkText: { fontSize: 13, fontWeight: '700', color: C.primary },
  successBlock: { alignItems: 'center', gap: 12 },
  successIcon: {
    width: 64,
    height: 64,
    borderWidth: 2,
    borderColor: C.success,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
