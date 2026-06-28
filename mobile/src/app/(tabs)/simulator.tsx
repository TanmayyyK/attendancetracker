import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, useColorScheme } from 'react-native';
import { getSimulatorSubjects } from '../../api';

export default function Simulator() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [simulations, setSimulations] = useState<{ [key: string]: { addPresent: number, addAbsent: number } }>({});
  const [refreshing, setRefreshing] = useState(false);

  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const fetchData = async () => {
    const data = await getSimulatorSubjects();
    if (data) {
      setSubjects(data);
      const initialSims: any = {};
      data.forEach((sub: any) => {
        initialSims[sub.subject_name] = { addPresent: 0, addAbsent: 0 };
      });
      setSimulations(initialSims);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateSim = (subjectName: string, field: 'addPresent' | 'addAbsent', delta: number) => {
    setSimulations(prev => {
      const current = prev[subjectName];
      const newVal = Math.max(0, current[field] + delta);
      return { ...prev, [subjectName]: { ...current, [field]: newVal } };
    });
  };

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
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : '#64748b',
      marginBottom: 24,
    },
    card: {
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 3,
    },
    subjectName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    controlBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
      justifyContent: 'center',
      alignItems: 'center',
    },
    controlBtnText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    controlValue: {
      width: 40,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    label: {
      fontSize: 14,
      color: isDark ? '#e2e8f0' : '#334155',
      fontWeight: '500',
    },
    resultBox: {
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    resultLabel: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : '#64748b',
    },
    resultPercent: {
      fontSize: 24,
      fontWeight: 'bold',
    },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#f8fafc' : '#0f172a'} />}
    >
      <Text style={styles.title}>Simulator</Text>
      <Text style={styles.subtitle}>Plan your upcoming classes and see how they affect your attendance.</Text>
      
      {subjects.map((sub) => {
        const sim = simulations[sub.subject_name] || { addPresent: 0, addAbsent: 0 };
        const simulatedPresent = sub.present_classes + sim.addPresent;
        const simulatedTotal = sub.total_classes + sim.addPresent + sim.addAbsent;
        const projectedPercent = simulatedTotal === 0 ? 0 : (simulatedPresent / simulatedTotal) * 100;
        
        return (
          <View key={sub.subject_name} style={styles.card}>
            <Text style={styles.subjectName}>{sub.subject_name}</Text>
            
            <View style={styles.row}>
              <Text style={styles.label}>Simulate Present</Text>
              <View style={styles.controls}>
                <TouchableOpacity onPress={() => updateSim(sub.subject_name, 'addPresent', -1)} style={styles.controlBtn}>
                  <Text style={styles.controlBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.controlValue}>{sim.addPresent}</Text>
                <TouchableOpacity onPress={() => updateSim(sub.subject_name, 'addPresent', 1)} style={styles.controlBtn}>
                  <Text style={styles.controlBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Simulate Absent</Text>
              <View style={styles.controls}>
                <TouchableOpacity onPress={() => updateSim(sub.subject_name, 'addAbsent', -1)} style={styles.controlBtn}>
                  <Text style={styles.controlBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.controlValue}>{sim.addAbsent}</Text>
                <TouchableOpacity onPress={() => updateSim(sub.subject_name, 'addAbsent', 1)} style={styles.controlBtn}>
                  <Text style={styles.controlBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Projected Percentage</Text>
              <Text style={[
                styles.resultPercent, 
                { color: projectedPercent >= 75 ? '#22c55e' : projectedPercent >= 60 ? '#eab308' : '#ef4444' }
              ]}>
                {projectedPercent.toFixed(1)}%
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
