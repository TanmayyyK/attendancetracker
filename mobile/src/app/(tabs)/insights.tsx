import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, useColorScheme } from 'react-native';
import { getMonthlySnapshots, getDashboardSummary } from '../../api';
import { LinearGradient } from 'expo-linear-gradient';

import { GlassCard } from '../../components/ui/GlassCard';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { FadeInSlide } from '../../components/animations/FadeInSlide';
import { StaggeredList } from '../../components/animations/StaggeredList';
import { ShimmerCard } from '../../components/animations/ShimmerPlaceholder';
import { CalendarX } from 'lucide-react-native';

export default function Insights() {
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [bunkReasons, setBunkReasons] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const fetchData = useCallback(async () => {
    const [data, summary] = await Promise.all([
      getMonthlySnapshots(),
      getDashboardSummary()
    ]);
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

  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const mutedColor = isDark ? '#94A3B8' : '#64748B';

  const styles = StyleSheet.create({
    content: {
      padding: 16,
      paddingTop: 20,
      paddingBottom: 120,
    },
    headerContainer: {
      marginBottom: 24,
      marginTop: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: textColor,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: mutedColor,
    },
    cardContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    monthText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: textColor,
      marginBottom: 4,
    },
    classesText: {
      fontSize: 14,
      color: mutedColor,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: textColor,
      marginTop: 16,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: mutedColor,
      textAlign: 'center',
    }
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
        <View style={styles.headerContainer}>
          <FadeInSlide delay={0}>
            <Text style={styles.title}>Bunk Analytics 👻</Text>
            <Text style={styles.subtitle}>Where did your attendance go?</Text>
          </FadeInSlide>
        </View>

        {loading ? (
          <ShimmerCard height={120} />
        ) : bunkReasons.length > 0 ? (
          <FadeInSlide delay={100}>
            <GlassCard style={{ marginBottom: 32, padding: 20 }}>
              {bunkReasons.map((item: any, idx: number) => {
                const max = bunkReasons[0].count;
                const widthPct = max > 0 ? (item.count / max) * 100 : 0;
                return (
                  <View key={item.reason} style={{ marginBottom: idx === bunkReasons.length - 1 ? 0 : 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: textColor, fontWeight: '600', fontSize: 15 }}>{item.reason}</Text>
                      <Text style={{ color: mutedColor, fontSize: 14 }}>{item.count} classes</Text>
                    </View>
                    <View style={{ height: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                        <LinearGradient 
                          colors={idx === 0 ? ['#EF4444', '#DC2626'] : ['#7C3AED', '#6D28D9']}
                          style={{ width: `${widthPct}%`, height: '100%', borderRadius: 4 }}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        />
                    </View>
                  </View>
                )
              })}
            </GlassCard>
          </FadeInSlide>
        ) : (
          <FadeInSlide delay={100}>
            <GlassCard style={{ marginBottom: 32, padding: 20, alignItems: 'center' }}>
              <Text style={{ color: mutedColor, textAlign: 'center' }}>No absent reasons logged yet. Stay in class!</Text>
            </GlassCard>
          </FadeInSlide>
        )}

        <View style={[styles.headerContainer, { marginTop: 0 }]}>
          <FadeInSlide delay={0}>
            <Text style={styles.title}>Monthly Insights</Text>
            <Text style={styles.subtitle}>Track your attendance trends</Text>
          </FadeInSlide>
        </View>

        {loading ? (
          <View style={{ gap: 16 }}>
            <ShimmerCard height={100} />
            <ShimmerCard height={100} />
            <ShimmerCard height={100} />
          </View>
        ) : snapshots.length === 0 ? (
          <FadeInSlide delay={200}>
            <View style={styles.emptyContainer}>
              <CalendarX size={48} color={mutedColor} />
              <Text style={styles.emptyTitle}>No Insights Yet</Text>
              <Text style={styles.emptySubtitle}>
                Data will appear here once attendance is recorded.
              </Text>
            </View>
          </FadeInSlide>
        ) : (
          <StaggeredList>
            {snapshots.map((snap, index) => {
              const present = snap.overall?.present || 0;
              const total = snap.overall?.total || 0;
              const absent = total - present;
              const percentage = snap.overall?.percentage || 0;

              return (
                <GlassCard key={index} style={{ marginBottom: 16, padding: 16 }}>
                  <View style={styles.cardContent}>
                    <View>
                      <Text style={styles.monthText}>{snap.label}</Text>
                      <Text style={styles.classesText}>
                        Present: {present} | Absent: {absent}
                      </Text>
                    </View>
                    <ProgressRing 
                      percentage={percentage} 
                      size={56} 
                      strokeWidth={5} 
                    />
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
