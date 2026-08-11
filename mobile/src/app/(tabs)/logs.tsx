import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, useColorScheme } from 'react-native';
import { Trash2, Download } from 'lucide-react-native';
import { getAttendanceLogs, deleteAttendanceLog } from '../../api';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

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

  const handleExport = async () => {
    try {
      const filteredLogs = logs.slice(0, 20);

      if (filteredLogs.length === 0) {
        Alert.alert('No Data', 'No logs found to export.');
        return;
      }

      const wsData = filteredLogs.map(log => ({
        Date: log.date,
        Time: log.timestamp,
        Subject: log.subject,
        Status: log.status,
      }));

      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Last 20 Logs');

      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      const fileUri = FileSystem.documentDirectory + 'Attendance_Last_20.xlsx';
      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Download Last 20 Attendance Logs',
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to generate Excel file.');
    }
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
    exportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#10b981', // emerald-500
      paddingVertical: 12,
      borderRadius: 12,
      marginBottom: 16,
      shadowColor: '#10b981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    exportBtnText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: 'bold',
      marginLeft: 8,
    }
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#f8fafc' : '#0f172a'} colors={[isDark ? '#f8fafc' : '#0f172a']} progressBackgroundColor={isDark ? '#0f172a' : '#ffffff'} />}
        ListHeaderComponent={
          <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
            <Download size={20} color="#ffffff" />
            <Text style={styles.exportBtnText}>Download Last 20 (Excel)</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: isDark ? '#94a3b8' : '#64748b' }}>No logs found.</Text>}
      />
    </View>
  );
}
