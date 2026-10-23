import { Platform } from 'react-native';

// Central place for environment-specific values.
// Debug builds (`__DEV__`) talk to the local backend; release builds
// (App Store / Play Store) always use the production API.
const PROD_API_URL = 'https://hrms-backend.pixelatenest.com/api';

// Local backend port 5001. The iOS simulator reaches the Mac via localhost and
// the Android emulator via 10.0.2.2. On a physical device set DEV_HOST to your
// Mac's LAN IP (`ipconfig getifaddr en0`), e.g. '192.168.1.119'.
const DEV_HOST: string | null = null;
const DEV_API_URL = `http://${
  DEV_HOST ?? (Platform.OS === 'android' ? '10.0.2.2' : 'localhost')
}:5001/api`;

export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
