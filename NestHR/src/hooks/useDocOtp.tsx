import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Lock, X } from 'lucide-react-native';
import { documentAPI } from '../api/api';
import { C } from '../theme';

// Doc-access token lives in memory only (15 min server-side); restarting the app asks for a new OTP.
let docToken = '';
let docTokenExp = 0;

const NEED_OTP = /OTP verification required/i;

/**
 * Wraps confidential-file actions: `withOtp(token => documentAPI.download(id, token))`.
 * Asks for the WhatsApp OTP when there is no live access token. Render `otpModal` once in the screen.
 */
export function useDocOtp() {
  const [open, setOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef<{
    ok: (t: string) => void;
    no: (e: Error) => void;
  } | null>(null);

  const sendCode = async () => {
    setMsg('');
    try {
      const r = await documentAPI.requestOtp();
      setMsg(r.message || 'OTP sent');
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  const ask = () =>
    new Promise<string>((ok, no) => {
      pending.current = { ok, no };
      setOtp('');
      setOpen(true);
      sendCode();
    });

  const close = () => {
    setOpen(false);
    pending.current?.no(new Error('OTP verification cancelled'));
    pending.current = null;
  };

  const submit = async () => {
    setBusy(true);
    try {
      const r = await documentAPI.verifyOtp(otp);
      docToken = r.token;
      docTokenExp = Date.now() + (r.expiresInMinutes - 1) * 60_000;
      setOpen(false);
      pending.current?.ok(r.token);
      pending.current = null;
    } catch (e: any) {
      setMsg(e.message);
    }
    setBusy(false);
  };

  const withOtp = async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
    const token = docToken && Date.now() < docTokenExp ? docToken : await ask();
    try {
      return await fn(token);
    } catch (e: any) {
      if (!NEED_OTP.test(e?.message || '')) throw e;
      docToken = '';
      return fn(await ask());
    }
  };

  const otpModal = (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.head}>
            <Lock size={16} color={C.white} />
            <Text style={styles.headText}>Verify to open document</Text>
            <TouchableOpacity onPress={close}>
              <X size={20} color={C.white} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16, gap: 12 }}>
            <Text style={styles.hint}>
              This is a confidential document. Enter the 6-digit OTP sent to
              your WhatsApp. Access stays unlocked for 15 minutes.
            </Text>
            <TextInput
              style={styles.otpInput}
              value={otp}
              onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="------"
              placeholderTextColor="#9CA3AF"
            />
            {msg ? <Text style={styles.msg}>{msg}</Text> : null}
            <TouchableOpacity
              style={[
                styles.btn,
                (otp.length !== 6 || busy) && { opacity: 0.5 },
              ]}
              disabled={otp.length !== 6 || busy}
              onPress={submit}
            >
              {busy ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={styles.btnText}>Verify & Open</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={sendCode}>
              <Text style={styles.resend}>Resend OTP</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return { withOtp, otpModal };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
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
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: C.primary,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  headText: { flex: 1, color: C.white, fontWeight: '400', fontSize: 14 },
  hint: { fontSize: 12, color: '#4B5563' },
  otpInput: {
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 12,
    fontSize: 24,
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: 8,
    color: C.black,
  },
  msg: { fontSize: 12, color: C.primary, fontWeight: '400' },
  btn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: {
    color: C.white,
    fontWeight: '400',
    textTransform: 'uppercase',
    fontSize: 13,
  },
  resend: {
    textAlign: 'center',
    color: C.primary,
    fontWeight: '400',
    fontSize: 12,
  },
});
