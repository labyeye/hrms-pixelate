/**
 * Push Notification Service
 *
 * SETUP REQUIRED before this file works:
 *
 * 1. Install packages:
 *    npm install @react-native-firebase/app @react-native-firebase/messaging
 *
 * 2. Android:
 *    - Download google-services.json from Firebase Console → Project Settings
 *    - Place it at: android/app/google-services.json
 *    - In android/build.gradle, add: classpath('com.google.gms:google-services:4.3.15')
 *    - In android/app/build.gradle, add at bottom: apply plugin: 'com.google.gms.google-services'
 *
 * 3. iOS:
 *    - Download GoogleService-Info.plist from Firebase Console
 *    - Add to Xcode project (drag into ios/<ProjectName>/)
 *    - Run: cd ios && pod install
 *    - Enable Push Notifications capability in Xcode → Signing & Capabilities
 *    - Enable Background Modes → Remote notifications
 *
 * 4. Uncomment the imports below once packages are installed.
 */

import {
  getMessaging,
  requestPermission,
  AuthorizationStatus,
  getToken as getFcmToken,
  onTokenRefresh,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
} from '@react-native-firebase/messaging';
import { Alert, Platform } from 'react-native';
import { getToken } from '../api/api';
import { API_BASE_URL } from '../config/env';

const BASE_URL = API_BASE_URL;

async function registerFCMToken(fcmToken: string) {
  const authToken = await getToken();
  if (!authToken) return;
  await fetch(`${BASE_URL}/push/fcm-register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ fcmToken, platform: Platform.OS }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const st = await requestPermission(getMessaging());
  return (
    st === AuthorizationStatus.AUTHORIZED ||
    st === AuthorizationStatus.PROVISIONAL
  );
}

export async function setupPushNotifications(
  onNotification?: (data: any) => void,
) {
  const granted = await requestNotificationPermission();
  if (!granted) return;
  const m = getMessaging();

  const fcmToken = await getFcmToken(m);
  if (fcmToken) await registerFCMToken(fcmToken);
  onTokenRefresh(m, t => registerFCMToken(t));

  // Foreground message
  onMessage(m, async msg => {
    const { notification, data } = msg;
    if (notification) {
      Alert.alert(notification.title || 'Notification', notification.body || '');
    }
    onNotification?.(data);
  });

  // Tapped from tray / opened from quit state
  onNotificationOpenedApp(m, msg => onNotification?.(msg.data));
  const initial = await getInitialNotification(m);
  if (initial) onNotification?.(initial.data);
}
