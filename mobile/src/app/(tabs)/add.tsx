import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { GUTTER, layout, space, radius, type } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Screen, Card, Button, Stepper, BottomSheet, SectionHeader, AppText } from '@/components/ui';
import { FadeInSlide } from '@/components/animations/FadeInSlide';
import { StaggeredList } from '@/components/animations/StaggeredList';
import { createBulkAttendance } from '@/api';

const SUBJECTS = [
  'Physiology',
  'Anatomy',
  'Samhita',
  'Padarth Vigyan',
  'Sanskrit (CM Sir)',
] as const;

type CountRow = { present: number; absent: number; absent_reasons: string[] };

const GHOST_REASONS = ['Sleeping', 'Sick', 'Not Available', 'Not in Mood'];

export default function AddLog() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

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

  const filledSubjects = useMemo(
    () => Object.values(subjectCounts).filter((c) => c.present + c.absent > 0).length,
    [subjectCounts]
  );

  const updateCount = (subject: string, kind: 'present' | 'absent', delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (kind === 'absent' && delta > 0) {
      setGhostModalActive(subject);
      return;
    }

    if (kind === 'absent' && delta < 0) {
      setSubjectCounts((prev) => {
        const row = prev[subject];
        const newAbsent = Math.max(0, row.absent - 1);
        const newReasons = [...row.absent_reasons];
        if (row.absent > 0) newReasons.pop();
        return { ...prev, [subject]: { ...row, absent: newAbsent, absent_reasons: newReasons } };
      });
      return;
    }

    setSubjectCounts((prev) => ({
      ...prev,
      [subject]: { ...prev[subject], [kind]: Math.max(0, prev[subject][kind] + delta) },
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
          absent_reasons: [...row.absent_reasons, reason],
        },
      };
    });
    setGhostModalActive(null);
  };

  const handleSave = async () => {
    if (totalRows === 0) {
      Alert.alert('Nothing to save', 'Add at least one class entry first.');
      return;
    }

    setSaving(true);
    const rows = SUBJECTS.map((subject) => ({
      date,
      mode: 'subject',
      subject,
      present: subjectCounts[subject].present,
      absent: subjectCounts[subject].absent,
      absent_reasons: subjectCounts[subject].absent_reasons,
    })).filter((r) => r.present + r.absent > 0);

    const result = await createBulkAttendance(rows);
    setSaving(false);

    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', `${result.inserted} entries recorded.`);
      setSubjectCounts(Object.fromEntries(SUBJECTS.map((s) => [s, { present: 0, absent: 0, absent_reasons: [] }])));
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Could not save', 'The entries failed to save. Check your connection and try again.');
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <FadeInSlide>
            <View style={styles.header}>
              <AppText variant="h1">Daily entry</AppText>
              <AppText variant="bodySm" tone="secondary" style={styles.subtitle}>
                Tally present and absent classes for each subject.
              </AppText>
            </View>
          </FadeInSlide>

          <FadeInSlide delay={70}>
            <Card padding={space.lg} style={styles.dateCard}>
              <AppText variant="eyebrow" tone="muted">
                Date
              </AppText>
              <TextInput
                style={[type.metricMd, styles.dateInput, { color: colors.textPrimary }]}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Card>
          </FadeInSlide>

          <View style={styles.sectionHeader}>
            <FadeInSlide delay={130}>
              <SectionHeader eyebrow="Per subject" title="Subjects" />
            </FadeInSlide>
          </View>

          <StaggeredList staggerDelay={55}>
            {SUBJECTS.map((subject) => {
              const counts = subjectCounts[subject];
              const touched = counts.present + counts.absent > 0;
              return (
                <Card key={subject} style={styles.subjectCard} accentColor={touched ? colors.accent : undefined}>
                  <View style={styles.subjectHeaderRow}>
                    <AppText variant="bodyMedium" numberOfLines={1} style={styles.subjectName}>
                      {subject}
                    </AppText>
                    {touched ? (
                      <AppText style={[type.mono, { color: colors.textMuted }]}>
                        {counts.present + counts.absent}
                      </AppText>
                    ) : null}
                  </View>

                  <View style={styles.stepperGrid}>
                    <View style={styles.stepperCol}>
                      <AppText variant="eyebrow" tone="muted" style={styles.stepperLabel}>
                        Present
                      </AppText>
                      <Stepper
                        tone="success"
                        value={counts.present}
                        onIncrement={() => updateCount(subject, 'present', 1)}
                        onDecrement={() => updateCount(subject, 'present', -1)}
                      />
                    </View>
                    <View style={styles.stepperCol}>
                      <AppText variant="eyebrow" tone="muted" style={styles.stepperLabel}>
                        Absent
                      </AppText>
                      <Stepper
                        tone="danger"
                        value={counts.absent}
                        onIncrement={() => updateCount(subject, 'absent', 1)}
                        onDecrement={() => updateCount(subject, 'absent', -1)}
                      />
                    </View>
                  </View>

                  {counts.absent_reasons.length > 0 ? (
                    <View style={[styles.reasonsWrap, { borderTopColor: colors.hairline }]}>
                      {counts.absent_reasons.map((r, i) => (
                        <View
                          key={`${r}-${i}`}
                          style={[styles.reasonChip, { backgroundColor: colors.dangerSubtle, borderColor: colors.hairline }]}
                        >
                          <AppText style={[type.bodySmMedium, { color: colors.danger }]}>{r}</AppText>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </StaggeredList>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { backgroundColor: colors.canvas, borderTopColor: colors.hairline, paddingBottom: Math.max(insets.bottom, space.md) },
          ]}
        >
          <View style={styles.footerMeta}>
            <AppText variant="bodySmMedium" tone={filledSubjects > 0 ? 'primary' : 'muted'}>
              {filledSubjects} of {SUBJECTS.length} subjects
            </AppText>
            <AppText style={[type.mono, { color: colors.textMuted }]}>{totalRows} classes</AppText>
          </View>
          <Button
            title={totalRows > 0 ? `Save ${totalRows} ${totalRows === 1 ? 'entry' : 'entries'}` : 'Save entries'}
            onPress={handleSave}
            loading={saving}
            disabled={totalRows === 0}
          />
        </View>
      </KeyboardAvoidingView>

      <BottomSheet
        visible={!!ghostModalActive}
        onClose={() => setGhostModalActive(null)}
        title="Why the bunk?"
        subtitle={ghostModalActive ? `Logging an absence in ${ghostModalActive}.` : undefined}
      >
        <View style={styles.reasonGrid}>
          {GHOST_REASONS.map((reason) => (
            <Pressable
              key={reason}
              onPress={() => logGhostAbsent(reason)}
              style={({ pressed }) => [
                styles.reasonTile,
                {
                  backgroundColor: pressed ? colors.dangerSubtle : colors.surface,
                  borderColor: colors.hairlineStrong,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={reason}
            >
              <AppText variant="bodyMedium" tone="danger">
                {reason}
              </AppText>
            </Pressable>
          ))}
        </View>
        <Button title="Cancel" variant="ghost" onPress={() => setGhostModalActive(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: space.md, paddingBottom: layout.stickyCtaClearance },
  header: { marginBottom: space.xl },
  subtitle: { marginTop: space.xs },
  dateCard: { marginBottom: space.xxl, gap: space.sm },
  dateInput: { padding: 0, letterSpacing: 1 },
  sectionHeader: { marginBottom: space.lg },
  subjectCard: { marginBottom: space.md },
  subjectHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  subjectName: { flex: 1, marginRight: space.md },
  stepperGrid: { flexDirection: 'row', gap: space.md },
  stepperCol: { flex: 1, gap: space.sm },
  stepperLabel: { textAlign: 'center' },
  reasonsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg, paddingTop: space.lg, borderTopWidth: 1 },
  reasonChip: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, borderWidth: 1 },
  footer: { paddingHorizontal: GUTTER, paddingTop: space.md, borderTopWidth: 1, gap: space.md },
  footerMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: space.md },
  reasonTile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
});
