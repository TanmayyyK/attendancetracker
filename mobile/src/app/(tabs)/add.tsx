import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, useColorScheme, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { createAttendanceEntry } from '../../api';

export default function AddLog() {
  const [subject, setSubject] = useState('');
  const [professor, setProfessor] = useState('');
  const [status, setStatus] = useState<"Present" | "Absent" | null>(null);
  const [loading, setLoading] = useState(false);

  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const handleSubmit = async () => {
    if (!subject.trim() || !status) {
      Alert.alert('Error', 'Subject and Status are required');
      return;
    }
    
    setLoading(true);
    const success = await createAttendanceEntry({
      date: new Date().toISOString().split('T')[0],
      subject: subject.trim(),
      professor: professor.trim() || 'Unknown',
      status
    });
    setLoading(false);

    if (success) {
      Alert.alert('Success', 'Attendance logged successfully');
      setSubject('');
      setProfessor('');
      setStatus(null);
    } else {
      Alert.alert('Error', 'Failed to log attendance. Please try again.');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#020617' : '#f8fafc',
    },
    scrollContent: {
      padding: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 32,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#e2e8f0' : '#334155',
      marginBottom: 8,
    },
    input: {
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      borderWidth: 1,
      borderColor: isDark ? '#1e293b' : '#e2e8f0',
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 24,
    },
    statusContainer: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 40,
    },
    statusButton: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: isDark ? '#1e293b' : '#e2e8f0',
      alignItems: 'center',
    },
    statusButtonActivePresent: {
      borderColor: '#22c55e',
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#dcfce7',
    },
    statusButtonActiveAbsent: {
      borderColor: '#ef4444',
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2',
    },
    statusText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#94a3b8' : '#64748b',
    },
    statusTextActivePresent: {
      color: '#22c55e',
    },
    statusTextActiveAbsent: {
      color: '#ef4444',
    },
    submitButton: {
      backgroundColor: isDark ? '#3b82f6' : '#2563eb',
      padding: 18,
      borderRadius: 12,
      alignItems: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitText: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: 'bold',
    },
  });

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>New Entry</Text>
        
        <Text style={styles.label}>Subject Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Mathematics"
          placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
          value={subject}
          onChangeText={setSubject}
        />


        <Text style={styles.label}>Status</Text>
        <View style={styles.statusContainer}>
          <TouchableOpacity 
            style={[
              styles.statusButton, 
              status === 'Present' && styles.statusButtonActivePresent
            ]}
            onPress={() => setStatus('Present')}
          >
            <Text style={[styles.statusText, status === 'Present' && styles.statusTextActivePresent]}>
              Present
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.statusButton, 
              status === 'Absent' && styles.statusButtonActiveAbsent
            ]}
            onPress={() => setStatus('Absent')}
          >
            <Text style={[styles.statusText, status === 'Absent' && styles.statusTextActiveAbsent]}>
              Absent
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitText}>Save Record</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
