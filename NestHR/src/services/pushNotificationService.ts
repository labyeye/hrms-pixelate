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

// import messaging from '@react-native-firebase/messaging';
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
  // Uncomment after installing @react-native-firebase/messaging:
  // const authStatus = await messaging().requestPermission();
  // return (
  //   authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
  //   authStatus === messaging.AuthorizationStatus.PROVISIONAL
  // );
  return false;
}

export async function setupPushNotifications(onNotification?: (data: any) => void) {
  // Uncomment after installing @react-native-firebase/messaging:

  // const granted = await requestNotificationPermission();
  // if (!granted) return;

  // // Get FCM token and register with backend
  // const fcmToken = await messaging().getToken();
  // if (fcmToken) await registerFCMToken(fcmToken);

  // // Listen for token refresh
  // messaging().onTokenRefresh(async token => {
  //   await registerFCMToken(token);
  // });

  // // Foreground message handler
  // messaging().onMessage(async remoteMessage => {
  //   const { notification, data } = remoteMessage;
  //   if (notification) {
  //     Alert.alert(notification.title || 'Notification', notification.body || '');
  //   }
  //   onNotification?.(data);
  // });

  // // Background/quit message handler (tapped from notification tray)
  // messaging().onNotificationOpenedApp(remoteMessage => {
  //   onNotification?.(remoteMessage.data);
  // });

  // // Check if app was opened from a notification
  // const initialNotification = await messaging().getInitialNotification();
  // if (initialNotification) {
  //   onNotification?.(initialNotification.data);
  // }

  console.log('[Push] FCM not configured yet — install @react-native-firebase packages first');
}
