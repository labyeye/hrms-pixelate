// Terms & Privacy acceptance for the NestHR app: an "Action required" bar plus a blocking agreement modal until the
// signed-in user accepts the current version (backend /api/legal; every other API call is refused with TERMS_REQUIRED).
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { legalAPI } from '../api/api';
import { C } from '../theme';

const SITE = 'https://www.pixelatenest.com/legal';
type Status = { version: string; required: boolean; accepted: boolean };

const Head = ({ children }: { children: string }) => (
  <Text style={{ fontWeight: '700', color: '#111', marginTop: 12, marginBottom: 4 }}>{children}</Text>
);
const Li = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ color: '#333', marginBottom: 4, lineHeight: 20 }}>• {children}</Text>
);

export default function TermsGate() {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(true);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const check = useCallback(() => {
    legalAPI.status().then(setStatus).catch(() => {});
  }, []);
  useEffect(check, [check]);

  if (!status || !status.required || status.accepted) return null;

  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      setStatus(await legalAPI.accept());
    } catch (e: any) {
      setError(e?.message || 'Could not save your acceptance. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#F59E0B', paddingVertical: 10, paddingHorizontal: 12, zIndex: 999 }}
      >
        <Text style={{ color: '#000', fontWeight: '700' }}>
          Action required: accept the NestHR Terms & Privacy Policy. Tap to review. Your account is paused until you do.
        </Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderColor: '#ddd' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#111' }}>Terms & Privacy Policy — NestHR</Text>
            <Text style={{ fontSize: 12, color: '#666' }}>Version {status.version} · Pixelate Nest (Kalahanu Tech Studios LLP)</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={{ color: '#333', lineHeight: 20 }}>
              Please read and accept this before you continue. It applies to you and, where you act for a business, to that business.
            </Text>

            <Head>1. Your data is stored on our servers</Head>
            <Text style={{ color: '#333', lineHeight: 20 }}>
              Everything you or your company enter in NestHR — employee profiles, attendance, leave, payroll and bank details, loans,
              performance, recruitment and biometric (face / fingerprint) data — is stored on servers operated by Pixelate Nest and its
              infrastructure providers, not on your device. You stay the owner of your data. We process it only to run NestHR, keep it
              protected, back it up and support you. We never sell it or use it for advertising.
            </Text>

            <Head>2. Location</Head>
            <Text style={{ color: '#333', lineHeight: 20 }}>
              When you mark attendance (check-in / check-out), NestHR records your device location (latitude and longitude) together with
              the time, to confirm you were at the allowed place. It is visible to your company's HR and admins. We do not track your
              location in the background or between check-ins.
            </Text>

            <Head>3. What else we track</Head>
            <Li>Sign-ins and security: last login, IP address, browser/device, sessions, failed attempts, OTP / 2-step checks.</Li>
            <Li>Usage: which screens you open (names only, never their contents), user ID, role, company ID, web or app, app version.</Li>
            <Li>Crashes and errors: message, technical stack trace and the screen.</Li>
            <Li>Performance: counts of requests, failures and response times (no contents).</Li>
            <Li>Activity / audit log: who created, changed or deleted which record, and when.</Li>
            <Text style={{ color: '#333', lineHeight: 20, marginTop: 4 }}>
              Usage and crash events are deleted after 90 days and performance counters after 30 days. We do not record keystrokes or
              screens, and NestHR has no third-party advertising or analytics trackers. The Pixelate Nest team can see these figures and
              your acceptance record in our internal dashboard.
            </Text>

            <Head>4. Your rights</Head>
            <Text style={{ color: '#333', lineHeight: 20 }}>
              You can ask to access, correct or delete your data, or withdraw consent, by writing to support@pixelatenest.com. Your employer
              decides what is recorded about you; ask them first.
            </Text>

            <View style={{ flexDirection: 'row', gap: 16, marginTop: 14 }}>
              <Text style={{ color: C.primary, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(`${SITE}/terms-of-service.html`)}>
                Terms of Service
              </Text>
              <Text style={{ color: C.primary, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(`${SITE}/privacy-policy.html#nesthr`)}>
                NestHR Privacy Policy
              </Text>
            </View>
          </ScrollView>

          <View style={{ padding: 16, borderTopWidth: 1, borderColor: '#ddd' }}>
            <Pressable onPress={() => setAgree(!agree)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View
                style={{ width: 22, height: 22, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', backgroundColor: agree ? C.primary : '#fff' }}
              >
                {agree && <Text style={{ color: '#fff', fontWeight: '900' }}>✓</Text>}
              </View>
              <Text style={{ flex: 1, color: '#111', lineHeight: 19 }}>
                I have read and agree to the Terms of Service and the NestHR Privacy Policy, including that all data is stored on Pixelate
                Nest servers, that my location is recorded when I mark attendance, and the tracking described above.
              </Text>
            </Pressable>
            {!!error && <Text style={{ color: C.danger, marginTop: 8 }}>{error}</Text>}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <Pressable onPress={() => setOpen(false)} style={{ paddingVertical: 12, paddingHorizontal: 18, borderWidth: 2, borderColor: '#000' }}>
                <Text style={{ fontWeight: '700' }}>Later</Text>
              </Pressable>
              <Pressable
                disabled={!agree || busy}
                onPress={accept}
                style={{ paddingVertical: 12, paddingHorizontal: 18, backgroundColor: C.primary, opacity: !agree || busy ? 0.5 : 1 }}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>{busy ? 'Saving…' : 'Accept & continue'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
