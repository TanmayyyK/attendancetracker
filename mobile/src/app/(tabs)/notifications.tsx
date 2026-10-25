import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Switch, Pressable, Linking } from 'react-native';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  RotateCcw,
  VolumeX,
  type LucideIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { GUTTER, space, radius, type, ICON_STROKE } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import type { ColorTokens } from '@/design/tokens';
import { Screen, Card, SectionHeader, EmptyState, AppText, Button } from '@/components/ui';
import { FadeInSlide } from '@/components/animations/FadeInSlide';
import { StaggeredList } from '@/components/animations/StaggeredList';
import { ShimmerPlaceholder } from '@/components/animations/ShimmerPlaceholder';
import { getNotificationHistory } from '@/api';
import {
  getStoredPreferences,
  saveStoredPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  reconcileReminders,
  getScheduleDiagnostics,
  triggerTestNotification,
  requestNotificationPermission,
  registerDeviceForPush,
  type NotificationPreferences,
  type ScheduleDiagnostics,
  type ReminderMoment,
} from '@/services/notifications';

interface NotificationItem {
  id: number;
  title: string;
  body: string;
  sent_at: string;
  status: string;
  recipients_count: number;
}

const WEEKDAY_NAMES = [
  { day: 1, label: 'Sun' },
  { day: 2, label: 'Mon' },
  { day: 3, label: 'Tue' },
  { day: 4, label: 'Wed' },
  { day: 5, label: 'Thu' },
  { day: 6, label: 'Fri' },
  { day: 7, label: 'Sat' },
];

function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return isoString;
  }
}

function statusMeta(status: string, colors: ColorTokens): { color: string; Icon: LucideIcon; label: string } {
  switch (status) {
    case 'success':
      return { color: colors.success, Icon: CheckCircle2, label: 'Delivered' };
    case 'partial':
      return { color: colors.warning, Icon: AlertTriangle, label: 'Partially delivered' };
    case 'failed':
      return { color: colors.danger, Icon: XCircle, label: 'Failed' };
    default:
      return { color: colors.textMuted, Icon: Clock, label: 'Pending' };
  }
}

