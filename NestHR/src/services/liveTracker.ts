import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import BackgroundService from 'react-native-background-actions';
import { trackingAPI } from '../api/api';

/**
 * Ola/Uber-style live location for on-duty staff.
 *
 * - Sends a location when the employee moves ~MIN_DISTANCE_M, and at least every
 *   HEARTBEAT_MS while standing still (so the map shows they are still online).
 * - Keeps running with the app minimised or the phone locked:
 *   Android uses a foreground service (a permanent "Sharing live location" notification),
 *   iOS uses the "location" background mode.
 * - The server decides whether to record (company switch on + checked in + not checked out).
 *   As soon as it answers "not on duty", tracking stops by itself.
 */

const MIN_DISTANCE_M = 50;
const MIN_GAP_MS = 15_000; // never send more often than this
const HEARTBEAT_MS = 60_000; // send even when not moving

let running = false;
let watchId: number | null = null;
let heartbeat: any = null;
let last: {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
} | null = null;
let lastSentAt = 0;
let sending = false;
let stopResolver: (() => void) | null = null;

Geolocation.setRNConfiguration({
  skipPermissionRequests: true,
  authorizationLevel: 'always',
  enableBackgroundLocationUpdates: true,
  locationProvider: 'playServices',
} as any);

export function isLiveTrackingRunning() {
  return running;
}

/** Asks for "Allow all the time" location (Android 10+ needs a separate second prompt). */
export async function requestBackgroundLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return new Promise(resolve =>
      Geolocation.requestAuthorization(
        () => resolve(true),
        () => resolve(false),
      ),
    );
  }
  const fine = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  if (fine !== PermissionsAndroid.RESULTS.GRANTED) return false;
  if (Number(Platform.Version) >= 29) {
    // Not fatal if refused: the foreground service still tracks while the notification is shown.
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      {
        title: 'Allow location all the time',
        message:
          'So your company can see your live location while you are on duty, choose "Allow all the time". Tracking stops when you check out.',
        buttonPositive: 'OK',
      },
    );
  }
  if (Number(Platform.Version) >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    ).catch(() => {});
  }
  return true;
}

/** Sends one location. Returns false when the server says the employee is not on duty. */
async function send(force = false): Promise<boolean> {
  if (!last || sending) return true;
  const now = Date.now();
  if (!force && now - lastSentAt < MIN_GAP_MS) return true;
  sending = true;
  try {
    const res: any = await trackingAPI.ping({
      latitude: last.latitude,
      longitude: last.longitude,
      accuracy: last.accuracy,
      speed: last.speed ?? undefined,
      recordedAt: new Date().toISOString(),
    });
    lastSentAt = now;
    const active =
      res?.trackingEnabled !== false && res?.data?.dutyActive !== false;
    const offDuty = res?.dutyActive === false;
    return active && !offDuty;
  } catch {
    return true; // network blip: keep going, try again on the next fix
  } finally {
    sending = false;
  }
}

function startWatching() {
  watchId = Geolocation.watchPosition(
    pos => {
      last = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed:
          pos.coords.speed != null && pos.coords.speed >= 0
            ? pos.coords.speed
            : null,
      };
      send().then(ok => {
        if (!ok) stopLiveTracking();
      });
    },
    () => {},
    {
      enableHighAccuracy: true,
      distanceFilter: MIN_DISTANCE_M,
      interval: 20_000,
      fastestInterval: MIN_GAP_MS,
      maximumAge: 10_000,
    } as any,
  );
  heartbeat = setInterval(() => {
    send(true).then(ok => {
      if (!ok) stopLiveTracking();
    });
  }, HEARTBEAT_MS);
}

function stopWatching() {
  if (watchId != null) Geolocation.clearWatch(watchId);
  watchId = null;
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
}

// Android: the foreground service keeps the JS thread alive with the app closed.
const androidTask = async () => {
  startWatching();
  await new Promise<void>(resolve => {
    stopResolver = resolve;
  });
  stopWatching();
};

export async function startLiveTracking() {
  if (running) return;
  running = true;
  lastSentAt = 0;
  if (Platform.OS === 'android') {
    try {
      await BackgroundService.start(androidTask, {
        taskName: 'NestHRLiveLocation',
        taskTitle: 'On duty · sharing live location',
        taskDesc:
          'Your location is shared with your company until you check out.',
        taskIcon: { name: 'ic_launcher', type: 'mipmap' },
        color: '#024BAB',
        foregroundServiceType: ['location'],
      } as any);
    } catch {
      // Service refused (e.g. started from background on Android 12+): track while the app is open.
      startWatching();
    }
  } else {
    startWatching();
  }
}

export async function stopLiveTracking() {
  if (!running) return;
  running = false;
  last = null;
  if (stopResolver) {
    stopResolver();
    stopResolver = null;
  }
  stopWatching();
  if (Platform.OS === 'android' && BackgroundService.isRunning()) {
    await BackgroundService.stop().catch(() => {});
  }
}
