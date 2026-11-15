import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Linking,
  Platform,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Download } from 'lucide-react-native';
import { API_BASE_URL } from '../../config/env';
import { APP_VERSION } from '../../config/version';
import { C, FONT } from '../../theme';

type VersionInfo = {
  latestVersion: string;
  minVersion: string;
  androidUrl: string;
  iosUrl: string;
  message?: string;
};

// "1.10" > "1.9": compare numerically part by part.
const isOlder = (a: string, b: string) => {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y;
  }
  return false;
};

const SNOOZE_KEY = 'nesthr:update:snooze'; // { version, until }
const SKIP_KEY = 'nesthr:update:skip'; // version the user chose "Not now" for
const SNOOZE_MS = 24 * 60 * 60 * 1000;

// Checks the backend on launch. Older than latestVersion -> dismissible
// "Update available"; older than minVersion -> blocking, no dismiss.
export default function UpdatePrompt() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [muted, setMuted] = useState(true); // true until storage says we may show it

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const r = await (
          await fetch(`${API_BASE_URL}/app-version`, { signal: ctrl.signal })
        ).json();
        if (!r?.success) return;
        const data: VersionInfo = r.data;
        let hide = false;
        try {
          const [skip, snooze] = await Promise.all([
            AsyncStorage.getItem(SKIP_KEY),
            AsyncStorage.getItem(SNOOZE_KEY),
          ]);
          const sn = snooze ? JSON.parse(snooze) : null;
          hide =
            skip === data.latestVersion ||
            (sn?.version === data.latestVersion && sn.until > Date.now());
        } catch {
          /* storage unavailable: just show it */
        }
        setMuted(hide);
        setInfo(data);
      } catch {
        /* offline: no prompt */
      }
    })();
    return () => ctrl.abort();
  }, []);

  const close = (key: string, value: string) => {
    AsyncStorage.setItem(key, value).catch(() => {});
    setDismissed(true);
  };

  if (!info) return null;
  const force = isOlder(APP_VERSION, info.minVersion);
  const optional = isOlder(APP_VERSION, info.latestVersion);
  if (!force && !(optional && !dismissed && !muted)) return null;

  const url = Platform.OS === 'ios' ? info.iosUrl : info.androidUrl;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={s.backdrop}>
        <View style={s.box}>
          <View style={s.icon}>
            <Download size={24} color={C.white} />
          </View>
          <Text style={s.title}>
            {force ? 'Update required' : 'Update available'}
          </Text>
          <Text style={s.body}>
            {info.message ||
              (force
                ? 'This version is no longer supported. Please update to continue.'
                : `Version ${info.latestVersion} is available with improvements and fixes.`)}
          </Text>
          <TouchableOpacity
            style={s.primary}
            onPress={() => url && Linking.openURL(url)}
          >
            <Text style={s.primaryText}>Update now</Text>
          </TouchableOpacity>
          {!force && (
            <View style={s.laterRow}>
              <TouchableOpacity
                onPress={() =>
                  close(
                    SNOOZE_KEY,
                    JSON.stringify({
                      version: info.latestVersion,
                      until: Date.now() + SNOOZE_MS,
                    }),
                  )
                }
              >
                <Text style={s.later}>Remind me later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => close(SKIP_KEY, info.latestVersion)}
              >
                <Text style={s.later}>Not now</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const brutal = {
  borderWidth: 2,
  borderRadius: 8,
  borderRightWidth: 4,
  borderBottomWidth: 4,
  borderRightColor: '#0A0A0A',
  borderBottomColor: '#0A0A0A',
  borderColor: C.black,
} as const;

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  box: {
    ...brutal,
    backgroundColor: C.white,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: FONT.bold, fontSize: 18, color: C.black },
  body: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: C.black,
    textAlign: 'center',
  },
  primary: {
    ...brutal,
    backgroundColor: C.primary,
    paddingVertical: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 6,
  },
  primaryText: { fontFamily: FONT.bold, fontSize: 14, color: C.white },
  laterRow: { flexDirection: 'row', gap: 24 },
  later: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: C.black,
    paddingVertical: 6,
  },
});
