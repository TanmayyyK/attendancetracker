import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, useColorScheme } from 'react-native';
import { getDashboardSummary } from '../../api';

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const fetchData = async () => {
    const data = await getDashboardSummary();
    if (data) setSummary(data);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    },
    headerTitle: {
      fontSize: 16,
      color: isDark ? '#94a3b8' : '#64748b',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    percentageContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: 8,
    },
    percentageText: {
      fontSize: 48,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    percentageSign: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginLeft: 4,
    },
    statsRow: {
      flexDirection: 'row',
      marginTop: 20,
      justifyContent: 'space-between',
    },
    statItem: {
      flex: 1,
    },
    statLabel: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : '#64748b',
      marginBottom: 4,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 16,
    },
    subjectCard: {
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 16,
      borderRadius: 16,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    subjectInfo: {
      flex: 1,
    },
    subjectName: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 4,
    },
    subjectDetails: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : '#64748b',
    },
    subjectPercent: {
      fontSize: 20,
      fontWeight: 'bold',
    },
  });

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#f8fafc' : '#0f172a'} />}
    >
      {summary && (
        <>
          <View style={styles.headerCard}>
            <Text style={styles.headerTitle}>Overall Attendance</Text>
            <View style={styles.percentageContainer}>
              <Text style={styles.percentageText}>
                {(summary.subject_cards?.length > 0 
                  ? summary.subject_cards.reduce((a: number, c: any) => a + c.percentage, 0) / summary.subject_cards.length 
                  : summary.overall.percentage).toFixed(1)}
              </Text>
              <Text style={styles.percentageSign}>%</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Present</Text>
                <Text style={styles.statValue}>{summary.overall.present}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Absent</Text>
                <Text style={styles.statValue}>{summary.overall.absent}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Streak</Text>
                <Text style={styles.statValue}>{summary.overall.streak} 🔥</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Subjects</Text>
          {summary.subject_cards.map((subject: any) => (
            <View key={subject.subject_name} style={styles.subjectCard}>
              <View style={styles.subjectInfo}>
                <Text style={styles.subjectName}>{subject.subject_name}</Text>
                <Text style={styles.subjectDetails}>
                  {subject.present_classes} / {subject.total_classes} Classes
                </Text>
              </View>
              <Text
                style={[
                  styles.subjectPercent,
                  { color: subject.percentage >= 75 ? '#22c55e' : subject.percentage >= 60 ? '#eab308' : '#ef4444' }
                ]}
              >
                {subject.percentage.toFixed(0)}%
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}
