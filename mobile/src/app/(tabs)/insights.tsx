import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, useColorScheme } from 'react-native';
import { getMonthlySnapshots } from '../../api';

export default function Insights() {
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const fetchData = async () => {
    const data = await getMonthlySnapshots();
    setSnapshots(data || []);
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
    content: {
      padding: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 20,
    },
    card: {
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 3,
    },
    monthText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 4,
    },
    classesText: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : '#64748b',
    },
    percentContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    percentText: {
      fontSize: 24,
      fontWeight: 'bold',
    },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#f8fafc' : '#0f172a'} colors={[isDark ? '#f8fafc' : '#0f172a']} progressBackgroundColor={isDark ? '#0f172a' : '#ffffff'} />}
    >
      <Text style={styles.title}>Monthly Insights</Text>
      {snapshots.length === 0 && (
        <Text style={{ color: isDark ? '#94a3b8' : '#64748b' }}>No data available for insights yet.</Text>
      )}
      {snapshots.map((snap, index) => (
        <View key={index} style={styles.card}>
          <View>
            <Text style={styles.monthText}>{snap.label}</Text>
            <Text style={styles.classesText}>
              Present: {snap.overall?.present || 0} | Absent: {(snap.overall?.total || 0) - (snap.overall?.present || 0)}
            </Text>
          </View>
          <View style={styles.percentContainer}>
            <Text
              style={[
                styles.percentText,
                { color: snap.overall?.percentage >= 75 ? '#22c55e' : snap.overall?.percentage >= 60 ? '#eab308' : '#ef4444' }
              ]}
            >
              {snap.overall?.percentage?.toFixed(0) || 0}%
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
