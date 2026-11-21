import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export async function requestSelfMarkPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const results = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);
  return (
    results[PermissionsAndroid.PERMISSIONS.CAMERA] ===
      PermissionsAndroid.RESULTS.GRANTED &&
    results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
      PermissionsAndroid.RESULTS.GRANTED
  );
}

// Use Google Play Services (fused GPS + Wi-Fi + cell) on Android for faster, more accurate fixes.
Geolocation.setRNConfiguration({
  skipPermissionRequests: true,
  locationProvider: 'playServices',
} as any);

type Coords = { latitude: number; longitude: number; accuracy: number };

// Samples location until accuracy is <= targetAccuracy (or the time budget runs out),
// then returns the best fix seen. Never uses a cached position.
export function getPreciseLocation(
  targetAccuracy = 20,
  budgetMs = 15000,
): Promise<Coords> {
  return new Promise((resolve, reject) => {
    let best: Coords | null = null;
    let done = false;
    const finish = (err?: any) => {
      if (done) return;
      done = true;
      Geolocation.clearWatch(watchId);
      clearTimeout(timer);
      if (best) resolve(best);
      else reject(new Error(err?.message || 'Could not get your location. Move to an open area and try again.'));
    };
    const watchId = Geolocation.watchPosition(
      pos => {
        if (!best || pos.coords.accuracy < best.accuracy) best = pos.coords;
        if (pos.coords.accuracy <= targetAccuracy) finish();
      },
      err => finish(err),
      { enableHighAccuracy: true, distanceFilter: 0, interval: 1000, fastestInterval: 500 } as any,
    );
    const timer = setTimeout(() => finish(), budgetMs);
  });
}

function getPosition(options: {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      err => reject(err),
      options,
    );
  });
}

export async function getCurrentPosition(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
}> {
  try {
    // Try a high-accuracy GPS fix first, accepting a recently cached
    // location so we don't always wait for a cold GPS start.
    return await getPosition({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  } catch (err: any) {
    if (err?.code === 3 /* TIMEOUT */) {
      // GPS took too long (common indoors) — fall back to a
      // faster, lower-accuracy network-based location.
      try {
        return await getPosition({
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 0,
        });
      } catch (fallbackErr: any) {
        throw new Error(
          fallbackErr?.message ||
            'Could not get your location. Move to an open area and try again.',
        );
      }
    }
    if (err?.code === 2 /* POSITION_UNAVAILABLE */) {
      throw new Error(
        'Location services are turned off on your device. Please enable Location/GPS and try again.',
      );
    }
    throw new Error(err?.message || 'Could not get your location');
  }
}
