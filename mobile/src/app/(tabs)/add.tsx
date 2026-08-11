import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, useColorScheme, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { createBulkAttendance } from '../../api';

const SUBJECTS = [
  "Physiology",
  "Anatomy",
  "Samhita",
  "Padarth Vigyan",
  "Sanskrit (CM Sir)"
] as const;

type CountRow = { present: number; absent: number };

export default function AddLog() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  
  const [subjectCounts, setSubjectCounts] = useState<Record<string, CountRow>>(
    Object.fromEntries(SUBJECTS.map((s) => [s, { present: 0, absent: 0 }]))
  );

  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const totalRows = useMemo(
    () => Object.values(subjectCounts).reduce((acc, cur) => acc + cur.present + cur.absent, 0),
    [subjectCounts]
  );

  const updateCount = (subject: string, type: keyof CountRow, delta: number) => {
    setSubjectCounts((prev) => ({
      ...prev,
      [subject]: { ...prev[subject], [type]: Math.max(0, prev[subject][type] + delta) }
    }));
  };

  const handleSave = async () => {
    if (totalRows === 0) {
      Alert.alert('Error', 'Add at least one class entry.');
      return;
    }
    
    setSaving(true);
    const rows = SUBJECTS.map((subject) => ({
      date,
      mode: "subject",
      subject,
      present: subjectCounts[subject].present,
      absent: subjectCounts[subject].absent
    })).filter((r) => r.present + r.absent > 0);

    const result = await createBulkAttendance(rows);
    setSaving(false);

    if (result.ok) {
      Alert.alert('Success', `Saved ${result.inserted} entries successfully.`);
      setSubjectCounts(Object.fromEntries(SUBJECTS.map((s) => [s, { present: 0, absent: 0 }])));
    } else {
      Alert.alert('Error', 'Failed to save entries. Check backend.');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#020617' : '#f8fafc',
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    header: {
      marginBottom: 24,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : '#64748b',
    },
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
      marginBottom: 16,
      flexWrap: 'wrap',
      gap: 12,
    },
    dateInput: {
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      borderWidth: 1,
      borderColor: isDark ? '#1e293b' : '#e2e8f0',
      borderRadius: 12,
      padding: 12,
      fontSize: 14,
      color: isDark ? '#f8fafc' : '#0f172a',
      minWidth: 140,
    },
    submitButton: {
      backgroundColor: '#7c3aed', // violet-600
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#7c3aed',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    card: {
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? '#1e293b' : '#e2e8f0',
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(124, 58, 237, 0.2)' : 'rgba(124, 58, 237, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    iconText: {
      fontSize: 18,
      fontWeight: '900',
      color: isDark ? '#a78bfa' : '#7c3aed',
    },
    subjectTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#1e293b',
    },
    counterGrid: {
      flexDirection: 'row',
      gap: 16,
    },
    counterCol: {
      flex: 1,
    },
    counterLabel: {
      fontSize: 10,
      fontWeight: '900',
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    counterBoxPresent: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(5, 46, 22, 0.5)' : '#ecfdf5',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(6, 78, 59, 0.5)' : '#d1fae5',
      borderRadius: 12,
      height: 48,
    },
    counterBoxAbsent: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(76, 5, 25, 0.5)' : '#fff1f2',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(136, 19, 55, 0.5)' : '#ffe4e6',
      borderRadius: 12,
      height: 48,
    },
    counterBtnPresent: {
      flex: 1,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    counterBtnAbsent: {
      flex: 1,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    counterBtnTextPresent: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? '#10b981' : '#059669', // emerald-500/600
    },
    counterBtnTextAbsent: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? '#f43f5e' : '#e11d48', // rose-500/600
    },
    counterValuePresent: {
      fontSize: 18,
      fontWeight: '900',
      color: isDark ? '#34d399' : '#059669', // emerald-400/600
      width: 32,
      textAlign: 'center',
    },
    counterValueAbsent: {
      fontSize: 18,
      fontWeight: '900',
      color: isDark ? '#fb7185' : '#e11d48', // rose-400/600
      width: 32,
      textAlign: 'center',
    },
  });

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Daily Entry</Text>
          <Text style={styles.subtitle}>Log attendance dynamically by subject.</Text>
        </View>
        
        <View style={styles.controlsRow}>
          <TextInput
            style={styles.dateInput}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
          />
          
          <TouchableOpacity 
            style={[styles.submitButton, (saving || totalRows === 0) && styles.submitButtonDisabled]}
            onPress={handleSave}
            disabled={saving || totalRows === 0}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.submitText}>Save {totalRows} Entries</Text>
            )}
          </TouchableOpacity>
        </View>

        {SUBJECTS.map((subject) => {
          const counts = subjectCounts[subject];
          return (
            <View key={subject} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconBox}>
                  <Text style={styles.iconText}>{subject[0]}</Text>
                </View>
                <Text style={styles.subjectTitle}>{subject}</Text>
              </View>

              <View style={styles.counterGrid}>
                {/* Present Counter */}
                <View style={styles.counterCol}>
                  <Text style={styles.counterLabel}>Present</Text>
                  <View style={styles.counterBoxPresent}>
                    <TouchableOpacity 
                      style={styles.counterBtnPresent} 
                      onPress={() => updateCount(subject, 'present', -1)}
                    >
                      <Text style={styles.counterBtnTextPresent}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.counterValuePresent}>{counts.present}</Text>
                    <TouchableOpacity 
                      style={styles.counterBtnPresent} 
                      onPress={() => updateCount(subject, 'present', 1)}
                    >
                      <Text style={styles.counterBtnTextPresent}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Absent Counter */}
                <View style={styles.counterCol}>
                  <Text style={styles.counterLabel}>Absent</Text>
                  <View style={styles.counterBoxAbsent}>
                    <TouchableOpacity 
                      style={styles.counterBtnAbsent} 
                      onPress={() => updateCount(subject, 'absent', -1)}
                    >
                      <Text style={styles.counterBtnTextAbsent}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.counterValueAbsent}>{counts.absent}</Text>
                    <TouchableOpacity 
                      style={styles.counterBtnAbsent} 
                      onPress={() => updateCount(subject, 'absent', 1)}
                    >
                      <Text style={styles.counterBtnTextAbsent}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
