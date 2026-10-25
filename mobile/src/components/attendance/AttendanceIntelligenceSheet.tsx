/**
 * Subject Detail & Target Intelligence Sheet
 *
 * Displays:
 * 1. Subject name and canonical/custom distinction.
 * 2. Current attended/total count and percentage (or explicit no-data state).
 * 3. Active target percentage with custom indicator.
 * 4. Required classes or safe-to-miss projections with exceptional states handled explicitly.
 * 5. Target adjustment control (60% to 95% in 1% steps).
 * 6. Reset to default 75% action when target has been customized.
 * 7. Transparent persistence error reporting when local storage fails.
 * 8. Model assumptions disclaimer (consecutive, equally weighted single classes without timetable awareness).
 */

import { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Minus, Plus, RotateCcw, AlertCircle, Info } from 'lucide-react-native';

import { radius, space, type, fonts, ICON_STROKE } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { BottomSheet, AppText, Card, Button } from '@/components/ui';
import { SubjectIntelligenceBadge } from './SubjectIntelligenceBadge';
import {
  MIN_TARGET_PERCENTAGE,
  MAX_TARGET_PERCENTAGE,
  DEFAULT_TARGET_PERCENTAGE,
  type SubjectIntelligenceItem,
} from '@/types/attendanceIntelligence';

export interface AttendanceIntelligenceSheetProps {
  visible: boolean;
  onClose: () => void;
  item: SubjectIntelligenceItem | null;
  onUpdateTarget: (subject: string, target: number) => Promise<boolean>;
  onResetTarget: (subject: string) => Promise<boolean>;
}

