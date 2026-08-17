import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert, useColorScheme } from 'react-native';
import { Trash2, Download, SearchX } from 'lucide-react-native';
import { getAttendanceLogs, deleteAttendanceLog } from '../../api';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

import { GlassCard } from '../../components/ui/GlassCard';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { StatusPill } from '../../components/ui/StatusPill';
import { AnimatedPressable } from '../../components/animations/AnimatedPressable';
import { FadeInSlide } from '../../components/animations/FadeInSlide';
import { StaggeredList } from '../../components/animations/StaggeredList';
import { ShimmerCard } from '../../components/animations/ShimmerPlaceholder';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeOutRight, Layout } from 'react-native-reanimated';

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Entry', 'Are you sure you want to delete this record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const success = await deleteAttendanceLog(id);
          if (success) {
            setLogs(logs.filter(log => log.id !== id));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            Alert.alert('Error', 'Failed to delete record.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
    listContent: {
      padding: 16,
      paddingTop: 20,
      paddingBottom: 120,
    },
    logDetails: {
      flex: 1,
    },
    subjectText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: isDark ? '#F8FAFC' : '#0F172A',
      marginBottom: 4,
    },
    metaText: {
      fontSize: 14,
      color: isDark ? '#94A3B8' : '#64748B',
    },
    deleteBtn: {
      padding: 10,
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      borderRadius: 12,
      marginLeft: 12,
    },
    exportBtnContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
    },
    exportBtnText: {
      color: isDark ? '#F8FAFC' : '#0F172A',
      fontSize: 16,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    leftBorder: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 60,
    },
    emptyText: {
      fontSize: 16,
      color: isDark ? '#94A3B8' : '#64748B',
      marginTop: 12,
    }
  });

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    return (
      <Animated.View
        entering={FadeInDown.delay(index * 40).springify()}
        exiting={FadeOutRight}
        layout={Layout.springify()}
        style={{ marginBottom: 12 }}
      >
        <GlassCard animated={false} style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.logDetails}>
              <Text style={styles.subjectText}>{item.subject}</Text>
              <Text style={styles.metaText}>
                {new Date(item.date).toLocaleDateString()}
              </Text>
            </View>
            
            <StatusPill status={item.status} />
            
            <AnimatedPressable onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
              <Trash2 size={18} color="#ef4444" />
            </AnimatedPressable>
          </View>
        </GlassCard>
      </Animated.View>
    );
  };

  const renderEmpty = () => (
    <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.emptyContainer}>
      <SearchX size={48} color={isDark ? '#94A3B8' : '#64748B'} strokeWidth={1.5} />
      <Text style={styles.emptyText}>No logs found.</Text>
    </Animated.View>
  );

  return (
    <GradientBackground>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={isDark ? '#10b981' : '#059669'} 
            colors={[isDark ? '#10b981' : '#059669']} 
          />
        }
        ListHeaderComponent={
          <FadeInSlide delay={0} style={{ marginBottom: 16 }}>
            <AnimatedPressable onPress={handleExport}>
              <GlassCard animated={false} style={{ padding: 0, overflow: 'hidden' }}>
                <LinearGradient
                  colors={['#10b981', '#34d399']}
                  style={styles.leftBorder}
                />
                <View style={styles.exportBtnContent}>
                  <Download size={20} color={isDark ? '#F8FAFC' : '#0F172A'} />
                  <Text style={styles.exportBtnText}>Export Last 20</Text>
                </View>
              </GlassCard>
            </AnimatedPressable>
          </FadeInSlide>
        }
        ListEmptyComponent={renderEmpty}
      />
    </GradientBackground>
  );
}
