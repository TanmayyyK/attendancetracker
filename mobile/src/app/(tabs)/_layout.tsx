import React from 'react';
import { Tabs } from 'expo-router';
import { Home, PlusCircle, List, LineChart, Bell, type LucideIcon } from 'lucide-react-native';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, radius, space, ICON_STROKE } from '@/design/tokens';
import { useTheme } from '@/design/theme';

const TAB_CONFIG: Record<string, { Icon: LucideIcon; label: string }> = {
  index: { Icon: Home, label: 'Home' },
  add: { Icon: PlusCircle, label: 'Add' },
  logs: { Icon: List, label: 'Logs' },
  insights: { Icon: LineChart, label: 'Insights' },
  notifications: { Icon: Bell, label: 'Alerts' },
};

function TabBar({ state, navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.canvas, borderTopColor: colors.hairline, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.row}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const { Icon, label } = TAB_CONFIG[route.name] ?? { Icon: Home, label: route.name };
          const color = isFocused ? colors.accent : colors.textMuted;

          const onPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.item}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={label}
            >
              {isFocused ? <View style={[styles.indicator, { backgroundColor: colors.accent }]} /> : null}
              <Icon size={22} color={color} strokeWidth={isFocused ? 2.4 : ICON_STROKE} />
              <Text style={[styles.label, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
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
  bar: { borderTopWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'stretch', height: 60 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingTop: space.sm },
  indicator: {
    position: 'absolute',
    top: 0,
    width: 22,
    height: 2,
    borderRadius: radius.pill,
  },
  label: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 0.8,
  },
});
