import { Stack, router, type Href } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

import { palette } from '@/design/tokens';
import { setupReminderSystem } from '@/services/reminders';

// Hold the native splash until the numeral font is ready, so the first frame
// the user sees already has JetBrains Mono metrics — no font-swap reflow.
SplashScreen.preventAutoHideAsync().catch(() => {});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function checkFirstTimeOpen() {
  try {
    const hasOpened = await AsyncStorage.getItem('hasOpenedBefore');
    if (hasOpened !== 'true') {
      await AsyncStorage.setItem('hasOpenedBefore', 'true');
    }
  } catch (error) {
    console.warn('Error checking first time open', error);
  }
}

function useNotificationNavigation() {
  useEffect(() => {
    const redirect = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (url === '/(tabs)/' || url === '/(tabs)/add') {
        router.push(url as Href);
      }
    };

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse?.notification) redirect(lastResponse.notification);

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      redirect(response.notification);
    });
    return () => subscription.remove();
  }, []);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const canvas = colorScheme === 'light' ? palette.light.canvas : palette.dark.canvas;

  const [fontsLoaded] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  useNotificationNavigation();

  useEffect(() => {
    checkFirstTimeOpen();
    setupReminderSystem();
  }, []);

  const onLayoutReady = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutReady}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: canvas },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={colorScheme === 'light' ? 'dark' : 'light'} />
    </SafeAreaProvider>
  );
}
