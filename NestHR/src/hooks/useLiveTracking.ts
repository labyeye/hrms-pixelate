import { useEffect } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import { getCurrentPosition } from '../utils/location';
import { trackingAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import {
  isLiveTrackingRunning,
  requestBackgroundLocationPermission,
  startLiveTracking,
  stopLiveTracking,
} from '../services/liveTracker';

const CHECK_MS = 5 * 60 * 1000;

/**
 * Decides when the live tracker runs. It sends one location to the server; if the server
 * records it (tracking on for the company, checked in, not checked out) the continuous
 * background tracker starts. It re-checks on app open, every 5 minutes while the app is open,
 * and right after a check-in or check-out.
 */
export function useLiveTracking() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || user.role === 'super_admin') return;
    let alive = true;
    let asked = false;

    const check = async () => {
      if (isLiveTrackingRunning()) return;
      try {
        const coords = await getCurrentPosition();
        if (!coords || !alive) return;
        const res: any = await trackingAPI.ping({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          recordedAt: new Date().toISOString(),
        });
        const onDuty =
          res?.trackingEnabled !== false &&
          res?.dutyActive !== false &&
          res?.data?.dutyActive === true;
        if (!onDuty || !alive) return;
        if (!asked) {
          asked = true;
          await requestBackgroundLocationPermission();
        }
        if (alive) await startLiveTracking();
      } catch {
        // GPS timeout / offline: try again on the next check
      }
    };

    check();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') check();
    }, CHECK_MS);
    const appSub = AppState.addEventListener(
      'change',
      st => st === 'active' && check(),
    );
    const attSub = DeviceEventEmitter.addListener('attendance:changed', () =>
      // Check-out: the next ping is refused and the tracker stops itself. Check-in: start now.
      setTimeout(check, 1500),
    );

    return () => {
      alive = false;
      clearInterval(timer);
      appSub.remove();
      attSub.remove();
      stopLiveTracking();
    };
  }, [user]);
}
