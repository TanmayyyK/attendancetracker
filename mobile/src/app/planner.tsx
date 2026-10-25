import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Pencil,
  Info,
  CalendarOff,
  MapPin,
  User,
  AlertTriangle,
  CalendarDays,
} from 'lucide-react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { GUTTER, space, radius, type, ICON_STROKE } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import {
  Screen,
  Card,
  Button,
  BottomSheet,
  EmptyState,
  AppText,
} from '@/components/ui';
import { FadeInSlide } from '@/components/animations/FadeInSlide';
import {
  TEACHING_DAYS,
  type TeachingDay,
  type TimetableSlot,
  type AcademicHoliday,
  type TimetableConfigV1,
} from '@/types/timetable';
import {
  loadTimetableConfig,
  addOrUpdateSlot,
  removeSlot,
  addHoliday,
  removeHoliday,
  setEffectiveFromDate,
} from '@/services/timetable/timetableStorage';
import {
  createDefaultTimetableConfig,
  validateTimeFormat,
  isEndTimeAfterStartTime,
  detectSlotOverlap,
  sortSlotsChronologically,
  getWeekdayFromCalendarDate,
} from '@/utils/timetablePolicy';
import { getLocalTodayDateString, isValidCalendarDate } from '@/utils/dates';

const CANONICAL_SUBJECTS = [
  'Physiology',
  'Anatomy',
  'Samhita',
  'Padarth Vigyan',
  'Sanskrit (CM Sir)',
] as const;

type PlannerDay = TeachingDay | 'Sunday';