export function AttendanceIntelligenceSheet({
  visible,
  onClose,
  item,
  onUpdateTarget,
  onResetTarget,
}: AttendanceIntelligenceSheetProps) {
  const { colors } = useTheme();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear errors when sheet opens or active subject switches
  useEffect(() => {
    setError(null);
    setSaving(false);
  }, [item?.subject, visible]);

  if (!item) {
    return null;
  }

  const handleDecrement = async () => {
    if (saving || item.target <= MIN_TARGET_PERCENTAGE) return;
    const nextTarget = item.target - 1;

    setError(null);
    setSaving(true);
    try {
      const ok = await onUpdateTarget(item.subject, nextTarget);
      if (!ok) {
        setError(`Failed to save ${nextTarget}% target to local storage.`);
      }
    } catch {
      setError('An unexpected error occurred while saving target.');
    } finally {
      setSaving(false);
    }
  };

  const handleIncrement = async () => {
    if (saving || item.target >= MAX_TARGET_PERCENTAGE) return;
    const nextTarget = item.target + 1;

    setError(null);
    setSaving(true);
    try {
      const ok = await onUpdateTarget(item.subject, nextTarget);
      if (!ok) {
        setError(`Failed to save ${nextTarget}% target to local storage.`);
      }
    } catch {
      setError('An unexpected error occurred while saving target.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (saving || !item.isCustomTarget) return;

    setError(null);
    setSaving(true);
    try {
      const ok = await onResetTarget(item.subject);
      if (!ok) {
        setError('Failed to reset target in local storage.');
      }
    } catch {
      setError('An unexpected error occurred while resetting target.');
    } finally {
      setSaving(false);
    }
  };

  // Determine projection narrative
  let projectionText = '';
  if (!item.hasData || item.currentStatus === 'no_data') {
    projectionText = 'No attendance recorded yet. Projections will automatically calculate as classes are logged.';
  } else if (item.currentStatus === 'invalid_input') {
    projectionText = 'Attendance counts for this subject contain invalid or conflicting numbers.';
  } else if (item.currentStatus === 'target_met') {
    const safe = item.projections.safeToMiss;
    if (safe.status === 'can_miss') {
      if (safe.safeToMiss > 0) {
        projectionText = safe.explanation;
      } else {
        projectionText = `On target boundary. You cannot miss any upcoming classes without falling below ${item.target}%.`;
      }
    } else if (safe.status === 'unlimited') {
      projectionText = 'Target is 0%. All upcoming classes can be missed without dropping below target.';
    } else if (safe.status === 'overflow') {
      projectionText = 'Safe-to-miss count exceeds safe calculation limits.';
    } else {
      projectionText = `Current attendance meets the ${item.target}% target.`;
    }
  } else if (item.currentStatus === 'below_target') {
    const req = item.projections.requiredToTarget;
    if (req.status === 'achievable') {
      projectionText = req.explanation;
    } else if (req.status === 'unreachable') {
      projectionText = `Mathematically unreachable: even attending 100% of future classes cannot bring total attendance up to ${item.target}%.`;
    } else if (req.status === 'overflow') {
      projectionText = 'Required class count exceeds safe calculation limits.';
    } else {
      projectionText = `Current attendance is below the ${item.target}% target.`;
    }
  }

  const isAtMin = item.target <= MIN_TARGET_PERCENTAGE;
  const isAtMax = item.target >= MAX_TARGET_PERCENTAGE;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={item.subject}
      subtitle={item.isCanonical ? 'Canonical curriculum subject' : 'Custom subject'}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        {/* Current Attendance Summary */}
        <Card padding={space.lg} style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <AppText variant="eyebrow" tone="muted">
                Current Attendance
              </AppText>
              {item.hasData && item.percentage !== null ? (
                <View style={styles.metricRow}>
                  <AppText style={[type.metricLg, { color: colors.textPrimary }]}>
                    {item.percentage.toFixed(1)}
                  </AppText>
                  <AppText style={[type.bodyMedium, styles.unitText, { color: colors.textMuted }]}>
                    % ({item.present} / {item.total} classes)
                  </AppText>
                </View>
              ) : (
                <View style={styles.metricRow}>
                  <AppText style={[type.metricLg, { color: colors.textPrimary }]}>--%</AppText>
                  <AppText style={[type.bodyMedium, styles.unitText, { color: colors.textMuted }]}>
                    (No classes logged)
                  </AppText>
                </View>
              )}
            </View>
            <SubjectIntelligenceBadge item={item} />
          </View>
        </Card>

        {/* Intelligence Projections */}
        <Card padding={space.lg} style={styles.card}>
          <View style={styles.rowBetween}>
            <AppText variant="eyebrow" tone="muted">
              Attendance Intelligence
            </AppText>
            <AppText variant="bodySm" tone="secondary">
              Goal: {item.target}%
            </AppText>
          </View>
          <AppText variant="bodySm" tone="secondary" style={styles.projectionText}>
            {projectionText}
          </AppText>
        </Card>

        {/* Target Stepper Adjustment */}
        <Card padding={space.lg} style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <AppText variant="eyebrow" tone="muted">
                Target Threshold
              </AppText>
              <AppText variant="bodySm" tone="secondary">
                Range: {MIN_TARGET_PERCENTAGE}% – {MAX_TARGET_PERCENTAGE}%
              </AppText>
            </View>
            {item.isCustomTarget ? (
              <View
                style={[
                  styles.customTag,
                  { backgroundColor: colors.accentSubtle, borderColor: colors.accentBorder },
                ]}
              >
                <AppText style={[type.bodySmMedium, { color: colors.accent, fontSize: 11 }]}>Custom</AppText>
              </View>
            ) : (
              <View
                style={[
                  styles.customTag,
                  { backgroundColor: colors.surfacePressed, borderColor: colors.hairline },
                ]}
              >
                <AppText style={[type.bodySmMedium, { color: colors.textMuted, fontSize: 11 }]}>Default</AppText>
              </View>
            )}
          </View>

          <View style={[styles.stepperContainer, { borderColor: colors.hairline, backgroundColor: colors.surfaceElevated }]}>
            <Pressable
              onPress={handleDecrement}
              disabled={isAtMin || saving}
              hitSlop={8}
              style={[styles.stepperBtn, (isAtMin || saving) && styles.disabledBtn]}
              accessibilityRole="button"
              accessibilityLabel="Decrease target by 1 percent"
            >
              <Minus size={20} color={isAtMin ? colors.textFaint : colors.textPrimary} strokeWidth={ICON_STROKE} />
            </Pressable>

            <View style={styles.stepperValueContainer}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <View style={styles.stepperValueRow}>
                  <AppText style={[type.metricLg, { color: colors.textPrimary }]}>
                    {item.target}
                  </AppText>
                  <AppText style={[type.bodySmMedium, { color: colors.textMuted, marginLeft: 2 }]}>
                    %
                  </AppText>
                </View>
              )}
            </View>

            <Pressable
              onPress={handleIncrement}
              disabled={isAtMax || saving}
              hitSlop={8}
              style={[styles.stepperBtn, (isAtMax || saving) && styles.disabledBtn]}
              accessibilityRole="button"
              accessibilityLabel="Increase target by 1 percent"
            >
              <Plus size={20} color={isAtMax ? colors.textFaint : colors.textPrimary} strokeWidth={ICON_STROKE} />
            </Pressable>
          </View>

          {item.isCustomTarget && (
            <Button
              title="Reset to default (75%)"
              variant="secondary"
              size="md"
              icon={<RotateCcw size={16} color={colors.textPrimary} strokeWidth={ICON_STROKE} />}
              onPress={handleReset}
              disabled={saving}
              loading={saving}
              style={styles.resetBtn}
            />
          )}

          {error && (
            <View style={[styles.errorBanner, { backgroundColor: colors.dangerSubtle, borderColor: colors.danger }]}>
              <AlertCircle size={16} color={colors.danger} strokeWidth={ICON_STROKE} />
              <AppText style={[type.bodySmMedium, { color: colors.danger, flex: 1 }]}>
                {error}
              </AppText>
            </View>
          )}
        </Card>

        {/* Model Disclaimer */}
        <View style={styles.disclaimerBox}>
          <Info size={14} color={colors.textMuted} strokeWidth={ICON_STROKE} style={styles.disclaimerIcon} />
          <AppText style={[styles.disclaimerText, { color: colors.textMuted }]}>
            Projections assume consecutive, equally weighted single classes and do not account for future timetable changes or cancellations.
          </AppText>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.md,
    paddingTop: space.xs,
    paddingBottom: space.xl,
  },
  card: {
    gap: space.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: space.xs,
  },
  unitText: {
    marginLeft: space.sm,
  },
  projectionText: {
    lineHeight: 20,
  },
  customTag: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    height: 52,
    marginTop: space.sm,
    paddingHorizontal: space.xs,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.35,
  },
  stepperValueContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  resetBtn: {
    marginTop: space.xs,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: space.xs,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingHorizontal: space.xs,
    marginTop: space.xs,
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