export default function NotificationsScreen() {
  const { colors } = useTheme();

  // Local Reminder Preferences & Diagnostics
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [diagnostics, setDiagnostics] = useState<ScheduleDiagnostics | null>(null);
  const [testingNotification, setTestingNotification] = useState(false);
  const [enablingNotifications, setEnablingNotifications] = useState(false);

  // Server-Side Broadcast History
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLocalSettings = useCallback(async () => {
    const [stored, diag] = await Promise.all([
      getStoredPreferences(),
      getScheduleDiagnostics(),
    ]);
    setPrefs(stored);
    setDiagnostics(diag);
  }, []);

  const fetchBroadcastHistory = useCallback(async () => {
    try {
      const data = await getNotificationHistory();
      if (data === null) {
        setError('Unable to load broadcast alerts. Check your connection.');
      } else {
        setError(null);
        setNotifications(data);
      }
    } catch (err) {
      console.warn('[Notifications] fetchBroadcastHistory error:', err);
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadLocalSettings(), fetchBroadcastHistory()]);
  }, [loadLocalSettings, fetchBroadcastHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  }, [refreshAll]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Preference updates with immediate reconciliation
  const updatePreferences = async (newPrefs: NotificationPreferences) => {
    setPrefs(newPrefs);
    await saveStoredPreferences(newPrefs);
    await reconcileReminders(newPrefs);
    const diag = await getScheduleDiagnostics();
    setDiagnostics(diag);
  };

  const toggleMasterEnabled = (enabled: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updatePreferences({ ...prefs, enabled });
  };

  const toggleMoment = (moment: ReminderMoment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = {
      ...prefs,
      moments: {
        ...prefs.moments,
        [moment]: {
          ...prefs.moments[moment],
          enabled: !prefs.moments[moment].enabled,
        },
      },
    };
    updatePreferences(updated);
  };

  const toggleDay = (dayNumber: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const current = new Set(prefs.activeDays);
    if (current.has(dayNumber)) {
      if (current.size > 1) current.delete(dayNumber); // Keep at least one active day
    } else {
      current.add(dayNumber);
    }
    updatePreferences({ ...prefs, activeDays: Array.from(current).sort() });
  };

  const toggleQuietHours = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updatePreferences({
      ...prefs,
      quietHours: { ...prefs.quietHours, enabled: !prefs.quietHours.enabled },
    });
  };

  const restoreDefaults = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updatePreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES });
  };

  const handleTestNotification = async () => {
    setTestingNotification(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await triggerTestNotification();
    setTestingNotification(false);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleOpenSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  const handleEnableNotifications = async () => {
    if (enablingNotifications) return;
    setEnablingNotifications(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const granted = await requestNotificationPermission();
      if (granted) {
        await reconcileReminders();
        await registerDeviceForPush();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      const diag = await getScheduleDiagnostics();
      setDiagnostics(diag);
    } catch (err) {
      console.warn('Failed to enable notifications:', err);
    } finally {
      setEnablingNotifications(false);
    }
  };

  const countLabel = notifications.length > 0 ? `${notifications.length} received` : '0 received';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} colors={[colors.accent]} />
        }
      >
        <FadeInSlide>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <AppText variant="h1">Alerts</AppText>
              <AppText variant="bodySm" tone="secondary" style={styles.subtitle}>
                Attendance check-in reminders and push notifications.
              </AppText>
            </View>
          </View>
        </FadeInSlide>

        {/* ------------------------------------------------------------- */}
        {/* 1. Local Reminder Control Center */}
        {/* ------------------------------------------------------------- */}
        <FadeInSlide delay={60}>
          <View style={styles.sectionHeader}>
            <SectionHeader eyebrow="Scheduled on this device" title="Check-in reminders" />
          </View>

          <Card padding={space.xl} style={styles.controlCard}>
            {/* Permission Banner (if not granted) */}
            {diagnostics?.permissionStatus === 'denied' ? (
              <View style={[styles.alertBanner, { backgroundColor: colors.dangerSubtle, borderColor: colors.danger }]}>
                <AlertTriangle size={18} color={colors.danger} strokeWidth={ICON_STROKE} />
                <View style={styles.alertBannerText}>
                  <AppText variant="bodySmMedium" tone="danger">
                    Notification permission is disabled
                  </AppText>
                  <AppText variant="bodySm" tone="muted">
                    Enable notifications in device settings so your 21 weekly check-ins can reach you.
                  </AppText>
                </View>
                <Button title="Settings" variant="secondary" size="md" fullWidth={false} onPress={handleOpenSettings} />
              </View>
            ) : diagnostics?.permissionStatus === 'undetermined' ? (
              <View style={[styles.alertBanner, { backgroundColor: colors.accentSubtle, borderColor: colors.accentBorder }]}>
                <Bell size={18} color={colors.accent} strokeWidth={ICON_STROKE} />
                <View style={styles.alertBannerText}>
                  <AppText variant="bodySmMedium" tone="accent">
                    Enable daily attendance reminders
                  </AppText>
                  <AppText variant="bodySm" tone="muted">
                    Tap to allow gentle check-in reminders morning, wrap-up, and night.
                  </AppText>
                </View>
                <Button title="Enable" variant="primary" size="md" fullWidth={false} loading={enablingNotifications} onPress={handleEnableNotifications} />
              </View>
            ) : null}

            {/* Degraded Schedule Notice */}
            {diagnostics?.schedulerStatus === 'degraded' && diagnostics.error && prefs.enabled ? (
              <View style={[styles.alertBanner, { backgroundColor: colors.accentSubtle, borderColor: colors.accentBorder, marginBottom: space.lg }]}>
                <AlertTriangle size={16} color={colors.accent} strokeWidth={ICON_STROKE} />
                <View style={styles.alertBannerText}>
                  <AppText variant="bodySmMedium" tone="accent">
                    Reminder Schedule Degraded
                  </AppText>
                  <AppText variant="bodySm" tone="muted">
                    {diagnostics.error}. Tap "Reset to defaults" below if reminders are missing.
                  </AppText>
                </View>
              </View>
            ) : null}

            {/* Master Toggle */}
            <View style={styles.rowBetween}>
              <View style={styles.col}>
                <AppText variant="bodyMedium">Recurring Check-ins</AppText>
                <AppText variant="bodySm" tone="muted">
                  {prefs.enabled
                    ? diagnostics?.permissionStatus !== 'granted'
                      ? 'Reminders unavailable (permission required)'
                      : diagnostics?.scheduledCount
                        ? `${diagnostics.scheduledCount} active alarms in device schedule`
                        : 'No reminders currently scheduled'
                    : 'All local reminders paused'}
                </AppText>
              </View>
              <Switch
                value={prefs.enabled}
                onValueChange={toggleMasterEnabled}
                trackColor={{ false: colors.hairlineStrong, true: colors.accent }}
                thumbColor={colors.surface}
              />
            </View>

            {/* Next Reminder Preview */}
            {prefs.enabled && diagnostics?.nextReminder ? (
              <View style={[styles.nextReminderBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.hairline }]}>
                <Clock size={16} color={colors.accent} strokeWidth={ICON_STROKE} />
                <View style={styles.nextReminderText}>
                  <AppText variant="eyebrow" tone="accent">
                    Next Reminder
                  </AppText>
                  <AppText variant="bodySmMedium">
                    {diagnostics.nextReminder.title} · {diagnostics.nextReminder.time}
                  </AppText>
                </View>
              </View>
            ) : null}

            <View style={[styles.divider, { backgroundColor: colors.hairline }]} />

            {/* Moment Toggles (Morning / Wrap-Up / Night) */}
            <AppText variant="eyebrow" tone="muted" style={styles.subHeading}>
              Daily Moments
            </AppText>
            <View style={styles.momentsWrap}>
              {(['morning', 'wrapUp', 'night'] as ReminderMoment[]).map((m) => {
                const conf = prefs.moments[m];
                const labels: Record<ReminderMoment, { name: string; desc: string }> = {
                  morning: { name: 'Morning Reset', desc: '8:15 AM · Daily intention' },
                  wrapUp: { name: 'Afternoon Check-in', desc: '4:15 PM · Classes wrapped' },
                  night: { name: 'Night Reflection', desc: '9:15 PM · Final check' },
                };
                return (
                  <Pressable
                    key={m}
                    onPress={() => toggleMoment(m)}
                    style={[
                      styles.momentRow,
                      {
                        backgroundColor: conf.enabled ? colors.surfaceElevated : colors.surface,
                        borderColor: conf.enabled ? colors.hairlineStrong : colors.hairline,
                      },
                    ]}
                  >
                    <View style={styles.momentTextCol}>
                      <AppText variant="bodyMedium" tone={conf.enabled ? 'primary' : 'muted'}>
                        {labels[m].name}
                      </AppText>
                      <AppText variant="bodySm" tone="muted">
                        {labels[m].desc}
                      </AppText>
                    </View>
                    <Switch
                      value={conf.enabled && prefs.enabled}
                      onValueChange={() => toggleMoment(m)}
                      disabled={!prefs.enabled}
                      trackColor={{ false: colors.hairlineStrong, true: colors.accent }}
                      thumbColor={colors.surface}
                    />
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.divider, { backgroundColor: colors.hairline }]} />

            {/* Weekdays Selector */}
            <AppText variant="eyebrow" tone="muted" style={styles.subHeading}>
              Active Days
            </AppText>
            <View style={styles.weekdaysRow}>
              {WEEKDAY_NAMES.map(({ day, label }) => {
                const isActive = prefs.activeDays.includes(day) && prefs.enabled;
                return (
                  <Pressable
                    key={day}
                    onPress={() => toggleDay(day)}
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: isActive ? colors.accent : colors.surfaceElevated,
                        borderColor: isActive ? colors.accent : colors.hairline,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                  >
                    <AppText
                      style={[
                        type.label,
                        { color: isActive ? colors.accentOn : colors.textMuted },
                      ]}
                    >
                      {label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.divider, { backgroundColor: colors.hairline }]} />

            {/* Quiet Hours */}
            <View style={styles.rowBetween}>
              <View style={styles.col}>
                <View style={styles.inlineRow}>
                  <VolumeX size={16} color={colors.textSecondary} strokeWidth={ICON_STROKE} />
                  <AppText variant="bodyMedium">Quiet Hours</AppText>
                </View>
                <AppText variant="bodySm" tone="muted">
                  Pauses check-ins between 10:00 PM and 7:00 AM. Toggling off restores the full schedule.
                </AppText>
              </View>
              <Switch
                value={prefs.quietHours.enabled && prefs.enabled}
                onValueChange={toggleQuietHours}
                disabled={!prefs.enabled}
                trackColor={{ false: colors.hairlineStrong, true: colors.accent }}
                thumbColor={colors.surface}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.hairline }]} />

            {/* Control Actions */}
            <View style={styles.actionsRow}>
              <Button
                title="Test Alert"
                variant="secondary"
                size="md"
                loading={testingNotification}
                fullWidth={false}
                onPress={handleTestNotification}
                icon={<Sparkles size={16} color={colors.textPrimary} strokeWidth={ICON_STROKE} />}
              />
              <Button
                title="Restore Defaults"
                variant="ghost"
                size="md"
                fullWidth={false}
                onPress={restoreDefaults}
                icon={<RotateCcw size={16} color={colors.accent} strokeWidth={ICON_STROKE} />}
              />
            </View>
          </Card>
        </FadeInSlide>

        {/* ------------------------------------------------------------- */}
        {/* 2. Remote Broadcast History */}
        {/* ------------------------------------------------------------- */}
        <View style={styles.sectionHeader}>
          <SectionHeader
            eyebrow="Broadcast feed"
            title="Notification history"
            trailing={<AppText variant="mono" tone="muted">{countLabel}</AppText>}
          />
        </View>

        {loading ? (
          <View style={styles.skeletonList}>
            {[0, 1].map((i) => (
              <ShimmerPlaceholder key={i} height={108} borderRadius={radius.md} />
            ))}
          </View>
        ) : error && notifications.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle size={26} color={colors.warning} strokeWidth={ICON_STROKE} />}
            title="Couldn't load alerts"
            description={error}
            action={{ label: 'Retry', onPress: fetchBroadcastHistory }}
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell size={26} color={colors.textMuted} strokeWidth={ICON_STROKE} />}
            title="No broadcasts yet"
            description="Push notifications sent to your device will appear in this history log."
          />
        ) : (
          <StaggeredList staggerDelay={55}>
            {notifications.map((notif) => {
              const meta = statusMeta(notif.status, colors);
              return (
                <Card key={notif.id} style={styles.notifCard} accentColor={meta.color}>
                  <View style={styles.notifHeader}>
                    <AppText variant="bodyMedium" numberOfLines={1} style={styles.notifTitle}>
                      {notif.title}
                    </AppText>
                    <AppText style={[type.mono, styles.notifTime, { color: colors.textMuted }]}>
                      {formatTimeAgo(notif.sent_at)}
                    </AppText>
                  </View>
                  <AppText variant="bodySm" tone="secondary" style={styles.notifBody}>
                    {notif.body}
                  </AppText>
                  <View style={styles.notifFooter}>
                    <meta.Icon size={14} color={meta.color} strokeWidth={ICON_STROKE} />
                    <AppText style={[type.bodySmMedium, { color: meta.color }]}>{meta.label}</AppText>
                  </View>
                </Card>
              );
            })}
          </StaggeredList>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: space.md, paddingBottom: space.xxxl },
  header: { marginBottom: space.xl },
  headerText: { flex: 1 },
  subtitle: { marginTop: space.xs },
  sectionHeader: { marginTop: space.lg, marginBottom: space.md },
  controlCard: { marginBottom: space.xxl, gap: space.md },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space.sm,
  },
  alertBannerText: { flex: 1, gap: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  col: { flex: 1, gap: space.xs },
  nextReminderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  nextReminderText: { flex: 1, gap: 2 },
  divider: { height: 1, marginVertical: space.xs },
  subHeading: { marginTop: space.xs },
  momentsWrap: { gap: space.sm },
  momentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  momentTextCol: { flex: 1, gap: 2 },
  weekdaysRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.xs },
  dayChip: {
    flex: 1,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: space.md, marginTop: space.xs },
  skeletonList: { gap: space.md },
  notifCard: { marginBottom: space.md, paddingLeft: space.lg + 3 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, marginBottom: space.sm },
  notifTitle: { flex: 1 },
  notifTime: {},
  notifBody: { marginBottom: space.md },
  notifFooter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