const ALL_PLANNER_DAYS: PlannerDay[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export default function PlannerScreen() {
  const { colors } = useTheme();

  // Active configuration state
  const [config, setConfig] = useState<TimetableConfigV1>(() => createDefaultTimetableConfig());
  const [loading, setLoading] = useState(true);

  // Selected day tab
  const [selectedDay, setSelectedDay] = useState<PlannerDay>(() => {
    const todayWeekday = getWeekdayFromCalendarDate(getLocalTodayDateString());
    return todayWeekday.isSunday ? 'Sunday' : (todayWeekday.teachingDay ?? 'Monday');
  });

  // Slot modal state (Add or Edit)
  const [slotModalVisible, setSlotModalVisible] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotSubject, setSlotSubject] = useState<string>(CANONICAL_SUBJECTS[0]);
  const [slotStartTime, setSlotStartTime] = useState<string>('09:00');
  const [slotEndTime, setSlotEndTime] = useState<string>('10:00');
  const [slotProfessor, setSlotProfessor] = useState<string>('');
  const [slotRoom, setSlotRoom] = useState<string>('');
  const [slotError, setSlotError] = useState<string | null>(null);

  // Holidays modal state
  const [holidaysModalVisible, setHolidaysModalVisible] = useState(false);
  const [holidayDate, setHolidayDate] = useState<string>('');
  const [holidayName, setHolidayName] = useState<string>('');
  const [holidayError, setHolidayError] = useState<string | null>(null);

  // Effective-from date modal state
  const [effectiveModalVisible, setEffectiveModalVisible] = useState(false);
  const [effectiveDateInput, setEffectiveDateInput] = useState<string>('');
  const [effectiveDateError, setEffectiveDateError] = useState<string | null>(null);

  // Load config on mount
  const refreshConfig = useCallback(async () => {
    try {
      const { config: loadedConfig } = await loadTimetableConfig();
      setConfig(loadedConfig);
    } catch (err) {
      console.warn('Failed to load timetable config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshConfig();
  }, [refreshConfig]);

  // Slots for currently selected day
  const currentDaySlots = useMemo(() => {
    if (selectedDay === 'Sunday') {
      return [];
    }
    const daySlots = config.slots.filter((s) => s.day === selectedDay);
    return sortSlotsChronologically(daySlots);
  }, [config.slots, selectedDay]);

  // Open slot modal for creation
  const handleOpenAddSlot = useCallback(() => {
    if (selectedDay === 'Sunday') {
      Alert.alert(
        'Non-Teaching Day',
        'Sunday is designated as a non-teaching day. Classes can only be planned Monday through Saturday.'
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingSlotId(null);
    setSlotSubject(CANONICAL_SUBJECTS[0]);
    setSlotStartTime('09:00');
    setSlotEndTime('10:00');
    setSlotProfessor('');
    setSlotRoom('');
    setSlotError(null);
    setSlotModalVisible(true);
  }, [selectedDay]);

  // Open slot modal for editing
  const handleOpenEditSlot = useCallback((slot: TimetableSlot) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingSlotId(slot.id);
    setSlotSubject(slot.subject);
    setSlotStartTime(slot.startTime);
    setSlotEndTime(slot.endTime);
    setSlotProfessor(slot.professor || '');
    setSlotRoom(slot.room || '');
    setSlotError(null);
    setSlotModalVisible(true);
  }, []);

  // Save slot (create or update)
  const handleSaveSlot = useCallback(async () => {
    if (selectedDay === 'Sunday') {
      setSlotError('Cannot add classes to Sunday.');
      return;
    }

    const trimmedSubject = slotSubject.trim();
    const trimmedStart = slotStartTime.trim();
    const trimmedEnd = slotEndTime.trim();
    const trimmedProf = slotProfessor.trim();
    const trimmedRoom = slotRoom.trim();

    if (!trimmedSubject) {
      setSlotError('Subject name is required.');
      return;
    }
    if (!validateTimeFormat(trimmedStart)) {
      setSlotError(`Start time "${trimmedStart}" is invalid. Use 24h HH:MM format.`);
      return;
    }
    if (!validateTimeFormat(trimmedEnd)) {
      setSlotError(`End time "${trimmedEnd}" is invalid. Use 24h HH:MM format.`);
      return;
    }
    if (!isEndTimeAfterStartTime(trimmedStart, trimmedEnd)) {
      setSlotError(`End time (${trimmedEnd}) must be strictly after start time (${trimmedStart}).`);
      return;
    }

    const slotId =
      editingSlotId ||
      `slot_${selectedDay.toLowerCase().slice(0, 3)}_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;

    const candidateSlot: TimetableSlot = {
      id: slotId,
      day: selectedDay,
      startTime: trimmedStart,
      endTime: trimmedEnd,
      subject: trimmedSubject,
      professor: trimmedProf || undefined,
      room: trimmedRoom || undefined,
    };

    // Pre-check overlap against other slots on the same day
    const otherSlots = config.slots.filter(
      (s) => s.day === selectedDay && s.id !== candidateSlot.id
    );
    const conflictingSlot = otherSlots.find((s) => detectSlotOverlap(s, candidateSlot));
    if (conflictingSlot) {
      setSlotError(
        `Time conflict: Overlaps with ${conflictingSlot.subject} (${conflictingSlot.startTime}–${conflictingSlot.endTime}).`
      );
      return;
    }

    const result = await addOrUpdateSlot(candidateSlot);
    if (!result.success) {
      setSlotError(result.error ?? 'Failed to save class slot.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSlotModalVisible(false);
    await refreshConfig();
  }, [
    selectedDay,
    slotSubject,
    slotStartTime,
    slotEndTime,
    slotProfessor,
    slotRoom,
    editingSlotId,
    config.slots,
    refreshConfig,
  ]);

  // Delete slot with confirmation
  const handleDeleteSlot = useCallback(
    (slot: TimetableSlot) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert(
        'Delete Class',
        `Remove ${slot.subject} (${slot.startTime}–${slot.endTime}) from ${slot.day}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await removeSlot(slot.id);
              await refreshConfig();
            },
          },
        ]
      );
    },
    [refreshConfig]
  );

  // Add holiday
  const handleAddHoliday = useCallback(async () => {
    const trimmedDate = holidayDate.trim();
    const trimmedName = holidayName.trim();

    if (!isValidCalendarDate(trimmedDate)) {
      setHolidayError('Please enter a valid date in YYYY-MM-DD format.');
      return;
    }
    if (!trimmedName) {
      setHolidayError('Holiday name is required.');
      return;
    }

    const holidayId = `hol_${trimmedDate.replace(/-/g, '')}_${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    const result = await addHoliday({
      id: holidayId,
      date: trimmedDate,
      name: trimmedName,
    });

    if (!result.success) {
      setHolidayError(result.error ?? 'Failed to add holiday.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHolidayDate('');
    setHolidayName('');
    setHolidayError(null);
    await refreshConfig();
  }, [holidayDate, holidayName, refreshConfig]);

  // Delete holiday
  const handleDeleteHoliday = useCallback(
    (holiday: AcademicHoliday) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert(
        'Remove Holiday',
        `Remove "${holiday.name}" on ${holiday.date}? Classes will resume on this date.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await removeHoliday(holiday.id);
              await refreshConfig();
            },
          },
        ]
      );
    },
    [refreshConfig]
  );

  // Save effective-from date
  const handleSaveEffectiveDate = useCallback(async () => {
    const trimmed = effectiveDateInput.trim();
    if (!isValidCalendarDate(trimmed)) {
      setEffectiveDateError('Please enter a valid date in YYYY-MM-DD format.');
      return;
    }

    const result = await setEffectiveFromDate(trimmed);
    if (!result.success) {
      setEffectiveDateError(result.error ?? 'Failed to update effective date.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEffectiveModalVisible(false);
    await refreshConfig();
  }, [effectiveDateInput, refreshConfig]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <AppText variant="bodySm" tone="secondary" style={styles.loadingText}>
            Loading weekly planner...
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Bar */}
          <FadeInSlide>
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.back();
                }}
                hitSlop={12}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <ArrowLeft size={22} color={colors.textPrimary} strokeWidth={ICON_STROKE} />
              </Pressable>
              <View style={styles.headerTitles}>
                <AppText variant="h1">Weekly Planner</AppText>
                <AppText variant="bodySm" tone="secondary">
                  Recurring Mon–Sat class timetable
                </AppText>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setHolidayDate('');
                  setHolidayName('');
                  setHolidayError(null);
                  setHolidaysModalVisible(true);
                }}
                style={[
                  styles.headerActionBtn,
                  {
                    backgroundColor:
                      config.holidays.length > 0 ? colors.accentSubtle : colors.surface,
                    borderColor:
                      config.holidays.length > 0 ? colors.accentBorder : colors.hairline,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Manage academic holidays"
              >
                <CalendarOff
                  size={16}
                  color={config.holidays.length > 0 ? colors.accent : colors.textSecondary}
                  strokeWidth={ICON_STROKE}
                />
                <AppText
                  variant="bodySmMedium"
                  style={{
                    color: config.holidays.length > 0 ? colors.accent : colors.textSecondary,
                  }}
                >
                  {config.holidays.length > 0 ? `${config.holidays.length} Holidays` : 'Holidays'}
                </AppText>
              </Pressable>
            </View>
          </FadeInSlide>

          {/* Informational Policy Banner */}
          <FadeInSlide delay={60}>
            <Card padding={space.md} style={styles.disclaimerCard}>
              <View style={styles.disclaimerRow}>
                <Info size={18} color={colors.accent} strokeWidth={ICON_STROKE} style={styles.disclaimerIcon} />
                <View style={styles.disclaimerText}>
                  <AppText variant="bodySm" tone="secondary">
                    <AppText variant="bodySmMedium" tone="primary">Planning only: </AppText>
                    Timetable defines your planned schedule. Actual attendance must be logged explicitly in the Add tab.
                  </AppText>
                </View>
              </View>
            </Card>
          </FadeInSlide>

          {/* Effective Date & Schedule Status */}
          <FadeInSlide delay={100}>
            <View style={styles.metaCardRow}>
              <View style={styles.effectiveInfo}>
                <AppText variant="eyebrow" tone="muted">
                  Active Schedule
                </AppText>
                <AppText variant="mono" style={{ color: colors.textPrimary, fontSize: 13 }}>
                  Effective from {config.effectiveFrom}
                </AppText>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setEffectiveDateInput(config.effectiveFrom);
                  setEffectiveDateError(null);
                  setEffectiveModalVisible(true);
                }}
                style={[styles.smallActionBtn, { borderColor: colors.hairline }]}
                accessibilityRole="button"
                accessibilityLabel="Change timetable effective date"
              >
                <Pencil size={13} color={colors.textSecondary} strokeWidth={ICON_STROKE} />
                <AppText variant="bodySmMedium" tone="secondary">
                  Change
                </AppText>
              </Pressable>
            </View>
          </FadeInSlide>

          {/* Day Selector Pills */}
          <FadeInSlide delay={140}>
            <View style={styles.daysContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.daysScroll}
              >
                {ALL_PLANNER_DAYS.map((day) => {
                  const isSelected = selectedDay === day;
                  const isSun = day === 'Sunday';
                  const count = isSun ? 0 : config.slots.filter((s) => s.day === day).length;

                  return (
                    <Pressable
                      key={day}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedDay(day);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${day}, ${isSun ? 'non-teaching day' : `${count} classes`}`}
                      style={[
                        styles.dayPill,
                        {
                          backgroundColor: isSelected
                            ? colors.accent
                            : isSun
                            ? colors.surfaceElevated
                            : colors.surface,
                          borderColor: isSelected
                            ? colors.accent
                            : isSun
                            ? colors.hairlineStrong
                            : colors.hairline,
                        },
                      ]}
                    >
                      <AppText
                        variant="bodySmMedium"
                        style={{
                          color: isSelected
                            ? colors.accentOn
                            : isSun
                            ? colors.textMuted
                            : colors.textPrimary,
                        }}
                      >
                        {day.slice(0, 3)}
                      </AppText>
                      {!isSun && count > 0 && (
                        <View
                          style={[
                            styles.slotCountBadge,
                            {
                              backgroundColor: isSelected
                                ? 'rgba(255,255,255,0.25)'
                                : colors.surfacePressed,
                            },
                          ]}
                        >
                          <AppText
                            variant="mono"
                            style={{
                              color: isSelected ? colors.accentOn : colors.textSecondary,
                              fontSize: 10,
                            }}
                          >
                            {count}
                          </AppText>
                        </View>
                      )}
                      {isSun && (
                        <AppText
                          variant="mono"
                          style={{
                            color: isSelected ? colors.accentOn : colors.textFaint,
                            fontSize: 9,
                            marginLeft: 2,
                          }}
                        >
                          Off
                        </AppText>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </FadeInSlide>

          {/* Selected Day Header & Add Button */}
          <FadeInSlide delay={180}>
            <View style={styles.dayHeaderRow}>
              <View>
                <AppText variant="h2">{selectedDay}</AppText>
                <AppText variant="bodySm" tone="secondary">
                  {selectedDay === 'Sunday'
                    ? 'Default non-teaching day'
                    : currentDaySlots.length === 0
                    ? 'No classes scheduled'
                    : `${currentDaySlots.length} ${
                        currentDaySlots.length === 1 ? 'class' : 'classes'
                      } planned`}
                </AppText>
              </View>
              {selectedDay !== 'Sunday' && (
                <Button
                  title="Add Class"
                  variant="primary"
                  size="md"
                  fullWidth={false}
                  onPress={handleOpenAddSlot}
                  icon={<Plus size={16} color={colors.accentOn} strokeWidth={ICON_STROKE} />}
                />
              )}
            </View>
          </FadeInSlide>

          {/* Day Content */}
          {selectedDay === 'Sunday' ? (
            <FadeInSlide delay={200}>
              <Card padding={space.xl} style={styles.sundayCard}>
                <View style={styles.sundayContent}>
                  <View style={[styles.sundayIconCircle, { backgroundColor: colors.warningSubtle }]}>
                    <CalendarOff size={32} color={colors.warning} strokeWidth={ICON_STROKE} />
                  </View>
                  <AppText variant="h2" style={styles.sundayTitle}>
                    Non-Teaching Day
                  </AppText>
                  <AppText variant="bodyMedium" tone="secondary" style={styles.sundayDescription}>
                    Sundays are designated as non-teaching days. Timetable classes cannot be
                    scheduled on Sundays.
                  </AppText>
                  <View style={[styles.sundayNoteBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.hairline }]}>
                    <Info size={14} color={colors.textMuted} strokeWidth={ICON_STROKE} />
                    <AppText variant="bodySm" tone="muted" style={styles.sundayNoteText}>
                      If an exceptional makeup class took place on Sunday, you can still record it
                      manually in the Add tab.
                    </AppText>
                  </View>
                </View>
              </Card>
            </FadeInSlide>
          ) : currentDaySlots.length === 0 ? (
            <FadeInSlide delay={200}>
              <EmptyState
                icon={<CalendarDays size={32} color={colors.textMuted} strokeWidth={ICON_STROKE} />}
                title={`No classes on ${selectedDay}`}
                description={`You haven't scheduled any recurring classes for ${selectedDay} yet.`}
                action={{
                  label: `Add Class to ${selectedDay}`,
                  onPress: handleOpenAddSlot,
                }}
              />
            </FadeInSlide>
          ) : (
            <View style={styles.slotsList}>
              {currentDaySlots.map((slot) => (
                <Card key={slot.id} padding={space.lg} style={styles.slotCard}>
                  <View style={styles.slotTopRow}>
                    <View style={[styles.timePill, { backgroundColor: colors.accentSubtle, borderColor: colors.accentBorder }]}>
                      <Clock size={12} color={colors.accent} strokeWidth={ICON_STROKE} />
                      <AppText variant="mono" style={{ color: colors.accent, fontSize: 12 }}>
                        {slot.startTime} – {slot.endTime}
                      </AppText>
                    </View>
                    <View style={styles.slotActions}>
                      <Pressable
                        onPress={() => handleOpenEditSlot(slot)}
                        hitSlop={8}
                        style={styles.actionIconButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${slot.subject}`}
                      >
                        <Pencil size={15} color={colors.textSecondary} strokeWidth={ICON_STROKE} />
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteSlot(slot)}
                        hitSlop={8}
                        style={styles.actionIconButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${slot.subject}`}
                      >
                        <Trash2 size={15} color={colors.danger} strokeWidth={ICON_STROKE} />
                      </Pressable>
                    </View>
                  </View>

                  <AppText variant="bodyMedium" numberOfLines={1} style={styles.slotSubject}>
                    {slot.subject}
                  </AppText>

                  {(slot.professor || slot.room) && (
                    <View style={styles.slotMetaRow}>
                      {slot.professor ? (
                        <View style={styles.slotMetaItem}>
                          <User size={13} color={colors.textMuted} strokeWidth={ICON_STROKE} />
                          <AppText variant="bodySm" tone="secondary" numberOfLines={1}>
                            {slot.professor}
                          </AppText>
                        </View>
                      ) : null}
                      {slot.room ? (
                        <View style={styles.slotMetaItem}>
                          <MapPin size={13} color={colors.textMuted} strokeWidth={ICON_STROKE} />
                          <AppText variant="bodySm" tone="secondary" numberOfLines={1}>
                            {slot.room}
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                  )}
                </Card>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Add / Edit Slot BottomSheet */}
      <BottomSheet
        visible={slotModalVisible}
        onClose={() => setSlotModalVisible(false)}
        title={editingSlotId ? `Edit ${selectedDay} Class` : `Add Class to ${selectedDay}`}
        subtitle="Set subject, timings (24-hour format), and optional venue details."
      >
        <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
          {slotError && (
            <View style={[styles.errorBox, { backgroundColor: colors.dangerSubtle, borderColor: colors.danger }]}>
              <AlertTriangle size={15} color={colors.danger} strokeWidth={ICON_STROKE} />
              <AppText variant="bodySm" tone="danger" style={styles.errorText}>
                {slotError}
              </AppText>
            </View>
          )}

          {/* Subject Selection */}
          <AppText variant="eyebrow" tone="muted" style={styles.inputLabel}>
            Subject
          </AppText>
          <View style={styles.subjectPillGrid}>
            {CANONICAL_SUBJECTS.map((sub) => {
              const isSelected = slotSubject === sub;
              return (
                <Pressable
                  key={sub}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSlotSubject(sub);
                  }}
                  style={[
                    styles.subjectChoicePill,
                    {
                      backgroundColor: isSelected ? colors.accent : colors.surface,
                      borderColor: isSelected ? colors.accent : colors.hairline,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <AppText
                    variant="bodySmMedium"
                    style={{ color: isSelected ? colors.accentOn : colors.textPrimary }}
                  >
                    {sub}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {/* Custom Subject Input */}
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.hairline,
                color: colors.textPrimary,
              },
            ]}
            value={slotSubject}
            onChangeText={setSlotSubject}
            placeholder="Or type custom subject..."
            placeholderTextColor={colors.textFaint}
            autoCapitalize="words"
          />

          {/* Timing Inputs (24h format) */}
          <AppText variant="eyebrow" tone="muted" style={styles.inputLabel}>
            Timing (24-Hour Format: HH:MM)
          </AppText>
          <View style={styles.timeRow}>
            <View style={styles.timeCol}>
              <AppText variant="bodySm" tone="secondary" style={styles.subFieldLabel}>
                Start Time
              </AppText>
              <TextInput
                style={[
                  styles.timeInput,
                  type.mono,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.hairline,
                    color: colors.textPrimary,
                  },
                ]}
                value={slotStartTime}
                onChangeText={setSlotStartTime}
                placeholder="09:00"
                placeholderTextColor={colors.textFaint}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.timeCol}>
              <AppText variant="bodySm" tone="secondary" style={styles.subFieldLabel}>
                End Time
              </AppText>
              <TextInput
                style={[
                  styles.timeInput,
                  type.mono,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.hairline,
                    color: colors.textPrimary,
                  },
                ]}
                value={slotEndTime}
                onChangeText={setSlotEndTime}
                placeholder="10:00"
                placeholderTextColor={colors.textFaint}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Optional Professor */}
          <AppText variant="eyebrow" tone="muted" style={styles.inputLabel}>
            Faculty / Professor (Optional)
          </AppText>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.hairline,
                color: colors.textPrimary,
              },
            ]}
            value={slotProfessor}
            onChangeText={setSlotProfessor}
            placeholder="e.g. Dr. Sharma"
            placeholderTextColor={colors.textFaint}
          />

          {/* Optional Room */}
          <AppText variant="eyebrow" tone="muted" style={styles.inputLabel}>
            Room / Venue (Optional)
          </AppText>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.hairline,
                color: colors.textPrimary,
              },
            ]}
            value={slotRoom}
            onChangeText={setSlotRoom}
            placeholder="e.g. Lecture Hall 2"
            placeholderTextColor={colors.textFaint}
          />

          <View style={styles.modalButtonRow}>
            <Button
              title={editingSlotId ? 'Save Changes' : 'Add Class Slot'}
              onPress={handleSaveSlot}
              variant="primary"
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setSlotModalVisible(false)}
            />
          </View>
        </ScrollView>
      </BottomSheet>

      {/* Academic Holidays BottomSheet */}
      <BottomSheet
        visible={holidaysModalVisible}
        onClose={() => setHolidaysModalVisible(false)}
        title="Academic Holidays"
        subtitle="Holidays suspend planned classes for specific calendar dates."
      >
        <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
          {holidayError && (
            <View style={[styles.errorBox, { backgroundColor: colors.dangerSubtle, borderColor: colors.danger }]}>
              <AlertTriangle size={15} color={colors.danger} strokeWidth={ICON_STROKE} />
              <AppText variant="bodySm" tone="danger" style={styles.errorText}>
                {holidayError}
              </AppText>
            </View>
          )}

          {/* Add Holiday Form */}
          <Card padding={space.md} style={styles.addHolidayCard}>
            <AppText variant="bodyMedium" style={{ marginBottom: space.sm }}>
              Add Non-Teaching Holiday
            </AppText>
            <TextInput
              style={[
                styles.textInput,
                type.mono,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.hairline,
                  color: colors.textPrimary,
                  marginBottom: space.sm,
                },
              ]}
              value={holidayDate}
              onChangeText={setHolidayDate}
              placeholder="Date (YYYY-MM-DD)"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              maxLength={10}
            />
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.hairline,
                  color: colors.textPrimary,
                  marginBottom: space.md,
                },
              ]}
              value={holidayName}
              onChangeText={setHolidayName}
              placeholder="Holiday name (e.g. Diwali Break)"
              placeholderTextColor={colors.textFaint}
            />
            <Button
              title="Add Holiday"
              variant="secondary"
              size="md"
              onPress={handleAddHoliday}
              disabled={!holidayDate.trim() || !holidayName.trim()}
            />
          </Card>

          {/* Existing Holidays List */}
          <AppText variant="eyebrow" tone="muted" style={[styles.inputLabel, { marginTop: space.lg }]}>
            Configured Holidays ({config.holidays.length})
          </AppText>

          {config.holidays.length === 0 ? (
            <AppText variant="bodySm" tone="muted" style={{ paddingVertical: space.md }}>
              No academic holidays configured. All regular Mon–Sat days have classes.
            </AppText>
          ) : (
            config.holidays.map((h) => (
              <View
                key={h.id}
                style={[
                  styles.holidayRow,
                  { backgroundColor: colors.surface, borderColor: colors.hairline },
                ]}
              >
                <View style={styles.holidayInfo}>
                  <AppText variant="bodyMedium">{h.name}</AppText>
                  <AppText variant="mono" style={{ color: colors.textMuted, fontSize: 12 }}>
                    {h.date}
                  </AppText>
                </View>
                <Pressable
                  onPress={() => handleDeleteHoliday(h)}
                  hitSlop={8}
                  style={styles.actionIconButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove holiday ${h.name}`}
                >
                  <Trash2 size={16} color={colors.danger} strokeWidth={ICON_STROKE} />
                </Pressable>
              </View>
            ))
          )}

          <Button
            title="Done"
            variant="ghost"
            onPress={() => setHolidaysModalVisible(false)}
            style={{ marginTop: space.md }}
          />
        </ScrollView>
      </BottomSheet>

      {/* Effective-From Date BottomSheet */}
      <BottomSheet
        visible={effectiveModalVisible}
        onClose={() => setEffectiveModalVisible(false)}
        title="Schedule Effective Date"
        subtitle="Classes planned here only apply to calendar dates on or after this date."
      >
        <View style={styles.modalScroll}>
          {effectiveDateError && (
            <View style={[styles.errorBox, { backgroundColor: colors.dangerSubtle, borderColor: colors.danger }]}>
              <AlertTriangle size={15} color={colors.danger} strokeWidth={ICON_STROKE} />
              <AppText variant="bodySm" tone="danger" style={styles.errorText}>
                {effectiveDateError}
              </AppText>
            </View>
          )}

          <AppText variant="eyebrow" tone="muted" style={styles.inputLabel}>
            Effective From (YYYY-MM-DD)
          </AppText>
          <TextInput
            style={[
              styles.textInput,
              type.mono,
              {
                backgroundColor: colors.surface,
                borderColor: colors.hairline,
                color: colors.textPrimary,
                marginBottom: space.lg,
              },
            ]}
            value={effectiveDateInput}
            onChangeText={setEffectiveDateInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textFaint}
            maxLength={10}
            autoCapitalize="none"
          />

          <View style={styles.modalButtonRow}>
            <Button
              title="Save Effective Date"
              onPress={handleSaveEffectiveDate}
              variant="primary"
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setEffectiveModalVisible(false)}
            />
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.md,
  },
  loadingText: { marginTop: space.sm },
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: space.md,
    paddingBottom: space.huge,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.lg,
  },
  backButton: {
    marginRight: space.md,
    padding: space.xs,
  },
  headerTitles: {
    flex: 1,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  disclaimerCard: {
    marginBottom: space.md,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  disclaimerIcon: {
    marginTop: 2,
  },
  disclaimerText: {
    flex: 1,
  },
  metaCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.lg,
    paddingHorizontal: space.xs,
  },
  effectiveInfo: {
    gap: 2,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  daysContainer: {
    marginBottom: space.lg,
  },
  daysScroll: {
    gap: space.sm,
  },
  dayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: space.xs,
  },
  slotCountBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  sundayCard: {
    marginTop: space.sm,
  },
  sundayContent: {
    alignItems: 'center',
    paddingVertical: space.md,
  },
  sundayIconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space.md,
  },
  sundayTitle: {
    marginBottom: space.xs,
  },
  sundayDescription: {
    textAlign: 'center',
    marginBottom: space.lg,
    paddingHorizontal: space.md,
  },
  sundayNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    width: '100%',
  },
  sundayNoteText: {
    flex: 1,
  },
  slotsList: {
    gap: space.md,
  },
  slotCard: {
    marginBottom: space.xs,
  },
  slotTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  slotActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  actionIconButton: {
    padding: space.xs,
  },
  slotSubject: {
    fontSize: 16,
    marginBottom: space.xs,
  },
  slotMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    marginTop: space.xs,
  },
  slotMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  modalScroll: {
    maxHeight: 520,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space.md,
  },
  errorText: {
    flex: 1,
  },
  inputLabel: {
    marginBottom: space.xs,
    marginTop: space.sm,
  },
  subjectPillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginBottom: space.sm,
  },
  subjectChoicePill: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  textInput: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.md,
    fontSize: 14,
  },
  timeRow: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.sm,
  },
  timeCol: {
    flex: 1,
  },
  subFieldLabel: {
    marginBottom: space.xs,
  },
  timeInput: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.md,
    fontSize: 15,
    textAlign: 'center',
  },
  modalButtonRow: {
    marginTop: space.xl,
    gap: space.sm,
  },
  addHolidayCard: {
    marginBottom: space.md,
  },
  holidayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space.sm,
  },
  holidayInfo: {
    flex: 1,
    gap: 2,
  },
});
