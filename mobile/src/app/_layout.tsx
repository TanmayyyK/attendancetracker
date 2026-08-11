import { Stack } from 'expo-router';
import { useColorScheme, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { registerPushToken } from '../api';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (!isExpoGo) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    console.warn("expo-notifications is disabled in this environment.");
  }
}

async function checkFirstTimeOpen() {
  try {
    const hasOpened = await AsyncStorage.getItem('hasOpenedBefore');
    if (hasOpened !== 'true') {
      setTimeout(async () => {
        if (!Notifications) return;
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Welcome Onboard! 🎉",
            body: "We're glad you're here. Let's make tracking your attendance effortless!",
            sound: true,
          },
          trigger: null,
        });
        
        await AsyncStorage.setItem('hasOpenedBefore', 'true');
      }, 2000);
    }
  } catch (error) {
    console.warn('Error checking first time open', error);
  }
}

const SANSKRIT_MESSAGES = [
  "Time for Sanskrit! Let's start the day with a focused mind.",
  "First class of the day: Sanskrit. Have a great morning!",
  "Rise and shine! Head over to your Sanskrit class.",
  "Morning! Your Sanskrit class is about to begin. Let's get it.",
  "Ready for the day? First up is Sanskrit!"
];

async function scheduleDailyReminder() {
  if (!Notifications) return;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7c3aed',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    // In Expo, 1 = Sunday, 2 = Monday, 3 = Tuesday, 4 = Wednesday, 5 = Thursday, 6 = Friday, 7 = Saturday
    const activeDays = [2, 3, 4, 5, 6, 7];

    for (const day of activeDays) {
      // 8:30 AM - Breakfast
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Morning! ☀️",
          body: "Breakfast done? Have a healthy meal to start your day right!",
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day,
          hour: 8,
          minute: 30,
        } as any,
      });

      // 9:00 AM - Sanskrit
      const randomMsg = SANSKRIT_MESSAGES[Math.floor(Math.random() * SANSKRIT_MESSAGES.length)];
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "First Class - Sanskrit 📚",
          body: randomMsg,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day,
          hour: 9,
          minute: 0,
        } as any,
      });

      // 1:15 PM - Lunch
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Lunch Time! 🍱",
          body: "Lunch done? Take a break and recharge!",
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day,
          hour: 13,
          minute: 15,
        } as any,
      });

      // 4:00 PM - Classes Over
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Classes Over! 🎒",
          body: "Back from classes? How was the day? Don't forget to log your attendance!",
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day,
          hour: 16,
          minute: 0,
        } as any,
      });

      // 10:00 PM - Attendance Reminder
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Attendance Reminder 📝",
          body: "Did you attend your classes today? Don't forget to log your attendance!",
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day,
          hour: 22,
          minute: 0,
        } as any,
      });
    }
  } catch (error) {
    console.warn("Failed to schedule notification (expected in Expo Go Android): ", error);
  }
}

async function registerForPushNotifications() {
  if (isExpoGo) return;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7c3aed',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permission not granted');
      return;
    }

    const expoPushToken = await Notifications.getExpoPushTokenAsync({
      projectId: 'fe1835ac-9c4f-4815-a4c5-5200127f6871',
    });

    const deviceName = Device.deviceName || `${Device.brand || 'Unknown'} ${Device.modelName || 'Device'}`;

    await registerPushToken(expoPushToken.data, deviceName);
    console.log('Push token registered:', expoPushToken.data);
  } catch (error) {
    console.warn('Failed to register push token:', error);
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    checkFirstTimeOpen();
    scheduleDailyReminder();
    registerForPushNotifications();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}
