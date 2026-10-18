import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';
import { X, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { employeeAPI } from '../api/api';
import { C } from '../theme';

// Apple Face ID–style enrollment: the ring is split into SEGMENTS ticks and a
// tick fills when the user's head points that way. Once enough of the circle
// is covered they look straight and hold still → auto-capture + upload.
const SEGMENTS = 40;
const NEEDED = 0.8; // fraction of ticks that must be filled
const RING = 280;
const TICK_W = 5;
const TICK_H = 18;
const STRAIGHT_DEG = 12; // |yaw|,|pitch| below this = "looking straight"
const MIN_TILT_DEG = 8; // below this the head isn't pointing anywhere yet
const STEADY_MS = 700;
const UPLOAD_ATTEMPTS = 2;

type Phase =
  | 'loading'
  | 'no-permission'
  | 'no-camera'
  | 'circle'
  | 'straight'
  | 'uploading'
  | 'success'
  | 'error';

export default function FaceEnrollScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const device = useCameraDevice('front');
  // Small photo = fast upload; the face service downsizes to 320px anyway.
  const format = useCameraFormat(device, [
    { photoResolution: { width: 640, height: 480 } },
  ]);
  const { hasPermission, requestPermission } = useCameraPermission();

  const cameraRef = useRef<Camera>(null);
  const filledRef = useRef<boolean[]>(Array(SEGMENTS).fill(false));
  const phaseRef = useRef<Phase>('loading');
  const steadySinceRef = useRef<number | null>(null);
  const lastUiRef = useRef(0);
  const pulse = useRef(new Animated.Value(0)).current;

  const [phase, setPhaseState] = useState<Phase>('loading');
  const [filled, setFilled] = useState<boolean[]>(filledRef.current);
  const [error, setError] = useState('');
  const [hasFace, setHasFace] = useState(false);

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  useEffect(() => {
    if (hasPermission) {
      if (phaseRef.current === 'loading') setPhase('circle');
      return;
    }
    requestPermission().then(ok => setPhase(ok ? 'circle' : 'no-permission'));
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    if (phase === 'circle' && !device) setPhase('no-camera');
  }, [phase, device]);

  // Idle pulse on the ring while scanning.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const restart = useCallback(() => {
    filledRef.current = Array(SEGMENTS).fill(false);
    steadySinceRef.current = null;
    setFilled(filledRef.current);
    setPhase('circle');
  }, []);

  const capture = useCallback(async () => {
    setPhase('uploading');
    try {
      const photo = await cameraRef.current?.takePhoto({ flash: 'off' });
      if (!photo?.path) throw new Error('Could not capture photo. Try again.');
      const uri =
        Platform.OS === 'android' ? `file://${photo.path}` : photo.path;
      const name = `face_${Date.now()}.jpg`;

      // First request after a server restart can be slow (model warm-up) or hit
      // a dropped connection — retry once on timeout/network errors only.
      let lastErr: any;
      for (let i = 0; i < UPLOAD_ATTEMPTS; i++) {
        try {
          await employeeAPI.enrollMyFace(uri, 'image/jpeg', name);
          lastErr = null;
          break;
        } catch (e: any) {
          lastErr = e;
          if (!e?.retryable) break;
        }
      }
      if (lastErr) throw lastErr;

      setPhase('success');
      setTimeout(() => navigation.goBack(), 1200);
    } catch (e: any) {
      setError(e?.message || 'Face enrollment failed. Please try again.');
      setPhase('error');
    }
  }, [navigation]);

  // Runs on the JS thread for every analysed frame.
  const onFace = useCallback(
    (found: boolean, yaw: number, pitch: number) => {
      const p = phaseRef.current;
      if (p !== 'circle' && p !== 'straight') return;
      const now = Date.now();

      if (!found) {
        steadySinceRef.current = null;
        if (now - lastUiRef.current > 80) {
          lastUiRef.current = now;
          setHasFace(false);
        }
        return;
      }

      if (p === 'circle') {
        const tilt = Math.hypot(yaw, pitch);
        if (tilt >= MIN_TILT_DEG) {
          // Front camera mirrors yaw, so flip it to match what the user sees.
          const ang = Math.atan2(-pitch, -yaw); // -PI..PI, 0 = right, PI/2 = down
          const idx =
            Math.round(((ang + Math.PI) / (2 * Math.PI)) * SEGMENTS) % SEGMENTS;
          const f = filledRef.current;
          // Fill the hit tick and its neighbours so sweeping feels smooth.
          let changed = false;
          for (const k of [
            idx,
            (idx + 1) % SEGMENTS,
            (idx + SEGMENTS - 1) % SEGMENTS,
          ]) {
            if (!f[k]) {
              f[k] = true;
              changed = true;
            }
          }
          if (changed) {
            setFilled([...f]);
            if (f.filter(Boolean).length / SEGMENTS >= NEEDED) {
              steadySinceRef.current = null;
              setPhase('straight');
            }
          }
        }
      } else {
        const straight =
          Math.abs(yaw) < STRAIGHT_DEG && Math.abs(pitch) < STRAIGHT_DEG;
        if (!straight) {
          steadySinceRef.current = null;
        } else {
          if (steadySinceRef.current == null) steadySinceRef.current = now;
          if (now - steadySinceRef.current >= STEADY_MS) {
            steadySinceRef.current = null;
            capture();
          }
        }
      }

      if (now - lastUiRef.current > 80) {
        lastUiRef.current = now;
        setHasFace(true);
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
  const onFaceJS = Worklets.createRunOnJS(onFace);

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      const faces = detectFaces(frame);
      const f: any = faces[0];
      onFaceJS(!!f, f?.yawAngle ?? 0, f?.pitchAngle ?? 0);
    },
    [onFaceJS],
  );

  const ticks = useMemo(
    () =>
      Array.from({ length: SEGMENTS }, (_, i) => ({
        i,
        rot: (i / SEGMENTS) * 360,
      })),
    [],
  );

  const done = phase === 'success';
  const count = filled.filter(Boolean).length;
  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.025],
  });

  const title =
    phase === 'circle'
      ? hasFace
        ? 'Move your head slowly in a circle'
        : 'Position your face in the frame'
      : phase === 'straight'
        ? 'Now look straight at the camera'
        : phase === 'uploading'
          ? 'Saving your Face ID…'
          : '';

  const overlay = () => {
    if (phase === 'no-permission')
      return (
        <View style={styles.centerMsg}>
          <AlertCircle size={32} color={C.white} />
          <Text style={styles.msgTitle}>Camera permission required</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.btnText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      );
    if (phase === 'no-camera')
      return (
        <View style={styles.centerMsg}>
          <AlertCircle size={32} color={C.white} />
          <Text style={styles.msgTitle}>No front camera found</Text>
        </View>
      );
    if (phase === 'loading')
      return (
        <View style={styles.centerMsg}>
          <ActivityIndicator color={C.white} size="large" />
        </View>
      );
    if (phase === 'error')
      return (
        <View style={styles.centerMsg}>
          <AlertCircle size={40} color={C.danger} />
          <Text style={styles.msgTitle}>{error}</Text>
          <TouchableOpacity style={styles.btn} onPress={restart}>
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    return null;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <X size={22} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Set up Face ID</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.stage}>
        {/* Circular camera preview */}
        <View style={styles.camCircle}>
          {device && hasPermission && (
            <Camera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              device={device}
              format={format}
              isActive={
                isFocused &&
                (phase === 'circle' ||
                  phase === 'straight' ||
                  phase === 'uploading')
              }
              photo
              frameProcessor={frameProcessor}
            />
          )}
        </View>

        {/* Tick ring */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              transform: [
                {
                  scale:
                    phase === 'circle' || phase === 'straight' ? ringScale : 1,
                },
              ],
            },
          ]}
        >
          {ticks.map(t => (
            <View
              key={t.i}
              style={[
                styles.tickHolder,
                { transform: [{ rotate: `${t.rot}deg` }] },
              ]}
            >
              <View
                style={[
                  styles.tick,
                  {
                    backgroundColor:
                      done || filled[t.i]
                        ? C.success
                        : 'rgba(255,255,255,0.28)',
                    height: filled[t.i] || done ? TICK_H + 4 : TICK_H,
                  },
                ]}
              />
            </View>
          ))}
        </Animated.View>

        {done && (
          <View pointerEvents="none" style={styles.successBadge}>
            <CheckCircle2 size={72} color={C.success} />
          </View>
        )}
        {overlay()}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerTitle}>
          {done ? 'Face ID set up' : title}
        </Text>
        {phase === 'circle' && (
          <Text style={styles.footerSub}>
            {Math.min(100, Math.round((count / SEGMENTS / NEEDED) * 100))}%
            complete
          </Text>
        )}
        {phase === 'uploading' && (
          <ActivityIndicator color={C.white} style={{ marginTop: 10 }} />
        )}
      </View>
    </SafeAreaView>
  );
}

const CAM = RING - 2 * (TICK_H + 14);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { color: C.white, fontWeight: '700', fontSize: 15 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  camCircle: {
    width: CAM,
    height: CAM,
    borderRadius: CAM / 2,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Each holder is the full ring size, rotated about its centre, with the tick pinned to its top edge.
  tickHolder: {
    position: 'absolute',
    width: RING,
    height: RING,
    alignItems: 'center',
  },
  tick: { width: TICK_W, borderRadius: TICK_W / 2 },
  successBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: CAM,
    height: CAM,
    borderRadius: CAM / 2,
  },
  centerMsg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 32,
    gap: 10,
  },
  msgTitle: {
    color: C.white,
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  btn: {
    marginTop: 8,
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  btnText: { color: C.white, fontWeight: '700', fontSize: 13 },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    minHeight: 110,
  },
  footerTitle: {
    color: C.white,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  footerSub: { color: '#9CA3AF', fontSize: 13, marginTop: 6 },
});
