import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ghost, CalendarRange } from 'lucide-react-native';

import { GUTTER, space, radius, type, ICON_STROKE } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Screen, Card, SectionHeader, ProgressRing, ProgressBar, EmptyState, AppText } from '@/components/ui';
import { FadeInSlide } from '@/components/animations/FadeInSlide';
import { StaggeredList } from '@/components/animations/StaggeredList';
import { ShimmerPlaceholder } from '@/components/animations/ShimmerPlaceholder';
import { getMonthlySnapshots, getDashboardSummary } from '@/api';

export default function Insights() {
  const { colors } = useTheme();

  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [bunkReasons, setBunkReasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const [data, summary] = await Promise.all([getMonthlySnapshots(), getDashboardSummary()]);
    setSnapshots(data || []);
    setBunkReasons(summary?.bunk_reasons || []);
    setLoading(false);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxCount = bunkReasons.length > 0 ? bunkReasons[0].count : 0;

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

        <View style={styles.sectionHeader}>
          <FadeInSlide delay={70}>
            <SectionHeader eyebrow="Where it went" title="Bunk analytics" />
          </FadeInSlide>
        </View>

        {loading ? (
          <ShimmerPlaceholder height={160} borderRadius={radius.md} style={styles.block} />
        ) : bunkReasons.length > 0 ? (
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

        <View style={styles.sectionHeader}>
          <FadeInSlide delay={70}>
            <SectionHeader eyebrow="Trends" title="Monthly" />
          </FadeInSlide>
        </View>

        {loading ? (
          <View style={styles.skeletonList}>
            {[0, 1, 2].map((i) => (
              <ShimmerPlaceholder key={i} height={88} borderRadius={radius.md} />
            ))}
          </View>
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
                <Card key={index} style={styles.monthCard}>
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
