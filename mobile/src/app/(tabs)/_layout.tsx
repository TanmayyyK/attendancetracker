import React from 'react';
import { Tabs } from 'expo-router';
import { Home, PlusCircle, List, LineChart, Bell } from 'lucide-react-native';
import { useColorScheme, View, StyleSheet, Platform, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AnimatedPressable } from '../../components/animations/AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_CONFIG: Record<string, { Icon: any; label: string }> = {
  index: { Icon: Home, label: 'Home' },
  add: { Icon: PlusCircle, label: 'Add' },
  logs: { Icon: List, label: 'Logs' },
  insights: { Icon: LineChart, label: 'Insights' },
  notifications: { Icon: Bell, label: 'Alerts' },
};

function CustomTabBar({ state, descriptors, navigation }: any) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      entering={FadeInUp.delay(200).springify()}
      style={[
        styles.tabBarContainer,
        {
          borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
          backgroundColor: isDark ? '#050A18' : '#F8FAFC',
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={styles.tabButtonsContainer}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const config = TAB_CONFIG[route.name] || { Icon: Home, label: route.name };
          const { Icon, label } = config;

          const onPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const color = isFocused
            ? '#7C3AED'
            : isDark ? '#64748B' : '#94A3B8';

          return (
            <AnimatedPressable
              key={route.key}
              onPress={onPress}
              style={[
                styles.tabButton,
                isFocused && styles.tabButtonFocused,
              ]}
            >
              <Icon size={22} color={color} strokeWidth={isFocused ? 2.5 : 2} />
              {isFocused && (
                <Animated.Text
                  entering={FadeInUp.springify()}
                  style={[styles.tabLabel, { color }]}
                >
                  {label}
                </Animated.Text>
              )}
            </AnimatedPressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="add" />
      <Tabs.Screen name="logs" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="notifications" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    borderTopWidth: 1,
  },
  tabButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    height: 64,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  tabButtonFocused: {
    backgroundColor: 'rgba(124,58,237,0.15)',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});
