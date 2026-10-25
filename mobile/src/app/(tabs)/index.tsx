import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Image, Pressable } from 'react-native';
import { Inbox, AlertTriangle, Calendar, ChevronRight, CalendarDays } from 'lucide-react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { GUTTER, space, radius, type, motion } from '@/design/tokens';
import { useTheme, zoneColor } from '@/design/theme';
import { Screen, Card, SectionHeader, Stat, ProgressRing, ProgressBar, EmptyState, AppText } from '@/components/ui';
import { CountUpText } from '@/components/animations/CountUpText';
import { FadeInSlide } from '@/components/animations/FadeInSlide';
import { StaggeredList } from '@/components/animations/StaggeredList';
import { ShimmerPlaceholder } from '@/components/animations/ShimmerPlaceholder';
import { useAttendanceIntelligence } from '@/hooks/useAttendanceIntelligence';
import { useAttendanceFocusRefresh } from '@/hooks/useAttendanceFocusRefresh';
import { SubjectIntelligenceBadge } from '@/components/attendance/SubjectIntelligenceBadge';
import { AttendanceIntelligenceSheet } from '@/components/attendance/AttendanceIntelligenceSheet';
import type { SubjectIntelligenceItem } from '@/types/attendanceIntelligence';

export default function DashboardScreen() {
  const { colors } = useTheme();

  const {
    loading,
    refreshing,
    error,
    isApiError,
    overall,
    subjects,
    setSubjectTarget,
    resetSubjectTarget,
    refresh,
  } = useAttendanceIntelligence();

  const [selectedSubjectName, setSelectedSubjectName] = useState<string | null>(null);
  const selectedSubject = subjects.find((s) => s.subject === selectedSubjectName) ?? null;

  const { markSynced } = useAttendanceFocusRefresh({
    onRefresh: refresh,
  });

  const onRefresh = useCallback(async () => {
    markSynced();
    await refresh();
  }, [refresh, markSynced]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const totalPresents = overall.present;
  const totalAbsents = overall.absent;
  const totalClasses = overall.total;
  const streak = overall.streak;

  const hasData = overall.hasData && overall.percentage !== null;
  const overallPercentage = overall.percentage ?? 0;

  const isSafe = hasData && overallPercentage >= 75;
  const isWarning = hasData && overallPercentage >= 60 && overallPercentage < 75;
  const zone = hasData ? zoneColor(colors, overallPercentage) : colors.textMuted;
  const zoneLabel = !hasData ? 'No data' : isSafe ? 'Safe zone' : isWarning ? 'At risk' : 'Danger zone';

  let subtitle = "Here's where your attendance stands.";
  if (!overall.hasData || totalClasses === 0) {
    subtitle = 'No classes logged';
  } else {
    const req = overall.projections.requiredToTarget;
    const safe = overall.projections.safeToMiss;
    if (overall.currentStatus === 'below_target' && req.status === 'achievable' && req.required > 0) {
      subtitle = `Critical — attend ${req.required} more to reach 75%.`;
    } else if (overall.currentStatus === 'target_met' && safe.status === 'can_miss' && safe.safeToMiss > 0) {
      subtitle = `You're clear to skip ${safe.safeToMiss} without dropping below 75%.`;
    } else if (overall.currentStatus === 'target_met') {
      subtitle = "Perfectly balanced — don't miss the next one.";
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} colors={[colors.accent]} />
        }
      >
        {loading ? (
          <DashboardSkeleton />
        ) : isApiError && error ? (
          <EmptyState
            icon={<AlertTriangle size={26} color={colors.warning} strokeWidth={2} />}
            title="Couldn't load dashboard"
            description={error}
            action={{ label: 'Retry', onPress: refresh }}
          />
        ) : (
          <>
            <FadeInSlide>
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <AppText variant="h1" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                    {greeting}
                  </AppText>
                  <AppText variant="bodySm" tone="secondary" style={styles.subtitle}>
                    {subtitle}
                  </AppText>
                </View>
                <Image
                  source={require('../../../assets/teddy.jpg')}
                  style={[styles.mascot, { borderColor: colors.hairline }]}
                />
              </View>
            </FadeInSlide>

            <FadeInSlide delay={80}>
              <Card padding={space.xxl} style={styles.hero}>
                <View style={styles.heroTopRow}>
                  <AppText variant="eyebrow" tone="muted">
                    Overall attendance
                  </AppText>
                  <View style={[styles.zoneChip, { backgroundColor: hasData ? zone + '22' : colors.surfaceElevated, borderColor: colors.hairline }]}>
                    <View style={[styles.zoneDot, { backgroundColor: zone }]} />
                    <AppText style={[type.bodySmMedium, { color: zone }]}>{zoneLabel}</AppText>
                  </View>
                </View>

                <View style={styles.heroMetricRow}>
                  {hasData ? (
                    <CountUpText
                      value={overallPercentage}
                      style={[type.metricHero, { color: colors.textPrimary }]}
                      suffix=""
                      decimals={1}
                      duration={motion.timing.metric}
                    />
                  ) : (
                    <AppText style={[type.metricHero, { color: colors.textPrimary }]}>--</AppText>
                  )}
                  <AppText style={[type.metricLg, styles.percentSign, { color: colors.textMuted }]}>%</AppText>
                </View>

                <ProgressBar progress={hasData ? overallPercentage : 0} color={zone} height={6} />

                <View style={[styles.divider, { backgroundColor: colors.hairline }]} />

                <View style={styles.statsRow}>
                  <Stat label="Present">
                    <CountUpText value={totalPresents} style={[type.metricLg, { color: colors.success }]} decimals={0} />
                  </Stat>
                  <View style={[styles.statDivider, { backgroundColor: colors.hairline }]} />
                  <Stat label="Absent">
                    <CountUpText value={totalAbsents} style={[type.metricLg, { color: colors.danger }]} decimals={0} />
                  </Stat>
                  <View style={[styles.statDivider, { backgroundColor: colors.hairline }]} />
                  <Stat label="Streak">
                    <CountUpText value={streak} style={[type.metricLg, { color: colors.textPrimary }]} decimals={0} />
                  </Stat>
                </View>
              </Card>
            </FadeInSlide>

            <FadeInSlide delay={110}>
              <View style={styles.actionBannersContainer}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/calendar' as any);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Open Attendance Calendar"
                  style={styles.actionBannerPressable}
                >
                  <Card style={styles.actionBanner}>
                    <View style={[styles.actionIconBox, { backgroundColor: colors.accentSubtle }]}>
                      <CalendarDays size={20} color={colors.accent} strokeWidth={2} />
                    </View>
                    <View style={styles.actionBannerText}>
                      <AppText variant="bodyMedium">Attendance Calendar</AppText>
                      <AppText variant="bodySm" tone="secondary">
                        Heatmaps & daily activity history
                      </AppText>
                    </View>
                    <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
                  </Card>
                </Pressable>

                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/planner' as any);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Open Weekly Planner"
                  style={styles.actionBannerPressable}
                >
                  <Card style={styles.actionBanner}>
                    <View style={[styles.actionIconBox, { backgroundColor: colors.accentSubtle }]}>
                      <Calendar size={20} color={colors.accent} strokeWidth={2} />
                    </View>
                    <View style={styles.actionBannerText}>
                      <AppText variant="bodyMedium">Weekly Planner</AppText>
                      <AppText variant="bodySm" tone="secondary">
                        Manage recurring Mon–Sat timetable
                      </AppText>
                    </View>
                    <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
                  </Card>
                </Pressable>
              </View>
            </FadeInSlide>

            <View style={styles.sectionHeader}>
              <FadeInSlide delay={160}>
                <SectionHeader
                  eyebrow="Per subject"
                  title="Subjects"
                  trailing={<AppText variant="mono" tone="muted">{subjects.length}</AppText>}
                />
              </FadeInSlide>
            </View>

            {subjects.length === 0 ? (
              <EmptyState
                icon={<Inbox size={26} color={colors.textMuted} strokeWidth={2} />}
                title="No subjects yet"
                description="Log your first class from the Add tab and your subjects will appear here."
              />
            ) : (
              <StaggeredList staggerDelay={55}>
                {subjects.map((subject: SubjectIntelligenceItem) => {
                  return (
                    <Pressable
                      key={subject.subject}
                      onPress={() => setSelectedSubjectName(subject.subject)}
                      accessibilityRole="button"
                      accessibilityLabel={`${subject.subject}, ${subject.hasData ? `${subject.present} of ${subject.total} classes` : 'no classes logged'}`}
                      style={styles.subjectCardWrapper}
                    >
                      <Card style={styles.subjectCard}>
                        <View style={styles.subjectInfo}>
                          <View style={styles.subjectTitleRow}>
                            <AppText variant="bodyMedium" numberOfLines={1} style={styles.subjectTitleText}>
                              {subject.subject}
                            </AppText>
                            {subject.isCustomTarget && (
                              <View
                                style={[
                                  styles.customTargetBadge,
                                  { borderColor: colors.accentBorder, backgroundColor: colors.accentSubtle },
                                ]}
                              >
                                <AppText style={[type.bodySmMedium, { color: colors.accent, fontSize: 11 }]}>
                                  {subject.target}% target
                                </AppText>
                              </View>
                            )}
                          </View>
                          <AppText style={[type.mono, styles.subjectMeta, { color: colors.textMuted }]}>
                            {subject.hasData ? `${subject.present} / ${subject.total} classes` : 'No classes logged'}
                          </AppText>
                          <View style={styles.subjectStatusRow}>
                            <SubjectIntelligenceBadge item={subject} />
                          </View>
                        </View>
                        <ProgressRing percentage={subject.percentage} size={54} strokeWidth={5} />
                      </Card>
                    </Pressable>
                  );
                })}
              </StaggeredList>
            )}
          </>
        )}
      </ScrollView>

      <AttendanceIntelligenceSheet
        visible={selectedSubject !== null}
        onClose={() => setSelectedSubjectName(null)}
        item={selectedSubject}
        onUpdateTarget={setSubjectTarget}
        onResetTarget={resetSubjectTarget}
      />
    </Screen>
  );
}

