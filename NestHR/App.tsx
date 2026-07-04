import React, { useState } from 'react';
import { StatusBar, Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import AnimatedSplashScreen from './src/screens/AnimatedSplashScreen';
import { FONT } from './src/theme';

// App-wide default so any Text/TextInput that doesn't set an explicit
// style still renders in DM Sans instead of the OS default font.
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.style = [{ fontFamily: FONT.regular }, (Text as any).defaultProps.style];
(TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
(TextInput as any).defaultProps.style = [{ fontFamily: FONT.regular }, (TextInput as any).defaultProps.style];

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  if (!splashDone) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" backgroundColor="#024BAB" />
        <AnimatedSplashScreen onDone={() => setSplashDone(true)} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
