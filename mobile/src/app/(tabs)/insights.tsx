import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ghost, CalendarRange, AlertTriangle } from 'lucide-react-native';

import { GUTTER, space, radius, type, ICON_STROKE } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Screen, Card, SectionHeader, ProgressRing, ProgressBar, EmptyState, AppText } from '@/components/ui';
import { FadeInSlide } from '@/components/animations/FadeInSlide';
import { StaggeredList } from '@/components/animations/StaggeredList';
import { ShimmerPlaceholder } from '@/components/animations/ShimmerPlaceholder';
import { getMonthlySnapshots, getDashboardSummary } from '@/api';
import { useAttendanceIntelligence } from '@/hooks/useAttendanceIntelligence';
import { useAttendanceFocusRefresh } from '@/hooks/useAttendanceFocusRefresh';
import { WhatIfSimulator } from '@/components/attendance/WhatIfSimulator';
import { resolveSimulatorSectionState } from '@/utils/simulatorPolicy';

export default function Insights() {
  const { colors } = useTheme();

  const {
    subjects,
    loading: intelligenceLoading,
    error: intelligenceError,
    isApiError: isIntelligenceError,
    refresh: refreshIntelligence,
  } = useAttendanceIntelligence();

  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);
  const [bunkReasons, setBunkReasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [data, summary] = await Promise.all([getMonthlySnapshots(), getDashboardSummary()]);
      if (data === null && summary === null) {
        setError('Unable to load insights. Check your connection.');
        setSnapshotsError(null);
      } else {
        setError(null);
        if (data === null) {
          setSnapshots([]);
          setSnapshotsError('Unable to load monthly trends. Check your connection.');
        } else {
          setSnapshots(data);
          setSnapshotsError(null);
        }
        setBunkReasons(summary?.bunk_reasons || []);
      }
    } catch (err) {
      console.warn('[Insights] fetchData error:', err);
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchData(), refreshIntelligence()]);
  }, [fetchData, refreshIntelligence]);

  const { markSynced } = useAttendanceFocusRefresh({
    onRefresh: refreshAll,
  });

  const onRefresh = useCallback(async () => {
    markSynced();
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  }, [refreshAll, markSynced]);

  const handleRetry = useCallback(async () => {
    markSynced();
    setLoading(true);
    await refreshAll();
  }, [refreshAll, markSynced]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxCount = bunkReasons.length > 0 ? bunkReasons[0].count : 0;
  const isLoading = loading || intelligenceLoading;

  const simulatorState = resolveSimulatorSectionState({
    isLoading,
    isIntelligenceError,
    intelligenceError,
    subjectCount: subjects.length,
  });

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
            <AppText variant="h1">Insights</AppText>
            <AppText variant="bodySm" tone="secondary" style={styles.subtitle}>
              Where your attendance goes, month over month.
            </AppText>
          </View>
        </FadeInSlide>

        {isLoading ? (
          <View style={styles.skeletonList}>
            <ShimmerPlaceholder height={220} borderRadius={radius.md} style={styles.block} />
            <ShimmerPlaceholder height={160} borderRadius={radius.md} style={styles.block} />
            <ShimmerPlaceholder height={88} borderRadius={radius.md} />
            <ShimmerPlaceholder height={88} borderRadius={radius.md} />
          </View>
        ) : error && snapshots.length === 0 && bunkReasons.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle size={26} color={colors.warning} strokeWidth={ICON_STROKE} />}
            title="Couldn't load insights"
            description={error}
            action={{ label: 'Retry', onPress: handleRetry }}
          />
        ) : (
          <>
            {/* 1. What-If Attendance Simulator */}
            {simulatorState.sectionStatus !== 'hidden' && (
              <>
                <View style={styles.sectionHeader}>
                  <FadeInSlide delay={50}>
                    <SectionHeader eyebrow="Simulation" title="What-if simulator" />
                  </FadeInSlide>
                </View>
                <FadeInSlide delay={80}>
                  {simulatorState.sectionStatus === 'error' ? (
                    <View style={styles.block}>
                      <EmptyState
                        icon={<AlertTriangle size={26} color={colors.warning} strokeWidth={ICON_STROKE} />}
                        title="Couldn't load simulator"
                        description={simulatorState.errorMessage || 'Unable to load attendance records for simulation.'}
                        action={{ label: 'Retry', onPress: refreshIntelligence }}
                      />
                    </View>
                  ) : (
                    <WhatIfSimulator subjects={subjects} />
                  )}
                </FadeInSlide>
              </>
            )}

            {/* 2. Bunk Analytics */}
            <View style={styles.sectionHeader}>
              <FadeInSlide delay={70}>
                <SectionHeader eyebrow="Where it went" title="Bunk analytics" />
              </FadeInSlide>
            </View>

            {bunkReasons.length > 0 ? (
              <FadeInSlide delay={110}>
                <Card padding={space.xl} style={styles.block}>
                  {bunkReasons.map((item: any, idx: number) => {
                    const widthPct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    const barColor = idx === 0 ? colors.danger : colors.accent;
                    return (
                      <View key={item.reason} style={idx === bunkReasons.length - 1 ? undefined : styles.reasonRow}>
                        <View style={styles.reasonHead}>
                          <AppText variant="bodyMedium">{item.reason}</AppText>
                          <AppText style={[type.mono, { color: colors.textMuted }]}>{item.count}</AppText>
                        </View>
                        <ProgressBar progress={widthPct} color={barColor} height={6} />
                      </View>
                    );
                  })}
                </Card>
              </FadeInSlide>
            ) : (
              <View style={styles.block}>
                <EmptyState
                  icon={<Ghost size={26} color={colors.textMuted} strokeWidth={ICON_STROKE} />}
                  title="No absences logged"
                  description="Reasons you mark when logging an absence will break down here. Stay in class!"
                />
              </View>
            )}

            {/* 3. Monthly Trends */}
            <View style={styles.sectionHeader}>
              <FadeInSlide delay={70}>
                <SectionHeader eyebrow="Trends" title="Monthly" />
              </FadeInSlide>
            </View>

            {snapshotsError ? (
              <EmptyState
                icon={<AlertTriangle size={26} color={colors.warning} strokeWidth={ICON_STROKE} />}
                title="Couldn't load monthly trends"
                description={snapshotsError}
                action={{ label: 'Retry', onPress: handleRetry }}
              />
            ) : snapshots.length === 0 ? (
              <EmptyState
                icon={<CalendarRange size={26} color={colors.textMuted} strokeWidth={ICON_STROKE} />}
                title="Nothing to chart yet"
                description="Once you've recorded a full month, your attendance trend will appear here."
              />
            ) : (
              <StaggeredList staggerDelay={55}>
                {snapshots.map((snap, index) => {
                  const present = snap.overall?.present || 0;
                  const total = snap.overall?.total || 0;
                  const absent = total - present;
                  const percentage = snap.overall?.percentage || 0;

                  return (
                    <Card key={snap.month_key ?? index} style={styles.monthCard}>
                      <View style={styles.monthInfo}>
                        <AppText variant="bodyMedium" numberOfLines={1}>
                          {snap.label}
                        </AppText>
                        <AppText style={[type.mono, { color: colors.textMuted }]}>
                          {present} present · {absent} absent
                        </AppText>
                      </View>
                      <ProgressRing percentage={percentage} size={54} strokeWidth={5} />
                    </Card>
                  );
                })}
              </StaggeredList>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: space.md, paddingBottom: space.xxxl },
  header: { marginBottom: space.xl },
  subtitle: { marginTop: space.xs },
  sectionHeader: { marginBottom: space.lg, marginTop: space.sm },
  block: { marginBottom: space.md },
  reasonRow: { marginBottom: space.lg },
  reasonHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  skeletonList: { gap: space.md },
  monthCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  monthInfo: { flex: 1, marginRight: space.lg, gap: space.xs },
});
