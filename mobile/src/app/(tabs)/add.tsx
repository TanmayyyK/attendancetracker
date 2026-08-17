import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Modal, Pressable } from 'react-native';
import { createBulkAttendance } from '../../api';

import { GlassCard } from '../../components/ui/GlassCard';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { AnimatedPressable } from '../../components/animations/AnimatedPressable';
import { FadeInSlide } from '../../components/animations/FadeInSlide';
import { StaggeredList } from '../../components/animations/StaggeredList';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, FadeInDown } from 'react-native-reanimated';
import { useColorScheme } from 'react-native';

const SUBJECTS = [
  "Physiology",
  "Anatomy",
  "Samhita",
  "Padarth Vigyan",
  "Sanskrit (CM Sir)"
] as const;

type CountRow = { present: number; absent: number; absent_reasons: string[] };

const GHOST_REASONS = ["Sleeping", "Sick", "Not Available", "Not in Mood"];

const AnimatedCounterValue = ({ value, color }: { value: number; color: string }) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(1.2, { damping: 12, stiffness: 150 }, () => {
      scale.value = withSpring(1);
    });
  }, [value, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Text style={[styles.counterValue, { color }, style]}>
      {value}
    </Animated.Text>
  );
};

export default function AddLog() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const mutedColor = isDark ? '#94A3B8' : '#64748B';

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  
  const [subjectCounts, setSubjectCounts] = useState<Record<string, CountRow>>(
    Object.fromEntries(SUBJECTS.map((s) => [s, { present: 0, absent: 0, absent_reasons: [] }]))
  );
  const [ghostModalActive, setGhostModalActive] = useState<string | null>(null);

  const totalRows = useMemo(
    () => Object.values(subjectCounts).reduce((acc, cur) => acc + cur.present + cur.absent, 0),
    [subjectCounts]
  );

  const filledSubjects = useMemo(() => {
    return Object.values(subjectCounts).filter(c => c.present + c.absent > 0).length;
  }, [subjectCounts]);

  const updateCount = (subject: string, type: 'present' | 'absent', delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (type === 'absent' && delta > 0) {
      setGhostModalActive(subject);
      return;
    }
    
    if (type === 'absent' && delta < 0) {
      setSubjectCounts((prev) => {
        const row = prev[subject];
        const newAbsent = Math.max(0, row.absent - 1);
        const newReasons = [...row.absent_reasons];
        if (row.absent > 0) newReasons.pop();
        return {
          ...prev,
          [subject]: { ...row, absent: newAbsent, absent_reasons: newReasons }
        };
      });
      return;
    }

    setSubjectCounts((prev) => ({
      ...prev,
      [subject]: { ...prev[subject], [type]: Math.max(0, prev[subject][type] + delta) }
    }));
  };

  const logGhostAbsent = (reason: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!ghostModalActive) return;
    setSubjectCounts((prev) => {
      const row = prev[ghostModalActive];
      return {
        ...prev,
        [ghostModalActive]: {
          ...row,
          absent: row.absent + 1,
          absent_reasons: [...row.absent_reasons, reason]
        }
      };
    });
    setGhostModalActive(null);
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
      absent: subjectCounts[subject].absent,
      absent_reasons: subjectCounts[subject].absent_reasons
    })).filter((r) => r.present + r.absent > 0);

    const result = await createBulkAttendance(rows);
    setSaving(false);

    if (result.ok) {
      Alert.alert('Success', `Saved ${result.inserted} entries successfully.`);
      setSubjectCounts(Object.fromEntries(SUBJECTS.map((s) => [s, { present: 0, absent: 0, absent_reasons: [] }])));
    } else {
      Alert.alert('Error', 'Failed to save entries. Check backend.');
    }
  };

  return (
    <GradientBackground>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: 20 }]} showsVerticalScrollIndicator={false}>
          
          <FadeInSlide>
            <View style={styles.header}>
              <Text style={[styles.title, { color: textColor }]}>Daily Entry</Text>
              <Text style={[styles.subtitle, { color: mutedColor }]}>Log attendance for each subject</Text>
            </View>
          </FadeInSlide>

          <FadeInSlide delay={100}>
            <GlassCard style={styles.dateCard}>
              <TextInput
                style={[styles.dateInput, { color: textColor }]}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={mutedColor}
              />
            </GlassCard>
          </FadeInSlide>

          <View style={styles.listContainer}>
            <StaggeredList>
              {SUBJECTS.map((subject, index) => {
                const counts = subjectCounts[subject];
                return (
                  <GlassCard key={subject} style={styles.subjectCard}>
                    <View style={styles.subjectHeader}>
                      <View style={styles.iconBox}>
                        <Text style={styles.iconText}>{subject[0]}</Text>
                      </View>
                      <Text style={[styles.subjectTitle, { color: textColor }]}>{subject}</Text>
                    </View>

                    <View style={styles.counterGrid}>
                      {/* Present */}
                      <View style={styles.counterCol}>
                        <Text style={[styles.counterLabel, { color: mutedColor }]}>Present</Text>
                        <View style={styles.presentBg}>
                          <AnimatedPressable onPress={() => updateCount(subject, 'present', -1)} style={styles.counterBtn}>
                            <Text style={styles.btnTextPresent}>−</Text>
                          </AnimatedPressable>
                          
                          <View style={styles.valueContainer}>
                             <AnimatedCounterValue value={counts.present} color="#22C55E" />
                          </View>

                          <AnimatedPressable onPress={() => updateCount(subject, 'present', 1)} style={styles.counterBtn}>
                            <Text style={styles.btnTextPresent}>+</Text>
                          </AnimatedPressable>
                        </View>
                      </View>

                      {/* Absent */}
                      <View style={styles.counterCol}>
                        <Text style={[styles.counterLabel, { color: mutedColor }]}>Absent</Text>
                        <View style={styles.absentBg}>
                          <AnimatedPressable onPress={() => updateCount(subject, 'absent', -1)} style={styles.counterBtn}>
                            <Text style={styles.btnTextAbsent}>−</Text>
                          </AnimatedPressable>
                          
                          <View style={styles.valueContainer}>
                             <AnimatedCounterValue value={counts.absent} color="#EF4444" />
                          </View>

                          <AnimatedPressable onPress={() => updateCount(subject, 'absent', 1)} style={styles.counterBtn}>
                            <Text style={styles.btnTextAbsent}>+</Text>
                          </AnimatedPressable>
                        </View>
                        {counts.absent_reasons.length > 0 && (
                          <View style={{ marginTop: 8, gap: 4 }}>
                            {counts.absent_reasons.map((r, i) => (
                              <View key={i} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                                <Text style={{ fontSize: 10, color: '#EF4444', textAlign: 'center' }}>{r}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  </GlassCard>
                );
              })}
            </StaggeredList>
          </View>

          <FadeInSlide delay={300}>
            <AnimatedPressable 
              onPress={handleSave} 
              disabled={saving || totalRows === 0}
            >
              <LinearGradient
                colors={['#7C3AED', '#6D28D9']}
                style={[styles.saveButton, (saving || totalRows === 0) && styles.saveButtonDisabled]}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save {totalRows} Entries</Text>
                )}
              </LinearGradient>
            </AnimatedPressable>
          </FadeInSlide>

          <Animated.View entering={FadeInDown.delay(400).springify()}>
            <GlassCard style={styles.progressPill}>
              <Text style={styles.progressText}>{filledSubjects} of {SUBJECTS.length} subjects filled</Text>
            </GlassCard>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={!!ghostModalActive}
        transparent
        animationType="slide"
        onRequestClose={() => setGhostModalActive(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setGhostModalActive(null)} />
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Why did you bunk?</Text>
              <Text style={styles.modalSubtitle}>Select a reason for logging absent in {ghostModalActive}.</Text>
            </View>
            <View style={styles.ghostReasonsGrid}>
              {GHOST_REASONS.map((reason) => (
                <AnimatedPressable key={reason} onPress={() => logGhostAbsent(reason)}>
                  <LinearGradient
                    colors={['rgba(239, 68, 68, 0.1)', 'rgba(220, 38, 38, 0.05)']}
                    style={styles.ghostReasonBtn}
                  >
                    <Text style={styles.ghostReasonText}>{reason}</Text>
                  </LinearGradient>
                </AnimatedPressable>
              ))}
            </View>
            <Pressable style={styles.modalCancel} onPress={() => setGhostModalActive(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  dateCard: {
    padding: 4,
    marginBottom: 24,
    borderRadius: 16,
  },
  dateInput: {
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  listContainer: {
    marginBottom: 24,
  },
  subjectCard: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 20,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#7C3AED',
  },
  subjectTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  counterGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  counterCol: {
    flex: 1,
  },
  counterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  presentBg: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 16,
    height: 48,
    justifyContent: 'space-between',
  },
  absentBg: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 16,
    height: 48,
    justifyContent: 'space-between',
  },
  counterBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTextPresent: {
    fontSize: 22,
    fontWeight: '600',
    color: '#22C55E',
  },
  btnTextAbsent: {
    fontSize: 22,
    fontWeight: '600',
    color: '#EF4444',
  },
  valueContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  saveButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressPill: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 100,
    alignSelf: 'center',
  },
  progressText: {
    color: '#06B6D4',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#64748B',
  },
  ghostReasonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  ghostReasonBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  ghostReasonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
});
