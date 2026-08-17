import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  useColorScheme,
  Image,
} from 'react-native';

import { GlassCard } from '../../components/ui/GlassCard';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { CountUpText } from '../../components/animations/CountUpText';
import { FadeInSlide } from '../../components/animations/FadeInSlide';
import { StaggeredList } from '../../components/animations/StaggeredList';
import { FullScreenLoader } from '../../components/ui/FullScreenLoader';
import { getDashboardSummary, getCumulativeSubjects } from '../../api';

// Helper for Roman numerals
function toRoman(num: number): string {
  const lookup: Record<string, number> = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1};
  let roman = '';
  for (let i in lookup) {
    while (num >= lookup[i]) {
      roman += i;
      num -= lookup[i];
    }
  }
  return roman || 'I';
}

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const sum = await getDashboardSummary();
      const sub = await getCumulativeSubjects();
      if (sum) setSummary(sum);
      if (sub) setSubjects(sub);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  // Dynamic greeting based on time of day
  const hour = new Date().getHours();
  let greeting = 'Good Evening';
  if (hour < 12) greeting = 'Good Morning';
  else if (hour < 18) greeting = 'Good Afternoon';

  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const mutedColor = isDark ? '#94A3B8' : '#64748B';

  // Compute overall percentage from subjects data (matches original logic)
  const overallPercentage = subjects.length > 0
    ? subjects.reduce((a: number, c: any) => a + (c.percentage || 0), 0) / subjects.length
    : summary?.overall?.percentage || 0;

  // Analytical Stats Math
  const totalPresents = summary?.overall?.present || 0;
  const totalAbsents = summary?.overall?.absent || 0;
  const totalClasses = summary?.overall?.total || 0;
  
  const globalNeeded = Math.max(0, 3 * totalClasses - 4 * totalPresents);
  const globalSafeToSkip = Math.floor(Math.max(0, (4 * totalPresents - 3 * totalClasses) / 3));

  let dynamicSubtitle = "Here's your attendance overview";
  if (totalClasses > 0) {
    if (globalNeeded > 0) {
      dynamicSubtitle = `Critical zone. You need to attend ${globalNeeded} more classes.`;
    } else if (globalSafeToSkip > 0) {
      dynamicSubtitle = `You're in the clear. You can safely skip ${globalSafeToSkip} classes.`;
    } else {
      dynamicSubtitle = `Perfectly balanced. Don't miss your next class.`;
    }
  }

  return (
    <GradientBackground>
      {loading || !summary ? (
        <FullScreenLoader />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={isDark ? '#F8FAFC' : '#0F172A'}
              colors={[isDark ? '#F8FAFC' : '#0F172A']}
              progressBackgroundColor={isDark ? '#0A1628' : '#F0F2F8'}
            />
          }
        >
          <View style={styles.content}>
            {/* Greeting Header */}
            <FadeInSlide delay={0}>
              <View style={styles.headerRow}>
                <View style={styles.headerTextContainer}>
                  <Text style={[styles.greeting, { color: textColor }]}>
                    {greeting}
                  </Text>
                  <Text style={[styles.subtitle, { color: mutedColor }]}>
                    {dynamicSubtitle}
                  </Text>
                </View>
                <Image 
                  source={require('../../../assets/teddy.jpg')} 
                  style={styles.teddyMascot} 
                />
              </View>
            </FadeInSlide>

            {/* Hero Stats Card */}
            <FadeInSlide delay={100}>
              <GlassCard style={styles.heroCard} animated={false}>
                <View style={styles.heroCenter}>
                  <CountUpText
                    value={overallPercentage}
                    style={[styles.heroPercentage, { color: textColor }]}
                    suffix="%"
                    decimals={1}
                    duration={1400}
                  />
                  <View style={[
                    styles.zoneBadge, 
                    { backgroundColor: overallPercentage >= 75 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }
                  ]}>
                    <Text style={[
                      styles.zoneText,
                      { color: overallPercentage >= 75 ? '#22C55E' : '#EF4444' }
                    ]}>
                      {overallPercentage >= 75 ? 'Safe Zone' : 'Danger Zone'}
                    </Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statCol}>
                    <Text style={[styles.statLabel, { color: mutedColor }]}>
                      PRESENT
                    </Text>
                    <CountUpText
                      value={totalPresents}
                      style={[styles.statValue, { color: '#22C55E' }]}
                      decimals={0}
                    />
                  </View>
                  <View style={styles.statCol}>
                    <Text style={[styles.statLabel, { color: mutedColor }]}>
                      ABSENT
                    </Text>
                    <CountUpText
                      value={totalAbsents}
                      style={[styles.statValue, { color: '#EF4444' }]}
                      decimals={0}
                    />
                  </View>
                  <View style={styles.statCol}>
                    <Text style={[styles.statLabel, { color: mutedColor }]}>
                      STREAK
                    </Text>
                    <CountUpText
                      value={summary.overall?.streak || 0}
                      style={[styles.statValue, { color: textColor }]}
                      decimals={0}
                    />
                  </View>
                </View>
              </GlassCard>
            </FadeInSlide>

            {/* Subjects Section */}
            <FadeInSlide delay={200}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                Subjects
              </Text>
            </FadeInSlide>

            <StaggeredList staggerDelay={60}>
              {subjects.map((subject: any) => {
                const p = subject.present || 0;
                const t = subject.total || 0;
                const needed = Math.max(0, 3 * t - 4 * p);
                const safeToSkip = Math.floor(Math.max(0, (4 * p - 3 * t) / 3));

                return (
                  <GlassCard
                    key={subject.subject}
                    style={styles.subjectCard}
                    animated={false}
                  >
                    <View style={styles.subjectInfo}>
                      <Text style={[styles.subjectName, { color: textColor }]}>
                        {subject.subject}
                      </Text>
                      <Text style={[styles.subjectClasses, { color: mutedColor }]}>
                        {subject.present} / {subject.total} Classes
                      </Text>
                      {needed > 0 ? (
                        <Text style={[styles.neededText, { color: '#EF4444' }]}>
                          {needed} more {needed === 1 ? 'class' : 'classes'} for 75%
                        </Text>
                      ) : safeToSkip > 0 ? (
                        <Text style={[styles.neededText, { color: '#22C55E' }]}>
                          Safe to skip {safeToSkip} {safeToSkip === 1 ? 'class' : 'classes'}
                        </Text>
                      ) : (
                        <Text style={[styles.neededText, { color: '#EAB308' }]}>
                          On track. Don't miss the next one.
                        </Text>
                      )}
                    </View>
                    <ProgressRing
                      percentage={subject.percentage || 0}
                      size={56}
                      strokeWidth={5}
                    />
                  </GlassCard>
                );
              })}
            </StaggeredList>
          </View>
        </ScrollView>
      )}
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 100,
  },
  content: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  teddyMascot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  heroCard: {
    padding: 28,
    marginBottom: 32,
  },
  heroCenter: {
    alignItems: 'center',
    marginBottom: 28,
  },
  heroPercentage: {
    fontSize: 56,
    fontWeight: '800',
    marginBottom: 8,
  },
  zoneBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  zoneText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    fontWeight: '700',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
  },
  subjectCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
  },
  subjectInfo: {
    flex: 1,
    marginRight: 12,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  subjectClasses: {
    fontSize: 14,
  },
  neededText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  heroSkeleton: {
    height: 220,
    marginBottom: 32,
    borderRadius: 20,
  },
  subjectSkeleton: {
    height: 88,
    borderRadius: 20,
    marginBottom: 12,
  },
});
