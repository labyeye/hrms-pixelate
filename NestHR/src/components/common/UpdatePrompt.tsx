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

// Checks the backend on launch. Older than latestVersion -> dismissible
// "Update available"; older than minVersion -> blocking, no dismiss.
export default function UpdatePrompt() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${API_BASE_URL}/app-version`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(r => r?.success && setInfo(r.data))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  if (!info) return null;
  const force = isOlder(APP_VERSION, info.minVersion);
  const optional = isOlder(APP_VERSION, info.latestVersion);
  if (!force && !(optional && !dismissed)) return null;

  const url = Platform.OS === 'ios' ? info.iosUrl : info.androidUrl;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={s.backdrop}>
        <View style={s.box}>
          <View style={s.icon}>
            <Download size={26} color={C.white} />
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
            <TouchableOpacity onPress={() => setDismissed(true)}>
              <Text style={s.later}>Later</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const brutal = {
  borderWidth: 2,
  borderRadius: 8,
  borderRightWidth: 5,
  borderBottomWidth: 5,
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
  box: { ...brutal, backgroundColor: C.white, padding: 20, width: '100%', alignItems: 'center', gap: 10 },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT.bold, fontSize: 18, color: C.black },
  body: { fontFamily: FONT.medium, fontSize: 13, color: C.black, textAlign: 'center' },
  primary: { ...brutal, backgroundColor: C.primary, paddingVertical: 11, alignSelf: 'stretch', alignItems: 'center', marginTop: 6 },
  primaryText: { fontFamily: FONT.bold, fontSize: 14, color: C.white },
  later: { fontFamily: FONT.bold, fontSize: 13, color: C.black, paddingVertical: 6 },
});
