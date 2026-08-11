import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  useColorScheme,
  Animated,
} from 'react-native';
import { Bell, CheckCircle, AlertCircle, Clock } from 'lucide-react-native';
import { getNotificationHistory } from '../../api';

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
      return <Clock size={16} color={isDark ? '#94a3b8' : '#64748b'} />;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'success': return '#22c55e';
    case 'partial': return '#eab308';
    case 'failed': return '#ef4444';
    default: return '#94a3b8';
  }
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const [fadeAnim] = useState(() => new Animated.Value(0));

  const fetchNotifications = useCallback(async () => {
    const data = await getNotificationHistory();
    setNotifications(data || []);
    setLoading(false);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#020617' : '#f8fafc',
    },
    headerCard: {
      margin: 16,
      padding: 24,
      borderRadius: 24,
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
      alignItems: 'center',
    },
    bellContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : '#64748b',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#94a3b8' : '#64748b',
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    notifCard: {
      marginHorizontal: 16,
      marginBottom: 10,
      padding: 16,
      borderRadius: 16,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderLeftWidth: 3,
    },
    notifHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    notifTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
      flex: 1,
    },
    notifTime: {
      fontSize: 12,
      color: isDark ? '#64748b' : '#94a3b8',
      marginLeft: 8,
    },
    notifBody: {
      fontSize: 14,
      color: isDark ? '#cbd5e1' : '#475569',
      lineHeight: 20,
      marginBottom: 8,
    },
    notifFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    notifStatus: {
      fontSize: 12,
      fontWeight: '500',
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
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : '#64748b',
      textAlign: 'center',
      paddingHorizontal: 40,
    },
  });

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={isDark ? '#f8fafc' : '#0f172a'}
          colors={[isDark ? '#f8fafc' : '#0f172a']}
          progressBackgroundColor={isDark ? '#0f172a' : '#ffffff'}
        />
      }
    >
      <View style={styles.headerCard}>
        <View style={styles.bellContainer}>
          <Bell size={28} color={isDark ? '#f8fafc' : '#0f172a'} />
        </View>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Text style={styles.headerSubtitle}>
          {notifications.length > 0
            ? `${notifications.length} notification${notifications.length !== 1 ? 's' : ''} sent`
            : 'No notifications yet'}
        </Text>
      </View>

      {notifications.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Bell size={36} color={isDark ? '#64748b' : '#94a3b8'} />
          </View>
          <Text style={styles.emptyTitle}>All quiet here</Text>
          <Text style={styles.emptySubtitle}>
            Push notifications you receive will appear here
          </Text>
        </View>
      ) : (
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.sectionTitle}>Recent</Text>
          {notifications.map((notif) => (
            <View
              key={notif.id}
              style={[
                styles.notifCard,
                { borderLeftColor: statusColor(notif.status) },
              ]}
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
                <Text
                  style={[
                    styles.notifStatus,
                    { color: statusColor(notif.status) },
                  ]}
                >
                  {notif.status === 'success'
                    ? 'Delivered'
                    : notif.status === 'partial'
                    ? 'Partially delivered'
                    : notif.status === 'failed'
                    ? 'Failed'
                    : 'Pending'}
                </Text>
              </View>
            </View>
          ))}
        </Animated.View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
