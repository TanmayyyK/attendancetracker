import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  useColorScheme,
} from 'react-native';
import { Bell, CheckCircle, AlertCircle, Clock } from 'lucide-react-native';
import { getNotificationHistory } from '../../api';

import { GlassCard } from '../../components/ui/GlassCard';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { FadeInSlide } from '../../components/animations/FadeInSlide';
import { StaggeredList } from '../../components/animations/StaggeredList';
import { ShimmerCard } from '../../components/animations/ShimmerPlaceholder';
import Animated, { 
  FadeInDown, 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withSequence, 
  withTiming 
} from 'react-native-reanimated';

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

function StatusIcon({ status, isDark }: { status: string; isDark: boolean }) {
  switch (status) {
    case 'success':
      return <CheckCircle size={16} color="#22c55e" />;
    case 'partial':
      return <AlertCircle size={16} color="#eab308" />;
    case 'failed':
      return <AlertCircle size={16} color="#ef4444" />;
    default:
      return <Clock size={16} color={isDark ? '#94A3B8' : '#64748B'} />;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'success': return '#22c55e';
    case 'partial': return '#eab308';
    case 'failed': return '#ef4444';
    default: return '#94A3B8';
  }
}

function AnimatedBell({ isDark }: { isDark: boolean }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withSequence(
        withTiming(10, { duration: 150 }),
        withTiming(-10, { duration: 150 }),
        withTiming(10, { duration: 150 }),
        withTiming(0, { duration: 150 }),
        withTiming(0, { duration: 2000 })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }]
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <Bell size={28} color={isDark ? '#F8FAFC' : '#0F172A'} />
    </Animated.View>
  );
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

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

  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const mutedColor = isDark ? '#94A3B8' : '#64748B';

  const styles = StyleSheet.create({
    content: {
      padding: 16,
      paddingTop: 20,
      paddingBottom: 120,
    },
    headerCard: {
      alignItems: 'center',
      padding: 24,
      marginBottom: 24,
    },
    bellContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: textColor,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 14,
      color: mutedColor,
    },
    notifCard: {
      marginBottom: 12,
      padding: 16,
    },
    notifHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    notifTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: textColor,
      flex: 1,
    },
    notifTime: {
      fontSize: 12,
      color: mutedColor,
      marginLeft: 8,
    },
    notifBody: {
      fontSize: 14,
      color: isDark ? '#CBD5E1' : '#475569',
      lineHeight: 20,
      marginBottom: 12,
    },
    notifFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    notifStatus: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: textColor,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: mutedColor,
      textAlign: 'center',
      paddingHorizontal: 40,
    },
  });

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={textColor}
            colors={[textColor]}
          />
        }
      >
        <FadeInSlide delay={0}>
          <GlassCard style={styles.headerCard}>
            <View style={styles.bellContainer}>
              <AnimatedBell isDark={isDark} />
            </View>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>
              {notifications.length > 0
                ? `${notifications.length} notification${notifications.length !== 1 ? 's' : ''} sent`
                : 'No notifications yet'}
            </Text>
          </GlassCard>
        </FadeInSlide>

        {loading ? (
          <View style={{ gap: 12 }}>
            <ShimmerCard height={120} />
            <ShimmerCard height={120} />
            <ShimmerCard height={120} />
          </View>
        ) : notifications.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(200)}>
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <AnimatedBell isDark={isDark} />
              </View>
              <Text style={styles.emptyTitle}>All quiet here</Text>
              <Text style={styles.emptySubtitle}>
                Push notifications you receive will appear here
              </Text>
            </View>
          </Animated.View>
        ) : (
          <StaggeredList>
            {notifications.map((notif) => {
              const bColor = statusColor(notif.status);
              return (
                <GlassCard 
                  key={notif.id} 
                  style={{
                    ...styles.notifCard, 
                    borderLeftWidth: 3, 
                    borderLeftColor: bColor,
                  }}
                >
                  <View style={styles.notifHeader}>
                    <Text style={styles.notifTitle} numberOfLines={1}>
                      {notif.title}
                    </Text>
                    <Text style={styles.notifTime}>
                      {formatTimeAgo(notif.sent_at)}
                    </Text>
                  </View>
                  <Text style={styles.notifBody}>{notif.body}</Text>
                  <View style={styles.notifFooter}>
                    <StatusIcon status={notif.status} isDark={isDark} />
                    <Text style={[styles.notifStatus, { color: bColor }]}>
                      {notif.status === 'success'
                        ? 'Delivered'
                        : notif.status === 'partial'
                        ? 'Partially delivered'
                        : notif.status === 'failed'
                        ? 'Failed'
                        : 'Pending'}
                    </Text>
                  </View>
                </GlassCard>
              );
            })}
          </StaggeredList>
        )}
      </ScrollView>
    </GradientBackground>
  );
}
