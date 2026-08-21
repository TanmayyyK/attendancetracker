import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Bell, CheckCircle2, AlertTriangle, XCircle, Clock, type LucideIcon } from 'lucide-react-native';

import { GUTTER, space, radius, type, ICON_STROKE } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import type { ColorTokens } from '@/design/tokens';
import { Screen, Card, EmptyState, AppText } from '@/components/ui';
import { FadeInSlide } from '@/components/animations/FadeInSlide';
import { StaggeredList } from '@/components/animations/StaggeredList';
import { ShimmerPlaceholder } from '@/components/animations/ShimmerPlaceholder';
import { getNotificationHistory } from '@/api';

interface NotificationItem {
  id: number;
  title: string;
  body: string;
  sent_at: string;
  status: string;
  recipients_count: number;
}

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

/** One place that maps a delivery status to its color, icon, and human label. */
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

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    const data = await getNotificationHistory();
    setNotifications(data || []);
    setLoading(false);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const countLabel = notifications.length > 0
    ? `${notifications.length} sent`
    : 'Nothing sent yet';

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
                Push notifications sent to your device.
              </AppText>
            </View>
            <AppText variant="mono" tone="muted">
              {countLabel}
            </AppText>
          </View>
        </FadeInSlide>

        {loading ? (
          <View style={styles.skeletonList}>
            {[0, 1, 2].map((i) => (
              <ShimmerPlaceholder key={i} height={108} borderRadius={radius.md} />
            ))}
          </View>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell size={26} color={colors.textMuted} strokeWidth={ICON_STROKE} />}
            title="All quiet"
            description="Reminders and alerts you receive will be collected here so you never miss one."
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
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: space.xl, gap: space.md },
  headerText: { flex: 1 },
  subtitle: { marginTop: space.xs },
  skeletonList: { gap: space.md },
  notifCard: { marginBottom: space.md, paddingLeft: space.lg + 3 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, marginBottom: space.sm },
  notifTitle: { flex: 1 },
  notifTime: {},
  notifBody: { marginBottom: space.md },
  notifFooter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
