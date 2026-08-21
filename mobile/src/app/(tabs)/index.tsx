import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Image } from 'react-native';
import { Inbox } from 'lucide-react-native';

import { GUTTER, space, radius, type, motion } from '@/design/tokens';
import { useTheme, zoneColor } from '@/design/theme';
import { Screen, Card, SectionHeader, Stat, ProgressRing, ProgressBar, EmptyState, AppText } from '@/components/ui';
import { CountUpText } from '@/components/animations/CountUpText';
import { FadeInSlide } from '@/components/animations/FadeInSlide';
import { StaggeredList } from '@/components/animations/StaggeredList';
import { ShimmerPlaceholder } from '@/components/animations/ShimmerPlaceholder';
import { getDashboardSummary, getCumulativeSubjects } from '@/api';

/** Attendance math, kept verbatim from the original business logic. */
function subjectStatus(present: number, total: number) {
  const needed = Math.max(0, 3 * total - 4 * present);
  const safeToSkip = Math.floor(Math.max(0, (4 * present - 3 * total) / 3));
  return { needed, safeToSkip };
}

export default function DashboardScreen() {
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [sum, sub] = await Promise.all([getDashboardSummary(), getCumulativeSubjects()]);
      if (sum) setSummary(sum);
      if (sub) setSubjects(sub);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const overallPercentage =
    subjects.length > 0
      ? subjects.reduce((a: number, c: any) => a + (c.percentage || 0), 0) / subjects.length
      : summary?.overall?.percentage || 0;

  const totalPresents = summary?.overall?.present || 0;
  const totalAbsents = summary?.overall?.absent || 0;
  const totalClasses = summary?.overall?.total || 0;
  const streak = summary?.overall?.streak || 0;

  const { needed: globalNeeded, safeToSkip: globalSafeToSkip } = subjectStatus(totalPresents, totalClasses);
  const isSafe = overallPercentage >= 75;
  const isWarning = overallPercentage >= 60 && overallPercentage < 75;
  const zone = zoneColor(colors, overallPercentage);

  let subtitle = "Here's where your attendance stands.";
  if (totalClasses > 0) {
    if (globalNeeded > 0) subtitle = `Critical — attend ${globalNeeded} more to reach 75%.`;
    else if (globalSafeToSkip > 0) subtitle = `You're clear to skip ${globalSafeToSkip} without dropping below 75%.`;
    else subtitle = "Perfectly balanced — don't miss the next one.";
  }

  const zoneLabel = isSafe ? 'Safe zone' : isWarning ? 'At risk' : 'Danger zone';

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
                  <View style={[styles.zoneChip, { backgroundColor: zone + '22', borderColor: colors.hairline }]}>
                    <View style={[styles.zoneDot, { backgroundColor: zone }]} />
                    <AppText style={[type.bodySmMedium, { color: zone }]}>{zoneLabel}</AppText>
                  </View>
                </View>

                <View style={styles.heroMetricRow}>
                  <CountUpText
                    value={overallPercentage}
                    style={[type.metricHero, { color: colors.textPrimary }]}
                    suffix=""
                    decimals={1}
                    duration={motion.timing.metric}
                  />
                  <AppText style={[type.metricLg, styles.percentSign, { color: colors.textMuted }]}>%</AppText>
                </View>

                <ProgressBar progress={overallPercentage} color={zone} height={6} />

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
                {subjects.map((subject: any) => {
                  const present = subject.present || 0;
                  const total = subject.total || 0;
                  const pct = subject.percentage || 0;
                  const { needed, safeToSkip } = subjectStatus(present, total);
                  const line =
                    needed > 0
                      ? { text: `${needed} more for 75%`, tone: colors.danger }
                      : safeToSkip > 0
                        ? { text: `Safe to skip ${safeToSkip}`, tone: colors.success }
                        : { text: 'On track', tone: colors.warning };

                  return (
                    <Card key={subject.subject} style={styles.subjectCard}>
                      <View style={styles.subjectInfo}>
                        <AppText variant="bodyMedium" numberOfLines={1}>
                          {subject.subject}
                        </AppText>
                        <AppText style={[type.mono, styles.subjectMeta, { color: colors.textMuted }]}>
                          {present} / {total} classes
                        </AppText>
                        <View style={styles.subjectStatusRow}>
                          <View style={[styles.statusDot, { backgroundColor: line.tone }]} />
                          <AppText style={[type.bodySmMedium, { color: line.tone }]}>{line.text}</AppText>
                        </View>
                      </View>
                      <ProgressRing percentage={pct} size={54} strokeWidth={5} />
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
  subjectCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  subjectInfo: { flex: 1, marginRight: space.lg, gap: space.xs },
  subjectMeta: {},
  subjectStatusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  statusDot: { width: 6, height: 6, borderRadius: radius.pill },
});
