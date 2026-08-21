import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Pressable } from 'react-native';
import { Trash2, Download, ScrollText } from 'lucide-react-native';
import Animated, { FadeInDown, FadeOutRight, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

import { GUTTER, space, radius, type, ICON_STROKE } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Screen, Card, Button, StatusPill, EmptyState, AppText } from '@/components/ui';
import { ShimmerPlaceholder } from '@/components/animations/ShimmerPlaceholder';
import { getAttendanceLogs, deleteAttendanceLog } from '@/api';

export default function Logs() {
  const { colors } = useTheme();

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = useCallback(async () => {
    const data = await getAttendanceLogs();
    setLogs(data);
    setLoading(false);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  }, [fetchLogs]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleDelete = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete entry', 'This record will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const success = await deleteAttendanceLog(id);
          if (success) {
            setLogs((prev) => prev.filter((log) => log.id !== id));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            Alert.alert('Error', 'Failed to delete record.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        },
      },
    ]);
  };

  const handleExport = async () => {
    try {
      const filteredLogs = logs.slice(0, 20);

      if (filteredLogs.length === 0) {
        Alert.alert('No Data', 'No logs found to export.');
        return;
      }

      const wsData = filteredLogs.map((log) => ({
        Date: log.date,
        Time: log.timestamp,
        Subject: log.subject,
        Status: log.status,
      }));

      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Last 20 Logs');

      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      const fileUri = FileSystem.documentDirectory + 'Attendance_Last_20.xlsx';
      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Download Last 20 Attendance Logs',
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to generate Excel file.');
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 40).springify()}
      exiting={FadeOutRight.duration(200)}
      layout={LinearTransition.springify().damping(20).stiffness(240)}
      style={styles.rowWrap}
    >
      <Card style={styles.row}>
        <View style={styles.rowInfo}>
          <AppText variant="bodyMedium" numberOfLines={1}>
            {item.subject}
          </AppText>
          <AppText style={[type.mono, { color: colors.textMuted }]}>
            {new Date(item.date).toLocaleDateString()}
          </AppText>
        </View>
        <StatusPill status={item.status} />
        <Pressable
          onPress={() => handleDelete(item.id)}
          hitSlop={8}
          style={styles.deleteBtn}
          accessibilityRole="button"
          accessibilityLabel="Delete entry"
        >
          <Trash2 size={18} color={colors.danger} strokeWidth={ICON_STROKE} />
        </Pressable>
      </Card>
    </Animated.View>
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="h1">History</AppText>
          <AppText variant="bodySm" tone="secondary" style={styles.subtitle}>
            Every class you've logged, most recent first.
          </AppText>
        </View>
        <Button
          title="Export"
          variant="secondary"
          size="md"
          fullWidth={false}
          disabled={logs.length === 0}
          onPress={handleExport}
          icon={<Download size={16} color={colors.textPrimary} strokeWidth={ICON_STROKE} />}
        />
      </View>

      {loading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <ShimmerPlaceholder key={i} height={72} borderRadius={radius.md} />
          ))}
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} colors={[colors.accent]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<ScrollText size={26} color={colors.textMuted} strokeWidth={ICON_STROKE} />}
              title="No entries yet"
              description="Log attendance from the Add tab and each class will show up here."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    paddingTop: space.md,
    paddingBottom: space.lg,
    gap: space.md,
  },
  headerText: { flex: 1 },
  subtitle: { marginTop: space.xs },
  skeletonList: { paddingHorizontal: GUTTER, paddingTop: space.xs, gap: space.md },
  listContent: { paddingHorizontal: GUTTER, paddingTop: space.xs, paddingBottom: space.xxxl, flexGrow: 1 },
  rowWrap: { marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowInfo: { flex: 1, gap: space.xs },
  deleteBtn: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
