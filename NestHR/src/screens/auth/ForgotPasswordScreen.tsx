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
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { authAPI_extras } from '../../api/api';
import { C } from '../../theme';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Validation', 'Please enter your email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert('Validation', 'Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      await authAPI_extras.forgotPassword(trimmed);
      setSent(true);
    } catch (e: any) {
      // Backend returns success even if email not found (security)
      if (e.status === 404 || e.message?.toLowerCase().includes('not found')) {
        setSent(true);
      } else {
        Alert.alert(
          'Error',
          e.message || 'Something went wrong. Please try again.',
        );
      }
    } finally {
      setLoading(false);
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
            {sent ? (
              <View style={styles.successBlock}>
                <View style={styles.successIcon}>
                  <CheckCircle2 size={32} color={C.success} />
                </View>
                <Text style={styles.cardTitle}>Check your email</Text>
                <Text style={styles.cardSub}>
                  If an account with{' '}
                  <Text style={{ fontWeight: '700' }}>{email.trim()}</Text>{' '}
                  exists, you'll receive a password reset link shortly.
                </Text>
                <Text style={styles.cardSub} numberOfLines={undefined}>
                  The link expires in 1 hour. Check your spam folder if you
                  don't see it.
                </Text>
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.btnPrimaryText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.cardTitle}>Forgot password?</Text>
                <Text style={styles.cardSub}>
                  Enter the email address you registered with and we'll send you
                  a reset link.
                </Text>

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
                      onChangeText={setEmail}
                      placeholder="admin@company.com"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      returnKeyType="send"
                      onSubmitEditing={handleSubmit}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backLink}
                  onPress={() => navigation.goBack()}
                >
                  <ArrowLeft size={14} color={C.primary} />
                  <Text style={styles.backLinkText}>Back to Sign In</Text>
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
  field: { marginBottom: 16 },
  label: {
    fontSize: 10,
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