function DashboardSkeleton() {
  return (
    <View>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ShimmerPlaceholder width={180} height={28} />
          <ShimmerPlaceholder width={240} height={14} style={{ marginTop: space.sm }} />
        </View>
        <ShimmerPlaceholder width={48} height={48} borderRadius={radius.md} />
      </View>
      <ShimmerPlaceholder height={196} borderRadius={radius.md} style={styles.hero} />
      <ShimmerPlaceholder width={140} height={24} style={styles.sectionHeader} />
      <View style={{ gap: space.md }}>
        {[0, 1, 2, 3].map((i) => (
          <ShimmerPlaceholder key={i} height={92} borderRadius={radius.md} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: space.md,
    paddingBottom: space.huge,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space.xxl,
  },
  headerText: { flex: 1, paddingRight: space.lg },
  subtitle: { marginTop: space.xs },
  mascot: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1 },
  hero: { marginBottom: space.xxxl },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.lg },
  zoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  zoneDot: { width: 6, height: 6, borderRadius: radius.pill },
  heroMetricRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: space.lg },
  percentSign: { marginBottom: space.sm, marginLeft: space.xs },
  divider: { height: 1, marginVertical: space.xl },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statDivider: { width: 1, height: 32 },
  sectionHeader: { marginBottom: space.lg },
  subjectCardWrapper: {
    marginBottom: space.md,
  },
  subjectCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectInfo: { flex: 1, marginRight: space.lg, gap: space.xs },
  subjectTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  subjectTitleText: {
    flexShrink: 1,
  },
  customTargetBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  subjectMeta: {},
  subjectStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.xs },
  actionBannersContainer: {
    gap: space.sm,
    marginBottom: space.xxl,
  },
  actionBannerPressable: {},
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: space.md,
  },
  actionBannerText: {
    flex: 1,
    gap: 2,
  },
});
