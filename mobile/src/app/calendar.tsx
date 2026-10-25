import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertTriangle,
  RotateCcw,
  User,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { GUTTER, space, radius, type, ICON_STROKE } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import {
  Screen,
  Card,
  Button,
  EmptyState,
  AppText,
  StatusPill,
} from '@/components/ui';
import { FadeInSlide } from '@/components/animations/FadeInSlide';
import { useAttendanceFocusRefresh } from '@/hooks/useAttendanceFocusRefresh';
import { getAttendanceLogsPage } from '@/api';
import {
  fetchAllAttendancePages,
  type AttendanceLogRecord,
} from '@/utils/logsPolicy';
import {
  WEEKDAY_LABELS_SHORT,
  generateMonthGrid,
  calculateMonthSummary,
  calculateSubjectBreakdown,
  getPreviousMonth,
  getNextMonth,
  formatFullDateDisplay,
  getYearMonthFromDate,
  formatDateString,
  groupRecordsByDate,
  type DayAttendanceSummary,
  type HeatmapLevel,
} from '@/utils/calendarPolicy';
import { getLocalTodayDateString } from '@/utils/dates';

export default function HistoricalCalendarScreen() {
  const { colors } = useTheme();
  const todayDateString = useMemo(() => getLocalTodayDateString(), []);
  const todayYearMonth = useMemo(() => getYearMonthFromDate(todayDateString), [todayDateString]);

  // Current calendar view (year and month 1..12)
  const [viewYear, setViewYear] = useState<number>(todayYearMonth.year);
  const [viewMonth, setViewMonth] = useState<number>(todayYearMonth.month);

  // Selected date ("YYYY-MM-DD")
  const [selectedDate, setSelectedDate] = useState<string>(todayDateString);

  // Attendance records state
  const [allRecords, setAllRecords] = useState<AttendanceLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isIncomplete, setIsIncomplete] = useState(false);

  // Fetch complete attendance records across all pages
  const loadCompleteHistory = useCallback(async () => {
    try {
      setFetchError(null);
      const result = await fetchAllAttendancePages(
        async (cursor) => getAttendanceLogsPage({ limit: 100, beforeId: cursor })
      );

      setAllRecords(result.records);
      if (!result.ok) {
        setIsIncomplete(true);
        setFetchError('Some older attendance pages could not be loaded. Showing partial history.');
      } else {
        setIsIncomplete(false);
        setFetchError(null);
      }
    } catch (err) {
      console.warn('[Calendar] Error fetching calendar history:', err);
      setFetchError('Failed to load attendance history. Please check your network.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCompleteHistory();
  }, [loadCompleteHistory]);

  // Integrate cross-tab focus refresh
  const { markSynced } = useAttendanceFocusRefresh({
    onRefresh: async () => {
      await loadCompleteHistory();
    },
  });

  const onPullRefresh = useCallback(async () => {
    markSynced();
    setRefreshing(true);
    await loadCompleteHistory();
  }, [loadCompleteHistory, markSynced]);

  // Group records by calendar date
  const dateRecordsMap = useMemo(() => {
    return groupRecordsByDate(allRecords);
  }, [allRecords]);

  // Month grid cells for current view
  const monthGrid = useMemo(() => {
    return generateMonthGrid(viewYear, viewMonth, dateRecordsMap, todayDateString);
  }, [viewYear, viewMonth, dateRecordsMap, todayDateString]);

  // Month-level summary statistics
  const monthSummary = useMemo(() => {
    return calculateMonthSummary(viewYear, viewMonth, dateRecordsMap);
  }, [viewYear, viewMonth, dateRecordsMap]);

  // Selected date summary & details
  const selectedDaySummary = useMemo((): DayAttendanceSummary => {
    const dayRecords = dateRecordsMap.get(selectedDate) ?? [];
    let presentCount = 0;
    let absentCount = 0;
    for (const r of dayRecords) {
      const st = (r.status || '').trim().toLowerCase();
      if (st === 'present') presentCount++;
      else if (st === 'absent') absentCount++;
    }

    const totalClasses = dayRecords.length;
    let percentage: number | null = null;
    if (totalClasses > 0) {
      percentage = Math.round((presentCount / totalClasses) * 1000) / 10;
    }

    const parts = selectedDate.split('-').map(Number);
    const dayOfMonth = parts.length === 3 ? parts[2] : 1;

    return {
      date: selectedDate,
      dayOfMonth,
      isCurrentMonth: parts[0] === viewYear && parts[1] === viewMonth,
      isToday: selectedDate === todayDateString,
      isFuture: selectedDate > todayDateString,
      totalClasses,
      presentCount,
      absentCount,
      percentage,
      hasPresent: presentCount > 0,
      hasAbsent: absentCount > 0,
      intensity: (totalClasses === 0 ? 0 : totalClasses === 1 ? 1 : totalClasses === 2 ? 2 : totalClasses === 3 ? 3 : 4) as HeatmapLevel,
      records: dayRecords,
    };
  }, [selectedDate, dateRecordsMap, viewYear, viewMonth, todayDateString]);

  // Subject breakdown for selected date
  const selectedDaySubjects = useMemo(() => {
    return calculateSubjectBreakdown(selectedDaySummary.records);
  }, [selectedDaySummary.records]);

  // Month Navigation Handlers
  const handlePrevMonth = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prev = getPreviousMonth(viewYear, viewMonth);
    setViewYear(prev.year);
    setViewMonth(prev.month);
  }, [viewYear, viewMonth]);

  const handleNextMonth = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = getNextMonth(viewYear, viewMonth);
    setViewYear(next.year);
    setViewMonth(next.month);
  }, [viewYear, viewMonth]);

  const handleJumpToToday = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setViewYear(todayYearMonth.year);
    setViewMonth(todayYearMonth.month);
    setSelectedDate(todayDateString);
  }, [todayYearMonth, todayDateString]);

  const handleSelectDay = useCallback((cell: DayAttendanceSummary) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(cell.date);

    // If tapping a leading/trailing padding day outside the current month, auto-switch to that month
    if (!cell.isCurrentMonth) {
      const parts = cell.date.split('-').map(Number);
      if (parts.length >= 2) {
        setViewYear(parts[0]);
        setViewMonth(parts[1]);
      }
    }
  }, []);

  const isViewingCurrentMonth = viewYear === todayYearMonth.year && viewMonth === todayYearMonth.month;

  // Intensity color generator
  const getCellBackgroundColor = (level: HeatmapLevel, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) {
      return 'transparent';
    }
    switch (level) {
      case 1:
        return 'rgba(139, 92, 246, 0.22)';
      case 2:
        return 'rgba(139, 92, 246, 0.44)';
      case 3:
        return 'rgba(139, 92, 246, 0.68)';
      case 4:
        return colors.accent;
      default:
        return colors.surface;
    }
  };

  if (loading && allRecords.length === 0) {
    return (
      <Screen>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <AppText variant="bodySm" tone="secondary" style={styles.loadingText}>
            Loading complete attendance calendar...
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullRefresh}
            tintColor={colors.textMuted}
            colors={[colors.accent]}
          />
        }
      >
        {/* Header Row */}
        <FadeInSlide>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              hitSlop={12}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={22} color={colors.textPrimary} strokeWidth={ICON_STROKE} />
            </Pressable>
            <View style={styles.headerTitles}>
              <AppText variant="h1">Attendance Calendar</AppText>
              <AppText variant="bodySm" tone="secondary">
                Historical activity & heatmaps
              </AppText>
            </View>
          </View>
        </FadeInSlide>

        {/* Partial History / Network Warning Banner */}
        {fetchError && (
          <FadeInSlide delay={40}>
            <Card
              padding={space.md}
              style={{
                ...styles.warningCard,
                backgroundColor: colors.warningSubtle,
                borderColor: colors.warning,
              }}
            >
              <View style={styles.warningRow}>
                <AlertTriangle size={18} color={colors.warning} strokeWidth={ICON_STROKE} />
                <View style={styles.warningTextWrap}>
                  <AppText variant="bodySmMedium" style={{ color: colors.warning }}>
                    {isIncomplete ? 'Partial History Loaded' : 'Connection Warning'}
                  </AppText>
                  <AppText variant="bodySm" tone="secondary">
                    {fetchError}
                  </AppText>
                </View>
                <Button
                  title="Retry"
                  variant="secondary"
                  size="md"
                  fullWidth={false}
                  onPress={loadCompleteHistory}
                  icon={<RotateCcw size={14} color={colors.textPrimary} strokeWidth={ICON_STROKE} />}
                />
              </View>
            </Card>
          </FadeInSlide>
        )}

        {/* Month Navigation Bar */}
        <FadeInSlide delay={80}>
          <Card padding={space.md} style={styles.navCard}>
            <View style={styles.monthNavRow}>
              <Pressable
                onPress={handlePrevMonth}
                hitSlop={10}
                style={[styles.navArrowBtn, { borderColor: colors.hairline }]}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <ChevronLeft size={18} color={colors.textPrimary} strokeWidth={ICON_STROKE} />
              </Pressable>

              <View style={styles.monthTitleBox}>
                <AppText variant="h2">{monthSummary.monthTitle}</AppText>
                <AppText variant="mono" tone="muted" style={{ fontSize: 12 }}>
                  {monthSummary.totalClasses} {monthSummary.totalClasses === 1 ? 'class' : 'classes'} across {monthSummary.activeDaysCount} active days
                </AppText>
              </View>

              <Pressable
                onPress={handleNextMonth}
                hitSlop={10}
                style={[styles.navArrowBtn, { borderColor: colors.hairline }]}
                accessibilityRole="button"
                accessibilityLabel="Next month"
              >
                <ChevronRight size={18} color={colors.textPrimary} strokeWidth={ICON_STROKE} />
              </Pressable>
            </View>

            {/* Jump to Today Pill */}
            {!isViewingCurrentMonth && (
              <View style={styles.todayPillRow}>
                <Pressable
                  onPress={handleJumpToToday}
                  style={[
                    styles.todayPill,
                    { backgroundColor: colors.accentSubtle, borderColor: colors.accentBorder },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Jump to current month"
                >
                  <Sparkles size={13} color={colors.accent} strokeWidth={ICON_STROKE} />
                  <AppText variant="bodySmMedium" style={{ color: colors.accent }}>
                    Return to Current Month ({todayYearMonth.month}/{todayYearMonth.year})
                  </AppText>
                </Pressable>
              </View>
            )}
          </Card>
        </FadeInSlide>

        {/* Monthly Summary Statistics */}
        <FadeInSlide delay={120}>
          <Card padding={space.lg} style={styles.metricsCard}>
            <View style={styles.metricsRow}>
              <View style={styles.metricCol}>
                <AppText variant="eyebrow" tone="muted">
                  Classes
                </AppText>
                <AppText variant="mono" style={[type.metricMd, { color: colors.textPrimary }]}>
                  {monthSummary.totalClasses}
                </AppText>
              </View>

              <View style={[styles.metricDivider, { backgroundColor: colors.hairline }]} />

              <View style={styles.metricCol}>
                <AppText variant="eyebrow" tone="muted">
                  Present
                </AppText>
                <AppText variant="mono" style={[type.metricMd, { color: colors.success }]}>
                  {monthSummary.presentCount}
                </AppText>
              </View>

              <View style={[styles.metricDivider, { backgroundColor: colors.hairline }]} />

              <View style={styles.metricCol}>
                <AppText variant="eyebrow" tone="muted">
                  Absent
                </AppText>
                <AppText variant="mono" style={[type.metricMd, { color: colors.danger }]}>
                  {monthSummary.absentCount}
                </AppText>
              </View>

              <View style={[styles.metricDivider, { backgroundColor: colors.hairline }]} />

              <View style={styles.metricCol}>
                <AppText variant="eyebrow" tone="muted">
                  Rate
                </AppText>
                <AppText variant="mono" style={[type.metricMd, { color: colors.textPrimary }]}>
                  {monthSummary.percentage !== null ? `${monthSummary.percentage}%` : '—'}
                </AppText>
              </View>
            </View>
          </Card>
        </FadeInSlide>

        {/* Calendar Grid Card */}
        <FadeInSlide delay={160}>
          <Card padding={space.md} style={styles.gridCard}>
            {/* Weekday Labels (Mon -> Sun) */}
            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS_SHORT.map((dayName, idx) => {
                const isSun = idx === 6;
                return (
                  <View key={dayName} style={styles.weekdayCol}>
                    <AppText
                      variant="eyebrow"
                      style={{
                        color: isSun ? colors.textFaint : colors.textMuted,
                        textAlign: 'center',
                      }}
                    >
                      {dayName}
                    </AppText>
                  </View>
                );
              })}
            </View>

            {/* Day Grid Cells */}
            <View style={styles.daysGrid}>
              {monthGrid.map((cell) => {
                const isSelected = cell.date === selectedDate;
                const cellBg = getCellBackgroundColor(cell.intensity, cell.isCurrentMonth);
                const isFuture = cell.isFuture;

                // High-contrast text color based on intensity
                let dateTextColor = colors.textPrimary;
                if (!cell.isCurrentMonth) {
                  dateTextColor = colors.textFaint;
                } else if (cell.intensity >= 3) {
                  dateTextColor = '#FFFFFF';
                } else if (isFuture) {
                  dateTextColor = colors.textMuted;
                }

                return (
                  <Pressable
                    key={cell.date}
                    onPress={() => handleSelectDay(cell)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${cell.date}, ${
                      cell.totalClasses === 0
                        ? 'no recorded classes'
                        : `${cell.totalClasses} classes, ${cell.presentCount} present, ${cell.absentCount} absent`
                    }`}
                    style={[
                      styles.dayCell,
                      {
                        backgroundColor: cellBg,
                        borderColor: isSelected
                          ? colors.textPrimary
                          : cell.isCurrentMonth
                          ? colors.hairline
                          : 'transparent',
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    {/* Day Number */}
                    <AppText
                      variant="mono"
                      style={[
                        styles.dayNumberText,
                        {
                          color: dateTextColor,
                          fontWeight: cell.isToday || isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {cell.dayOfMonth}
                    </AppText>

                    {/* Status Composition Indicator Dots */}
                    {cell.isCurrentMonth && cell.totalClasses > 0 && (
                      <View style={styles.cellDotsRow}>
                        {cell.hasPresent && (
                          <View
                            style={[
                              styles.statusDot,
                              {
                                backgroundColor:
                                  cell.intensity >= 3 ? '#FFFFFF' : colors.success,
                              },
                            ]}
                          />
                        )}
                        {cell.hasAbsent && (
                          <View
                            style={[
                              styles.statusDot,
                              {
                                backgroundColor:
                                  cell.intensity >= 3 ? '#FFD1D1' : colors.danger,
                              },
                            ]}
                          />
                        )}
                      </View>
                    )}

                    {/* Today Marker */}
                    {cell.isToday && (
                      <View
                        style={[
                          styles.todayBar,
                          {
                            backgroundColor:
                              cell.intensity >= 3 ? '#FFFFFF' : colors.accent,
                          },
                        ]}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Heatmap Legend */}
            <View style={[styles.legendBox, { borderTopColor: colors.hairline }]}>
              <View style={styles.legendScale}>
                <AppText variant="bodySm" tone="muted" style={{ fontSize: 11 }}>
                  Less
                </AppText>
                <View style={[styles.legendCell, { backgroundColor: colors.surface, borderColor: colors.hairline }]} />
                <View style={[styles.legendCell, { backgroundColor: 'rgba(139, 92, 246, 0.22)' }]} />
                <View style={[styles.legendCell, { backgroundColor: 'rgba(139, 92, 246, 0.44)' }]} />
                <View style={[styles.legendCell, { backgroundColor: 'rgba(139, 92, 246, 0.68)' }]} />
                <View style={[styles.legendCell, { backgroundColor: colors.accent }]} />
                <AppText variant="bodySm" tone="muted" style={{ fontSize: 11 }}>
                  More (4+)
                </AppText>
              </View>

              <View style={styles.legendDotsRow}>
                <View style={styles.legendDotItem}>
                  <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                  <AppText variant="bodySm" tone="secondary" style={{ fontSize: 11 }}>
                    Present
                  </AppText>
                </View>
                <View style={styles.legendDotItem}>
                  <View style={[styles.statusDot, { backgroundColor: colors.danger }]} />
                  <AppText variant="bodySm" tone="secondary" style={{ fontSize: 11 }}>
                    Absent
                  </AppText>
                </View>
              </View>
            </View>
          </Card>
        </FadeInSlide>

        {/* Selected-Day Detail Section */}
        <FadeInSlide delay={200}>
          <View style={styles.detailSection}>
            <View style={styles.detailHeader}>
              <AppText variant="eyebrow" tone="muted">
                Selected Day
              </AppText>
              <AppText variant="h2">{formatFullDateDisplay(selectedDate)}</AppText>
            </View>

            {selectedDaySummary.totalClasses === 0 ? (
              <EmptyState
                icon={<Calendar size={30} color={colors.textMuted} strokeWidth={ICON_STROKE} />}
                title="No attendance recorded"
                description={
                  selectedDaySummary.isFuture
                    ? 'This date is in the future. Classes cannot be recorded in advance.'
                    : 'No attendance was logged for this date. Days without logged classes represent unrecorded activity, not absences.'
                }
              />
            ) : (
              <View style={styles.dayRecordsContainer}>
                {/* Day Summary Card */}
                <Card padding={space.md} style={styles.daySummaryCard}>
                  <View style={styles.daySummaryRow}>
                    <View style={styles.daySummaryStat}>
                      <AppText variant="eyebrow" tone="muted">
                        Total
                      </AppText>
                      <AppText variant="mono" style={{ color: colors.textPrimary, fontSize: 15 }}>
                        {selectedDaySummary.totalClasses} classes
                      </AppText>
                    </View>
                    <View style={styles.daySummaryStat}>
                      <AppText variant="eyebrow" tone="muted">
                        Present
                      </AppText>
                      <AppText variant="mono" style={{ color: colors.success, fontSize: 15 }}>
                        {selectedDaySummary.presentCount}
                      </AppText>
                    </View>
                    <View style={styles.daySummaryStat}>
                      <AppText variant="eyebrow" tone="muted">
                        Absent
                      </AppText>
                      <AppText variant="mono" style={{ color: colors.danger, fontSize: 15 }}>
                        {selectedDaySummary.absentCount}
                      </AppText>
                    </View>
                    <View style={styles.daySummaryStat}>
                      <AppText variant="eyebrow" tone="muted">
                        Rate
                      </AppText>
                      <AppText variant="mono" style={{ color: colors.textPrimary, fontSize: 15 }}>
                        {selectedDaySummary.percentage !== null
                          ? `${selectedDaySummary.percentage}%`
                          : '—'}
                      </AppText>
                    </View>
                  </View>
                </Card>

                {/* Subject Breakdown Pills */}
                {selectedDaySubjects.length > 0 && (
                  <View style={styles.subjectBreakdownBox}>
                    <AppText variant="eyebrow" tone="muted" style={{ marginBottom: space.xs }}>
                      Subjects on this day
                    </AppText>
                    <View style={styles.subjectPillGrid}>
                      {selectedDaySubjects.map((sub) => (
                        <View
                          key={sub.subject}
                          style={[
                            styles.subjectStatPill,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.hairline,
                            },
                          ]}
                        >
                          <AppText variant="bodySmMedium" numberOfLines={1}>
                            {sub.subject}
                          </AppText>
                          <AppText variant="mono" style={{ color: colors.textMuted, fontSize: 11 }}>
                            {sub.present}/{sub.total}
                          </AppText>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Individual Class Records */}
                <AppText variant="eyebrow" tone="muted" style={{ marginTop: space.sm }}>
                  Logged Class Entries ({selectedDaySummary.records.length})
                </AppText>

                {selectedDaySummary.records.map((record) => (
                  <Card key={record.id} padding={space.md} style={styles.recordCard}>
                    <View style={styles.recordTopRow}>
                      <View style={styles.recordInfo}>
                        <AppText variant="bodyMedium" numberOfLines={1}>
                          {record.subject}
                        </AppText>
                        {record.professor ? (
                          <View style={styles.metaRow}>
                            <User size={13} color={colors.textMuted} strokeWidth={ICON_STROKE} />
                            <AppText variant="bodySm" tone="secondary" numberOfLines={1}>
                              {record.professor}
                            </AppText>
                          </View>
                        ) : null}
                      </View>
                      <StatusPill status={record.status as any} />
                    </View>

                    {/* Timestamp and Absent Reason */}
                    <View style={styles.recordBottomRow}>
                      {record.timestamp ? (
                        <View style={styles.metaRow}>
                          <Clock size={12} color={colors.textFaint} strokeWidth={ICON_STROKE} />
                          <AppText variant="mono" style={{ color: colors.textMuted, fontSize: 11 }}>
                            {record.timestamp}
                          </AppText>
                        </View>
                      ) : (
                        <View />
                      )}

                      {record.status.toLowerCase() === 'absent' && record.reason ? (
                        <AppText variant="bodySm" tone="danger" numberOfLines={1}>
                          Reason: {record.reason}
                        </AppText>
                      ) : null}
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        </FadeInSlide>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.md,
  },
  loadingText: { marginTop: space.sm },
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: space.md,
    paddingBottom: space.huge,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.lg,
  },
  backButton: {
    marginRight: space.md,
    padding: space.xs,
  },
  headerTitles: {
    flex: 1,
  },
  warningCard: {
    marginBottom: space.md,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  warningTextWrap: {
    flex: 1,
    gap: 2,
  },
  navCard: {
    marginBottom: space.md,
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navArrowBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthTitleBox: {
    alignItems: 'center',
    gap: 2,
  },
  todayPillRow: {
    marginTop: space.md,
    alignItems: 'center',
  },
  todayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  metricsCard: {
    marginBottom: space.md,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricDivider: {
    width: 1,
    height: 28,
  },
  gridCard: {
    marginBottom: space.lg,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: space.sm,
  },
  weekdayCol: {
    width: '14.28%',
    alignItems: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
    marginVertical: 1,
  },
  dayNumberText: {
    fontSize: 12,
  },
  cellDotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: radius.pill,
  },
  todayBar: {
    width: 10,
    height: 2,
    borderRadius: 1,
    marginTop: 2,
  },
  legendBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.md,
    paddingTop: space.sm,
    borderTopWidth: 1,
  },
  legendScale: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendCell: {
    width: 12,
    height: 12,
    borderRadius: 2,
    borderWidth: 0.5,
  },
  legendDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  legendDotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailSection: {
    marginTop: space.sm,
    gap: space.md,
  },
  detailHeader: {
    gap: 2,
  },
  dayRecordsContainer: {
    gap: space.md,
  },
  daySummaryCard: {},
  daySummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  daySummaryStat: {
    alignItems: 'center',
    gap: 2,
  },
  subjectBreakdownBox: {
    marginTop: space.xs,
  },
  subjectPillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  subjectStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  recordCard: {
    marginBottom: space.xs,
  },
  recordTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.xs,
  },
  recordInfo: {
    flex: 1,
    marginRight: space.md,
    gap: 2,
  },
  recordBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
});
