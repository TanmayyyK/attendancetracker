import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, useColorScheme } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { getAttendanceLogs, deleteAttendanceLog } from '../../api';

export default function Logs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const fetchLogs = async () => {
    const data = await getAttendanceLogs();
    setLogs(data);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleDelete = (id: number) => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const success = await deleteAttendanceLog(id);
          if (success) {
            setLogs(logs.filter(log => log.id !== id));
          } else {
            Alert.alert('Error', 'Failed to delete record.');
          }
        },
      },
    ]);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#020617' : '#f8fafc',
    },
    listContent: {
      padding: 16,
    },
    logCard: {
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 3,
    },
    logDetails: {
      flex: 1,
    },
    subjectText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 4,
    },
    metaText: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : '#64748b',
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      marginRight: 12,
    },
    statusPresent: {
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#dcfce7',
    },
    statusAbsent: {
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2',
    },
    statusText: {
      fontSize: 12,
      fontWeight: 'bold',
    },
    statusTextPresent: {
      color: '#22c55e',
    },
    statusTextAbsent: {
      color: '#ef4444',
    },
    deleteBtn: {
      padding: 8,
    },
  });

  const renderItem = ({ item }: { item: any }) => {
    const isPresent = item.status === 'Present';
    return (
      <View style={styles.logCard}>
        <View style={styles.logDetails}>
          <Text style={styles.subjectText}>{item.subject}</Text>
          <Text style={styles.metaText}>
            {new Date(item.date).toLocaleDateString()}
          </Text>
        </View>
        <View style={[styles.statusBadge, isPresent ? styles.statusPresent : styles.statusAbsent]}>
          <Text style={[styles.statusText, isPresent ? styles.statusTextPresent : styles.statusTextAbsent]}>
            {item.status}
          </Text>
        </View>
        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
          <Trash2 size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#f8fafc' : '#0f172a'} />}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: isDark ? '#94a3b8' : '#64748b' }}>No logs found.</Text>}
      />
    </View>
  );
}
