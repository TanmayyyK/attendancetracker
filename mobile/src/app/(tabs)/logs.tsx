import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SectionList,
  RefreshControl,
  Alert,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Trash2, Download, ScrollText, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import Animated, { FadeInDown, FadeOutRight, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

import { GUTTER, space, radius, type, ICON_STROKE } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Screen, Card, Button, StatusPill, EmptyState, AppText } from '@/components/ui';
import { ShimmerPlaceholder } from '@/components/animations/ShimmerPlaceholder';
import { getAttendanceLogsPage, deleteAttendanceLog } from '@/api';
import { formatDateOnly } from '@/utils/dates';
import { prepareAttendanceExportData } from '@/utils/export';
import { useAttendanceFocusRefresh } from '@/hooks/useAttendanceFocusRefresh';
import { notifyAttendanceMutation } from '@/services/attendance/attendanceEventBus';
import {
  extractAvailableSubjects,
  filterLogs,
  groupLogsByMonth,
  mergePaginatedLogs,
  fetchAllAttendancePages,
  type AttendanceLogRecord,
  type StatusFilter,
  type MonthSection,
} from '@/utils/logsPolicy';

const STATUS_FILTERS: StatusFilter[] = ['All', 'Present', 'Absent'];
const PAGE_SIZE = 50;

