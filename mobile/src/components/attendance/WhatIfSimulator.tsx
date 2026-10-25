/**
 * What-If Attendance Simulator Component
 *
 * Provides a dedicated, per-subject what-if sandbox:
 * 1. Select a subject from canonical and custom subjects.
 * 2. Displays the subject's current baseline attendance and active target.
 * 3. Stepper controls to add hypothetical future attended and missed classes.
 * 4. Displays real-time projected percentage, status (target met vs below target), and narrative.
 * 5. Clearly labeled as hypothetical: never mutates stored records or target settings.
 */

import { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Minus, Plus, RotateCcw, Info, TrendingUp, TrendingDown } from 'lucide-react-native';

import { radius, space, type, ICON_STROKE } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { Card, AppText, ProgressRing, Button } from '@/components/ui';
import type { SubjectIntelligenceItem } from '@/types/attendanceIntelligence';
import {
  calculateSimulatorProjection,
  resolveDeltaBadgeDisplay,
  type SimulatorProjectionModel,
} from '@/utils/simulatorPolicy';

export interface WhatIfSimulatorProps {
  subjects: SubjectIntelligenceItem[];
}

export function WhatIfSimulator({ subjects }: WhatIfSimulatorProps) {
  const { colors } = useTheme();

  // Selected subject name (defaults to first subject)
  const [selectedSubjectName, setSelectedSubjectName] = useState<string | null>(
    subjects.length > 0 ? subjects[0].subject : null
  );

  // Hypothetical future class adjustments (strictly local state)
  const [hypotheticalAttended, setHypotheticalAttended] = useState<number>(0);
  const [hypotheticalMissed, setHypotheticalMissed] = useState<number>(0);

  if (subjects.length === 0) {
    return null;
  }

  const selectedSubject =
    subjects.find((s) => s.subject === selectedSubjectName) ?? subjects[0];

  const handleSelectSubject = (subjectName: string) => {
    if (subjectName !== selectedSubject.subject) {
      setSelectedSubjectName(subjectName);
      setHypotheticalAttended(0);
      setHypotheticalMissed(0);
    }
  };

  const handleReset = () => {
    setHypotheticalAttended(0);
    setHypotheticalMissed(0);
  };

  const projection: SimulatorProjectionModel = calculateSimulatorProjection({
    subject: selectedSubject,
    hypotheticalAttended,
    hypotheticalMissed,
  });

  const toneConfig = {
    neutral: { color: colors.textMuted, bg: colors.surfaceElevated },
    success: { color: colors.success, bg: colors.successSubtle },
    warning: { color: colors.warning, bg: colors.warningSubtle },
    danger: { color: colors.danger, bg: colors.dangerSubtle },
  }[projection.statusTone];

  const hasAdjustments = hypotheticalAttended > 0 || hypotheticalMissed > 0;

  const deltaDisplay = resolveDeltaBadgeDisplay({
    hasAdjustments,
    percentageDelta: projection.percentageDelta,
  });

  return (
    <Card padding={space.lg} style={styles.cardContainer}>
      {/* 1. Subject Selector Chips */}
      <View style={styles.headerRow}>
        <AppText variant="eyebrow" tone="muted">
          Select Subject
        </AppText>
        <AppText variant="bodySm" tone="secondary">
          Target: {selectedSubject.target}%
        </AppText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.subjectChipsRow}
      >
        {subjects.map((item) => {
          const isSelected = item.subject === selectedSubject.subject;
          return (
            <Pressable
              key={item.subject}
              onPress={() => handleSelectSubject(item.subject)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? colors.accent : colors.surfaceElevated,
                  borderColor: isSelected ? colors.accent : colors.hairline,
                },
              ]}
            >
              <AppText
                style={[
                  type.bodySmMedium,
                  { color: isSelected ? colors.accentOn : colors.textPrimary },
                ]}
              >
                {item.subject}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 2. Baseline Stats */}
      <View style={[styles.baselineBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.hairline }]}>
        <View style={styles.baselineItem}>
          <AppText variant="eyebrow" tone="muted">
            Current Baseline
          </AppText>
          <AppText style={[type.bodyMedium, { color: colors.textPrimary, marginTop: 2 }]}>
            {selectedSubject.hasData && selectedSubject.percentage !== null
              ? `${selectedSubject.present} / ${selectedSubject.total} classes (${selectedSubject.percentage.toFixed(1)}%)`
              : 'No classes logged yet'}
          </AppText>
        </View>
        {selectedSubject.isCustomTarget && (
          <View style={[styles.customTag, { borderColor: colors.accentBorder, backgroundColor: colors.accentSubtle }]}>
            <AppText style={[type.bodySmMedium, { color: colors.accent, fontSize: 11 }]}>
              Custom Goal
            </AppText>
          </View>
        )}
      </View>

      {/* 3. Hypothetical Controls */}
      <View style={styles.controlsSection}>
        <AppText variant="eyebrow" tone="muted">
          Simulate Upcoming Classes
        </AppText>

        <View style={styles.steppersContainer}>
          {/* Attend Future Classes */}
          <View style={[styles.stepperBox, { borderColor: colors.hairline, backgroundColor: colors.surfaceElevated }]}>
            <View style={styles.stepperLabelWrap}>
              <AppText variant="bodySmMedium" tone="primary">
                Attend classes
              </AppText>
              <AppText variant="bodySm" tone="secondary">
                Hypothetical
              </AppText>
            </View>

            <View style={styles.stepperActions}>
              <Pressable
                onPress={() => setHypotheticalAttended((prev) => Math.max(0, prev - 1))}
                disabled={hypotheticalAttended === 0}
                hitSlop={8}
                style={[styles.stepperBtn, hypotheticalAttended === 0 && styles.disabledBtn]}
                accessibilityRole="button"
                accessibilityLabel="Decrease hypothetical attended classes"
              >
                <Minus size={18} color={hypotheticalAttended === 0 ? colors.textFaint : colors.textPrimary} strokeWidth={ICON_STROKE} />
              </Pressable>

              <View style={styles.stepperValue}>
                <AppText style={[type.metricMd, { color: colors.success }]}>
                  +{hypotheticalAttended}
                </AppText>
              </View>

              <Pressable
                onPress={() => setHypotheticalAttended((prev) => prev + 1)}
                hitSlop={8}
                style={styles.stepperBtn}
                accessibilityRole="button"
                accessibilityLabel="Increase hypothetical attended classes"
              >
                <Plus size={18} color={colors.textPrimary} strokeWidth={ICON_STROKE} />
              </Pressable>
            </View>
          </View>

          {/* Miss Future Classes */}
          <View style={[styles.stepperBox, { borderColor: colors.hairline, backgroundColor: colors.surfaceElevated }]}>
            <View style={styles.stepperLabelWrap}>
              <AppText variant="bodySmMedium" tone="primary">
                Miss classes
              </AppText>
              <AppText variant="bodySm" tone="secondary">
                Hypothetical
              </AppText>
            </View>

            <View style={styles.stepperActions}>
              <Pressable
                onPress={() => setHypotheticalMissed((prev) => Math.max(0, prev - 1))}
                disabled={hypotheticalMissed === 0}
                hitSlop={8}
                style={[styles.stepperBtn, hypotheticalMissed === 0 && styles.disabledBtn]}
                accessibilityRole="button"
                accessibilityLabel="Decrease hypothetical missed classes"
              >
                <Minus size={18} color={hypotheticalMissed === 0 ? colors.textFaint : colors.textPrimary} strokeWidth={ICON_STROKE} />
              </Pressable>

              <View style={styles.stepperValue}>
                <AppText style={[type.metricMd, { color: colors.danger }]}>
                  +{hypotheticalMissed}
                </AppText>
              </View>

              <Pressable
                onPress={() => setHypotheticalMissed((prev) => prev + 1)}
                hitSlop={8}
                style={styles.stepperBtn}
                accessibilityRole="button"
                accessibilityLabel="Increase hypothetical missed classes"
              >
                <Plus size={18} color={colors.textPrimary} strokeWidth={ICON_STROKE} />
              </Pressable>
            </View>
          </View>
        </View>

        {hasAdjustments && (
          <Button
            title="Reset simulation"
            variant="ghost"
            size="md"
            icon={<RotateCcw size={16} color={colors.accent} strokeWidth={ICON_STROKE} />}
            onPress={handleReset}
            style={styles.resetButton}
          />
        )}
      </View>

      {/* 4. Projected Outcome Display */}
      <View style={[styles.projectionCard, { borderColor: colors.hairline, backgroundColor: colors.surfaceElevated }]}>
        <View style={styles.projectionHeader}>
          <View style={styles.projectionLeft}>
            <AppText variant="eyebrow" tone="muted">
              Projected Attendance
            </AppText>
            <View style={styles.metricRow}>
              <AppText style={[type.metricLg, { color: colors.textPrimary }]}>
                {projection.projectedPercentage !== null
                  ? `${projection.projectedPercentage.toFixed(1)}%`
                  : '--%'}
              </AppText>

              {deltaDisplay.shouldShow && (
                <View
                  style={[
                    styles.deltaBadge,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.hairline,
                    },
                  ]}
                >
                  {deltaDisplay.direction === 'up' && (
                    <TrendingUp size={14} color={colors.success} strokeWidth={ICON_STROKE} />
                  )}
                  {deltaDisplay.direction === 'down' && (
                    <TrendingDown size={14} color={colors.danger} strokeWidth={ICON_STROKE} />
                  )}
                  <AppText
                    style={[
                      type.bodySmMedium,
                      {
                        color:
                          deltaDisplay.tone === 'success'
                            ? colors.success
                            : deltaDisplay.tone === 'danger'
                            ? colors.danger
                            : colors.textMuted,
                        marginLeft: deltaDisplay.direction !== 'none' ? 4 : 0,
                      },
                    ]}
                  >
                    {deltaDisplay.text}
                  </AppText>
                </View>
              )}
            </View>
            <AppText style={[type.mono, { color: colors.textMuted, marginTop: 2 }]}>
              {projection.projectedAttended} / {projection.projectedTotal} total classes
            </AppText>
          </View>

          <View style={styles.ringContainer}>
            <ProgressRing
              percentage={projection.projectedPercentage}
              size={56}
              strokeWidth={5}
            />
          </View>
        </View>

        {/* Status Pill */}
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: toneConfig.bg, borderColor: colors.hairline },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: toneConfig.color }]} />
            <AppText style={[type.bodySmMedium, { color: toneConfig.color }]}>
              {projection.statusLabel}
            </AppText>
          </View>
        </View>

        {/* Narrative Explanation */}
        <AppText variant="bodySm" tone="secondary" style={styles.explanationText}>
          {projection.explanation}
        </AppText>
      </View>

      {/* 5. Hypothetical Disclaimer */}
      <View style={styles.disclaimerBox}>
        <Info size={14} color={colors.textMuted} strokeWidth={ICON_STROKE} style={styles.disclaimerIcon} />
        <AppText style={[styles.disclaimerText, { color: colors.textMuted }]}>
          Hypothetical projection only. Changing counts does not log classes or modify your saved target.
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    gap: space.md,
    marginBottom: space.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectChipsRow: {
    gap: space.sm,
    paddingVertical: space.xs,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  baselineBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.sm,
    flexWrap: 'wrap',
  },
  baselineItem: {
    flex: 1,
  },
  customTag: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  controlsSection: {
    gap: space.sm,
  },
  steppersContainer: {
    gap: space.sm,
  },
  stepperBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.sm,
  },
  stepperLabelWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  stepperActions: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.35,
  },
  stepperValue: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButton: {
    alignSelf: 'flex-start',
    marginTop: space.xs,
  },
  projectionCard: {
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.sm,
  },
  projectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  projectionLeft: {
    flex: 1,
    minWidth: 0,
  },
  ringContainer: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: space.sm,
    rowGap: space.xs,
    marginTop: space.xs,
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
  },
  explanationText: {
    lineHeight: 20,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingHorizontal: space.xs,
  },
  disclaimerIcon: {
    marginTop: 2,
  },
  disclaimerText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
});
