import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getCurrentPosition } from '../utils/location';
import { trackingAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Lightweight periodic location tracker hook for field employees.
 * Active when:
 * 1. User is signed in
 * 2. Runs periodically to record duty breadcrumbs
 * 3. Server enforces Duty-Hour Guard (only saves if employee has active punch-in without punch-out)
 */
export function useLiveTracking() {
  const { user } = useAuth();
  const timerRef = useRef<any>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const sendPing = async () => {
      try {
        const coords = await getCurrentPosition();
        if (!coords || !isMounted) return;

        await trackingAPI.ping({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          recordedAt: new Date().toISOString(),
        });
      } catch {
        // Silently catch GPS timeouts or network errors
      }
    };

    // Send initial ping on startup
    sendPing();

    // Setup periodic heartbeats
    timerRef.current = setInterval(() => {
      if (appStateRef.current === 'active') {
        sendPing();
      }
    }, DEFAULT_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - send immediate refresh ping
        sendPing();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      subscription.remove();
    };
  }, [user]);
}