export default function Logs() {
  const { colors } = useTheme();

  const [logs, setLogs] = useState<AttendanceLogRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('All');

  const fetchInitialLogs = useCallback(async () => {
    try {
      setError(null);
      setLoadMoreError(null);
      const page = await getAttendanceLogsPage({ limit: PAGE_SIZE });
      if (page === null) {
        setError('Unable to load attendance history. Check your connection.');
      } else {
        setLogs(page.items);
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
      }
    } catch (err) {
      console.warn('[Logs] fetchInitialLogs error:', err);
      setError('An unexpected error occurred.');
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  const loadMoreLogs = useCallback(async () => {
    if (loadingInitial || loadingMore || !hasMore || nextCursor === null || loadMoreError !== null) {
      return;
    }

    setLoadingMore(true);
    setLoadMoreError(null);

    try {
      const page = await getAttendanceLogsPage({ limit: PAGE_SIZE, beforeId: nextCursor });
      if (page === null) {
        setLoadMoreError('Unable to load older classes. Tap to retry.');
      } else {
        setLogs((prev) => mergePaginatedLogs(prev, page.items));
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
      }
    } catch (err) {
      console.warn('[Logs] loadMoreLogs error:', err);
      setLoadMoreError('Unable to load older classes. Tap to retry.');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingInitial, loadingMore, hasMore, nextCursor, loadMoreError]);

  const { markSynced } = useAttendanceFocusRefresh({
    onRefresh: fetchInitialLogs,
  });

  const onRefresh = useCallback(async () => {
    markSynced();
    setRefreshing(true);
    await fetchInitialLogs();
    setRefreshing(false);
  }, [fetchInitialLogs, markSynced]);

  useEffect(() => {
    fetchInitialLogs();
  }, [fetchInitialLogs]);

  // Derived filtered collections
  const availableSubjects = useMemo(() => extractAvailableSubjects(logs), [logs]);

  const filteredLogs = useMemo(
    () => filterLogs(logs, { subject: selectedSubject, status: selectedStatus }),
    [logs, selectedSubject, selectedStatus]
  );

  const sections = useMemo(() => groupLogsByMonth(filteredLogs), [filteredLogs]);

  const isFiltered = selectedSubject !== 'All' || selectedStatus !== 'All';

  const handleDelete = (id: number, subject: string, date: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete entry',
      `Permanently remove ${subject} on ${formatDateOnly(date)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteAttendanceLog(id);
            if (success) {
              setLogs((prev) => prev.filter((log) => log.id !== id));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              markSynced();
              notifyAttendanceMutation();
            } else {
              Alert.alert('Error', 'Failed to delete record.');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          },
        },
      ]
    );
  };

  const exportRecords = async (
    recordsToExport: AttendanceLogRecord[],
    mode: 'filtered' | 'all',
    meta?: { isIncomplete?: boolean; isComplete?: boolean }
  ) => {
    try {
      if (recordsToExport.length === 0) {
        Alert.alert('No Data', 'No logs available to export.');
        return;
      }

      const wsData = prepareAttendanceExportData(recordsToExport, {
        isIncomplete: meta?.isIncomplete,
        incompleteNotice: 'Network interrupted before all pages could be downloaded from the server.',
      });
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      const sheetName = meta?.isIncomplete
        ? 'Incomplete Logs'
        : mode === 'filtered'
        ? 'Filtered Logs'
        : 'Attendance History';
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      const baseDir = FileSystem.documentDirectory || '';
      const separator = baseDir.endsWith('/') ? '' : '/';

      let fileName = 'Attendance_History.xlsx';
      if (meta?.isIncomplete) {
        fileName = 'Attendance_INCOMPLETE_PARTIAL.xlsx';
      } else if (meta?.isComplete) {
        fileName = mode === 'filtered' ? 'Attendance_Complete_Filtered.xlsx' : 'Attendance_Complete_History.xlsx';
      } else {
        fileName = mode === 'filtered' ? 'Attendance_Loaded_Filtered.xlsx' : 'Attendance_Loaded_View.xlsx';
      }

      const fileUri = `${baseDir}${separator}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      let dialogTitle = `Export Attendance (${recordsToExport.length} classes)`;
      if (meta?.isIncomplete) {
        dialogTitle = `Export INCOMPLETE Attendance (${recordsToExport.length} classes retrieved)`;
      } else if (meta?.isComplete) {
        dialogTitle = `Export Complete Attendance (${recordsToExport.length} classes)`;
      } else {
        dialogTitle = `Export Loaded Attendance (${recordsToExport.length} classes)`;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle,
      });
    } catch (err) {
      console.warn('[Logs] exportRecords error:', err);
      Alert.alert('Error', 'Failed to generate Excel file.');
    }
  };

  const handleExportCompleteHistory = async () => {
    setIsExporting(true);
    try {
      const result = await fetchAllAttendancePages(
        async (cursor) => getAttendanceLogsPage({ limit: 100, beforeId: cursor })
      );

      if (!result.ok) {
        Alert.alert(
          'Export Incomplete',
          `Network connection failed after fetching ${result.records.length} records. Would you like to retry, export the partial dataset, or cancel?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Retry',
              onPress: () => handleExportCompleteHistory(),
            },
            {
              text: `Export Partial (${result.records.length})`,
              style: 'destructive',
              onPress: () => {
                const dataset = isFiltered
                  ? filterLogs(result.records, { subject: selectedSubject, status: selectedStatus })
                  : result.records;
                exportRecords(dataset, isFiltered ? 'filtered' : 'all', { isIncomplete: true });
              },
            },
          ]
        );
        return;
      }

      // Complete fetch succeeded
      const recordsToExport = isFiltered
        ? filterLogs(result.records, { subject: selectedSubject, status: selectedStatus })
        : result.records;

      if (recordsToExport.length === 0) {
        Alert.alert('No Data', 'No classes match the filter in complete history.');
        return;
      }

      await exportRecords(recordsToExport, isFiltered ? 'filtered' : 'all', { isComplete: true });
    } catch (err) {
      console.warn('[Logs] handleExportCompleteHistory error:', err);
      Alert.alert('Export Error', 'An unexpected error occurred while preparing complete export.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = () => {
    if (logs.length === 0) {
      Alert.alert('No Data', 'No logs found to export.');
      return;
    }

    const loadedCount = isFiltered ? filteredLogs.length : logs.length;
    const loadedLabel = isFiltered ? `Loaded Filtered (${loadedCount})` : `Loaded View (${loadedCount})`;
    const completeLabel = isFiltered ? 'Complete Filtered History' : 'Complete History';

    Alert.alert(
      'Export Attendance',
      `Choose whether to export the currently loaded view (${loadedCount} classes) or fetch the complete history from the server.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: loadedLabel,
          onPress: () =>
            exportRecords(isFiltered ? filteredLogs : logs, isFiltered ? 'filtered' : 'all', {
              isComplete: !hasMore,
            }),
        },
        {
          text: completeLabel,
          onPress: () => handleExportCompleteHistory(),
        },
      ]
    );
  };

  const resetFilters = () => {
    setSelectedSubject('All');
    setSelectedStatus('All');
  };

  const renderSectionHeader = ({ section }: { section: MonthSection }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.canvas }]}>
      <AppText variant="h3">{section.title}</AppText>
      <AppText style={[type.mono, { color: colors.textMuted }]}>
        {section.totalClasses} {section.totalClasses === 1 ? 'class' : 'classes'} · {section.presentCount}P ·{' '}
        {section.absentCount}A
      </AppText>
    </View>
  );

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerContainer}>
          <ActivityIndicator size="small" color={colors.accent} />
          <AppText variant="bodySm" tone="secondary" style={styles.footerText}>
            Loading older classes...
          </AppText>
        </View>
      );
    }

    if (loadMoreError) {
      return (
        <Pressable
          onPress={loadMoreLogs}
          style={[styles.footerRetryBtn, { backgroundColor: colors.surface, borderColor: colors.warning }]}
          accessibilityRole="button"
          accessibilityLabel="Retry loading older classes"
        >
          <AlertTriangle size={16} color={colors.warning} strokeWidth={ICON_STROKE} />
          <AppText variant="bodySmMedium" style={{ color: colors.warning }}>
            {loadMoreError}
          </AppText>
        </Pressable>
      );
    }

    if (!hasMore && logs.length > 0) {
      return (
        <View style={styles.footerContainer}>
          <CheckCircle2 size={16} color={colors.textMuted} strokeWidth={ICON_STROKE} />
          <AppText variant="bodySm" tone="secondary" style={styles.footerText}>
            All attendance history loaded ({logs.length} total classes)
          </AppText>
        </View>
      );
    }

    return null;
  };

  const renderItem = ({ item, index }: { item: AttendanceLogRecord; index: number }) => (
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
          <AppText style={[type.mono, { color: colors.textMuted }]}>{formatDateOnly(item.date)}</AppText>
          {item.status.toLowerCase() === 'absent' && item.reason ? (
            <AppText variant="bodySm" tone="secondary" numberOfLines={1}>
              Reason: {item.reason}
            </AppText>
          ) : null}
        </View>
        <StatusPill status={item.status as any} />
        <Pressable
          onPress={() => handleDelete(item.id, item.subject, item.date)}
          hitSlop={8}
          style={styles.deleteBtn}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.subject} on ${formatDateOnly(item.date)}`}
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
            {isFiltered
              ? hasMore
                ? `Showing ${filteredLogs.length} of ${logs.length} loaded classes · scroll for older`
                : `Showing ${filteredLogs.length} of ${logs.length} total classes`
              : hasMore
              ? `Showing ${logs.length} loaded classes · scroll for older`
              : `Showing all ${logs.length} classes, most recent first`}
          </AppText>
        </View>
        <Button
          title={isExporting ? 'Fetching...' : 'Export'}
          variant="secondary"
          size="md"
          fullWidth={false}
          disabled={logs.length === 0 || isExporting}
          onPress={handleExport}
          icon={<Download size={16} color={colors.textPrimary} strokeWidth={ICON_STROKE} />}
        />
      </View>

      {/* Filter Controls */}
      {logs.length > 0 ? (
        <View style={styles.filterSection}>
          {/* Status filter bar */}
          <View style={styles.filterRow}>
            {STATUS_FILTERS.map((status) => {
              const isSelected = selectedStatus === status;
              return (
                <Pressable
                  key={status}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedStatus(status);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Filter status: ${status}`}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected ? colors.accent : colors.surface,
                      borderColor: isSelected ? colors.accent : colors.hairline,
                    },
                  ]}
                >
                  <AppText
                    variant="bodySmMedium"
                    style={{ color: isSelected ? colors.accentOn : colors.textSecondary }}
                  >
                    {status}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {/* Subject filter bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectScroll}>
            {availableSubjects.map((sub) => {
              const isSelected = selectedSubject === sub;
              return (
                <Pressable
                  key={sub}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedSubject(sub);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Filter subject: ${sub}`}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected ? colors.accent : colors.surface,
                      borderColor: isSelected ? colors.accent : colors.hairline,
                    },
                  ]}
                >
                  <AppText
                    variant="bodySmMedium"
                    style={{ color: isSelected ? colors.accentOn : colors.textSecondary }}
                  >
                    {sub}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {loadingInitial ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <ShimmerPlaceholder key={i} height={72} borderRadius={radius.md} />
          ))}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ListFooterComponent={renderFooter}
          onEndReached={loadMoreLogs}
          onEndReachedThreshold={0.4}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textMuted}
              colors={[colors.accent]}
            />
          }
          ListEmptyComponent={
            error ? (
              <EmptyState
                icon={<AlertTriangle size={26} color={colors.warning} strokeWidth={ICON_STROKE} />}
                title="Couldn't load history"
                description={error}
                action={{ label: 'Retry', onPress: fetchInitialLogs }}
              />
            ) : isFiltered ? (
              <EmptyState
                icon={<ScrollText size={26} color={colors.textMuted} strokeWidth={ICON_STROKE} />}
                title={hasMore ? 'No matching classes in loaded history' : 'No matching classes'}
                description={
                  hasMore
                    ? 'No matching classes in currently loaded history. Older records may exist on the server.'
                    : 'No classes match your selected filter criteria. Try changing or clearing your filters.'
                }
                action={
                  hasMore
                    ? { label: 'Load older classes', onPress: loadMoreLogs }
                    : { label: 'Reset filters', onPress: resetFilters }
                }
              />
            ) : (
              <EmptyState
                icon={<ScrollText size={26} color={colors.textMuted} strokeWidth={ICON_STROKE} />}
                title="No entries yet"
                description="Log attendance from the Add tab and each class will show up here."
              />
            )
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
    paddingBottom: space.md,
    gap: space.md,
  },
  headerText: { flex: 1 },
  subtitle: { marginTop: space.xs },
  filterSection: {
    paddingBottom: space.md,
    gap: space.sm,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: GUTTER,
    gap: space.sm,
  },
  subjectScroll: {
    paddingHorizontal: GUTTER,
    gap: space.sm,
    paddingBottom: space.xs,
  },
  filterChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    paddingHorizontal: GUTTER,
    paddingTop: space.md,
    paddingBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  skeletonList: { paddingHorizontal: GUTTER, paddingTop: space.xs, gap: space.md },
  listContent: { paddingHorizontal: GUTTER, paddingTop: space.xs, paddingBottom: space.xxxl, flexGrow: 1 },
  rowWrap: { marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowInfo: { flex: 1, gap: space.xs },
  deleteBtn: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  footerContainer: {
    paddingVertical: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
  footerText: {
    textAlign: 'center',
  },
  footerRetryBtn: {
    marginVertical: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    alignSelf: 'center',
  },
});
