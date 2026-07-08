import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';
import { X, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { attendanceAPI } from '../api/api';
import { getCurrentPosition } from '../utils/location';
import { C } from '../theme';

// How long a face must be steadily present before we auto-capture + submit.
const STEADY_MS = 1500;
const GUIDE_SIZE = 260;

type Status =
  | 'loading'
  | 'no-permission'
  | 'no-camera'
  | 'scanning'
  | 'capturing'
  | 'submitting'
  | 'success'
  | 'error';

export default function FaceCheckInScreen({ navigation, route }: any) {
  const action: 'checkin' | 'checkout' = route.params?.action || 'checkin';
  const isFocused = useIsFocused();
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  const cameraRef = useRef<Camera>(null);
  const faceSinceRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);
  const lastUiUpdateRef = useRef(0);

  const [status, setStatus] = useState<Status>('loading');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (hasPermission) {
      setStatus(prev => (prev === 'loading' ? 'scanning' : prev));
      return;
    }
    requestPermission().then(granted => {
      setStatus(granted ? 'scanning' : 'no-permission');
    });
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    if (status === 'scanning' && !device) setStatus('no-camera');
  }, [status, device]);

  const resetScan = useCallback(() => {
    triggeredRef.current = false;
    faceSinceRef.current = null;
    lastUiUpdateRef.current = 0;
    setProgress(0);
  }, []);

  const capture = useCallback(async () => {
    setStatus('capturing');
    try {
      const photo = await cameraRef.current?.takePhoto({ flash: 'off' });
      if (!photo?.path) throw new Error('Could not capture photo. Try again.');
      const uri = Platform.OS === 'android' ? `file://${photo.path}` : photo.path;

      setStatus('submitting');
      const coords = await getCurrentPosition();
      await attendanceAPI.selfMark({
        action,
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        selfieUri: uri,
        selfieType: 'image/jpeg',
        selfieName: `selfie_${Date.now()}.jpg`,
      });

      setStatus('success');
      setTimeout(() => navigation.goBack(), 900);
    } catch (e: any) {
      setErrorMessage(e.message || 'Verification failed. Please try again.');
      setStatus('error');
      setTimeout(() => {
        resetScan();
        setStatus('scanning');
      }, 2200);
    }
  }, [action, navigation, resetScan]);

  // Called (via Worklets.createRunOnJS) from the frame-processor worklet on
  // every analyzed frame — tracks how long a face has been continuously
  // present and triggers auto-capture once it's held steady for STEADY_MS.
  const handleFaceUpdate = useCallback(
    (hasFace: boolean) => {
      if (triggeredRef.current) return;
      const now = Date.now();

      if (hasFace) {
        if (faceSinceRef.current == null) faceSinceRef.current = now;
        const elapsed = now - faceSinceRef.current;
        if (now - lastUiUpdateRef.current > 60) {
          lastUiUpdateRef.current = now;
          setProgress(Math.min(1, elapsed / STEADY_MS));
        }
        if (elapsed >= STEADY_MS) {
          triggeredRef.current = true;
          capture();
        }
      } else {
        faceSinceRef.current = null;
        if (now - lastUiUpdateRef.current > 60) {
          lastUiUpdateRef.current = now;
          setProgress(0);
        }
      }
    },
    [capture],
  );

  const { detectFaces } = useFaceDetector({
    performanceMode: 'fast',
    landmarkMode: 'none',
    classificationMode: 'none',
    contourMode: 'none',
  });

  const handleFaceUpdateJS = Worklets.createRunOnJS(handleFaceUpdate);

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      const faces = detectFaces(frame);
      handleFaceUpdateJS(faces.length > 0);
    },
    [handleFaceUpdateJS],
  );

  const cancel = () => navigation.goBack();

  const renderOverlay = () => {
    if (status === 'no-permission') {
      return (
        <View style={styles.centerMsg}>
          <AlertCircle size={32} color={C.white} />
          <Text style={styles.msgTitle}>Camera permission required</Text>
          <Text style={styles.msgBody}>
            Please allow camera access to verify your face.
          </Text>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => Linking.openSettings()}>
            <Text style={styles.settingsBtnText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (status === 'no-camera') {
      return (
        <View style={styles.centerMsg}>
          <AlertCircle size={32} color={C.white} />
          <Text style={styles.msgTitle}>No front camera found</Text>
        </View>
      );
    }
    if (status === 'loading') {
      return (
        <View style={styles.centerMsg}>
          <ActivityIndicator color={C.white} size="large" />
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={cancel} hitSlop={12}>
          <X size={22} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {action === 'checkin' ? 'Verify to Check In' : 'Verify to Check Out'}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.cameraWrap}>
        {device && hasPermission && (
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isFocused && (status === 'scanning' || status === 'capturing')}
            photo
            frameProcessor={frameProcessor}
          />
        )}

        {/* Face guide ring + progress */}
        {(status === 'scanning' || status === 'capturing' || status === 'submitting') && (
          <View pointerEvents="none" style={styles.guideWrap}>
            <View
              style={[
                styles.guideRing,
                {
                  borderColor:
                    progress > 0 ? C.success : 'rgba(255,255,255,0.6)',
                },
              ]}
            />
          </View>
        )}

        {status === 'success' && (
          <View style={styles.centerMsg}>
            <CheckCircle2 size={48} color={C.success} />
            <Text style={styles.msgTitle}>
              {action === 'checkin' ? 'Checked in!' : 'Checked out!'}
            </Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.centerMsg}>
            <AlertCircle size={40} color={C.danger} />
            <Text style={styles.msgTitle}>{errorMessage}</Text>
          </View>
        )}

        {renderOverlay()}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {status === 'scanning' && progress === 0 && 'Position your face in the frame'}
          {status === 'scanning' && progress > 0 && 'Hold still…'}
          {status === 'capturing' && 'Capturing…'}
          {status === 'submitting' && 'Verifying…'}
        </Text>
        {(status === 'capturing' || status === 'submitting') && (
          <ActivityIndicator color={C.white} style={{ marginTop: 8 }} />
        )}
        {status === 'scanning' && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: { padding: 4 },
  headerTitle: { color: C.white, fontWeight: '700', fontSize: 15 },
  cameraWrap: { flex: 1, backgroundColor: '#000000' },
  guideWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideRing: {
    width: GUIDE_SIZE,
    height: GUIDE_SIZE,
    borderRadius: GUIDE_SIZE / 2,
    borderWidth: 3,
  },
  centerMsg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 32,
    gap: 10,
  },
  msgTitle: {
    color: C.white,
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  msgBody: {
    color: '#D1D5DB',
    fontSize: 13,
    textAlign: 'center',
  },
  settingsBtn: {
    marginTop: 8,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.white,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  settingsBtnText: { color: C.white, fontWeight: '700', fontSize: 13 },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: { color: C.white, fontSize: 13, fontWeight: '600' },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: C.success },
});
