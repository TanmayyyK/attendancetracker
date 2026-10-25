/**
 * Academic Calendar & Timetable Policy Tests (Phase 2E Batch 1)
 *
 * Verifies:
 * 1. Monday–Saturday weekday validation and strict Sunday exclusion.
 * 2. Time format validation (HH:MM) and end-after-start constraints.
 * 3. Stable IDs, duplicate-ID rejection, and duplicate slot prevention.
 * 4. Slot overlap detection on the same day.
 * 5. Chronological slot sorting.
 * 6. Local calendar date calculation and Monday–Sunday week boundary computation.
 * 7. Holiday override and non-teaching day suspension.
 * 8. Effective-from date restriction (no retroactive application before effective date).
 * 9. Sunday as non-teaching day across dates.
 * 10. Empty and partially configured timetable resilience.
 * 11. Corrupt, invalid, and unsupported-version storage handling (graceful fallback without data loss).
 * 12. Storage adapter CRUD operations for slots and holidays.
 */

import test from 'node:test';
import assert from 'node:assert';

import {
  TEACHING_DAYS,
  type TimetableSlot,
  type AcademicHoliday,
  type TimetableConfigV1,
} from '../types/timetable.ts';

import {
  validateTimeFormat,
  timeToMinutes,
  isEndTimeAfterStartTime,
  isTeachingDay,
  detectSlotOverlap,
  sortSlotsChronologically,
  sanitizeSlot,
  sanitizeHoliday,
  validateAndSanitizeConfig,
  createDefaultTimetableConfig,
  getWeekdayFromCalendarDate,
  getMondayOfWeek,
  getSundayOfWeek,
  getWeekDaysRange,
  getEffectiveScheduleForDate,
} from '../utils/timetablePolicy.ts';

import {
  loadTimetableConfig,
  saveTimetableConfig,
  addOrUpdateSlot,
  removeSlot,
  addHoliday,
  removeHoliday,
  setEffectiveFromDate,
  type StorageAdapter,
} from '../services/timetable/timetableStorage.ts';

function createMockStorage(initialData: Record<string, string> = {}): StorageAdapter & { data: Record<string, string> } {
  const store = { ...initialData };
  return {
    data: store,
    getItem: async (key: string) => store[key] ?? null,
    setItem: async (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: async (key: string) => {
      delete store[key];
    },
  };
}

test('1. Weekday validation permits Monday–Saturday and strictly rejects Sunday', () => {
  for (const day of TEACHING_DAYS) {
    assert.strictEqual(isTeachingDay(day), true, `${day} should be a valid teaching day`);
  }

  assert.strictEqual(isTeachingDay('Sunday'), false, 'Sunday must not be a teaching day');
  assert.strictEqual(isTeachingDay('Funday'), false);
  assert.strictEqual(isTeachingDay(''), false);
  assert.strictEqual(isTeachingDay(null), false);

  // Slot sanitization rejects Sunday
  const sundaySlot = {
    id: 'slot_sun_1',
    day: 'Sunday',
    startTime: '09:00',
    endTime: '10:00',
    subject: 'Physiology',
  };
  const result = sanitizeSlot(sundaySlot);
  assert.strictEqual(result.slot, null);
  assert.match(result.error ?? '', /Sunday is not a teaching day/);
});

test('2. Time format validation and end-after-start constraint', () => {
  // Valid times
  assert.strictEqual(validateTimeFormat('00:00'), true);
  assert.strictEqual(validateTimeFormat('09:30'), true);
  assert.strictEqual(validateTimeFormat('23:59'), true);

  // Invalid times
  assert.strictEqual(validateTimeFormat('24:00'), false);
  assert.strictEqual(validateTimeFormat('9:30'), false);
  assert.strictEqual(validateTimeFormat('12:60'), false);
  assert.strictEqual(validateTimeFormat('invalid'), false);

  // Minute conversions
  assert.strictEqual(timeToMinutes('09:30'), 570);
  assert.strictEqual(timeToMinutes('14:15'), 855);

  // End time strictly after start time
  assert.strictEqual(isEndTimeAfterStartTime('09:00', '10:00'), true);
  assert.strictEqual(isEndTimeAfterStartTime('10:00', '10:00'), false, 'Identical times must fail');
  assert.strictEqual(isEndTimeAfterStartTime('11:00', '10:00'), false, 'End before start must fail');
});

test('3. Slot sanitization accepts valid canonical and custom subjects', () => {
  const validSlot = {
    id: 'slot_mon_0900_physio',
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
    subject: 'Physiology',
    professor: 'Satish Sir (Dean)',
    room: 'Lecture Hall 1',
  };

  const { slot, error } = sanitizeSlot(validSlot);
  assert.strictEqual(error, undefined);
  assert.notStrictEqual(slot, null);
  assert.strictEqual(slot?.subject, 'Physiology');
  assert.strictEqual(slot?.day, 'Monday');
  assert.strictEqual(slot?.room, 'Lecture Hall 1');

  // Custom subject is accepted
  const customSlot = {
    id: 'slot_tue_1400_clinical',
    day: 'Tuesday',
    startTime: '14:00',
    endTime: '16:00',
    subject: 'Ayurvedic Toxicology (Guest Lab)',
    professor: 'Dr. Varma',
  };
  const { slot: customRes } = sanitizeSlot(customSlot);
  assert.strictEqual(customRes?.subject, 'Ayurvedic Toxicology (Guest Lab)');
});

test('4. Slot overlap detection detects conflicts on the same day', () => {
  const baseSlot: TimetableSlot = {
    id: 'slot_1',
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:30',
    subject: 'Physiology',
  };

  // Overlapping slot: 10:00 - 11:00
  const overlapSlot: TimetableSlot = {
    id: 'slot_2',
    day: 'Monday',
    startTime: '10:00',
    endTime: '11:00',
    subject: 'Anatomy',
  };
  assert.strictEqual(detectSlotOverlap(baseSlot, overlapSlot), true);

  // Consecutive slot: 10:30 - 11:30 (sharing boundary is NOT an overlap)
  const consecutiveSlot: TimetableSlot = {
    id: 'slot_3',
    day: 'Monday',
    startTime: '10:30',
    endTime: '11:30',
    subject: 'Samhita',
  };
  assert.strictEqual(detectSlotOverlap(baseSlot, consecutiveSlot), false);

  // Slot on different day: Tuesday 09:00 - 10:00 (no overlap)
  const diffDaySlot: TimetableSlot = {
    id: 'slot_4',
    day: 'Tuesday',
    startTime: '09:00',
    endTime: '10:00',
    subject: 'Padarth Vigyan',
  };
  assert.strictEqual(detectSlotOverlap(baseSlot, diffDaySlot), false);
});

test('5. Chronological slot sorting orders by start time then end time', () => {
  const slots: TimetableSlot[] = [
    { id: '3', day: 'Monday', startTime: '14:00', endTime: '15:00', subject: 'Samhita' },
    { id: '1', day: 'Monday', startTime: '09:00', endTime: '10:00', subject: 'Physiology' },
    { id: '2', day: 'Monday', startTime: '11:00', endTime: '12:00', subject: 'Anatomy' },
  ];

  const sorted = sortSlotsChronologically(slots);
  assert.strictEqual(sorted[0].id, '1');
  assert.strictEqual(sorted[1].id, '2');
  assert.strictEqual(sorted[2].id, '3');
});

test('6. Local calendar academic week boundaries (Monday through Sunday)', () => {
  // Test reference date: Wednesday 2026-10-21
  const wedDate = '2026-10-21';
  assert.strictEqual(getMondayOfWeek(wedDate), '2026-10-19');
  assert.strictEqual(getSundayOfWeek(wedDate), '2026-10-25');

  // Test Sunday reference date: Sunday 2026-10-25 (must belong to current Mon-Sun week)
  const sunDate = '2026-10-25';
  assert.strictEqual(getMondayOfWeek(sunDate), '2026-10-19');
  assert.strictEqual(getSundayOfWeek(sunDate), '2026-10-25');

  // Week range contains 7 days
  const range = getWeekDaysRange('2026-10-21');
  assert.strictEqual(range.length, 7);
  assert.strictEqual(range[0].dayName, 'Monday');
  assert.strictEqual(range[0].date, '2026-10-19');
  assert.strictEqual(range[0].isSunday, false);
  assert.strictEqual(range[6].dayName, 'Sunday');
  assert.strictEqual(range[6].date, '2026-10-25');
  assert.strictEqual(range[6].isSunday, true);
  assert.strictEqual(range[6].teachingDay, null);
});

test('7. Effective schedule resolution handles effective dates, Sundays, and Holidays', () => {
  const config: TimetableConfigV1 = {
    version: 1,
    effectiveFrom: '2026-10-01',
    slots: [
      { id: 'mon_1', day: 'Monday', startTime: '09:00', endTime: '10:00', subject: 'Physiology' },
      { id: 'wed_1', day: 'Wednesday', startTime: '10:00', endTime: '11:00', subject: 'Anatomy' },
    ],
    holidays: [
      { id: 'h1', date: '2026-10-21', name: 'Autumn Festival' },
    ],
    updatedAt: '2026-10-01T00:00:00Z',
  };

  // 1. Date before effective date (2026-09-15)
  const beforeRes = getEffectiveScheduleForDate('2026-09-15', config);
  assert.strictEqual(beforeRes.isApplicable, false);
  assert.strictEqual(beforeRes.status, 'before_effective_date');
  assert.strictEqual(beforeRes.slots.length, 0);

  // 2. Sunday (2026-10-18)
  const sunRes = getEffectiveScheduleForDate('2026-10-18', config);
  assert.strictEqual(sunRes.isApplicable, true);
  assert.strictEqual(sunRes.status, 'sunday');
  assert.strictEqual(sunRes.slots.length, 0);

  // 3. Holiday override (Wednesday 2026-10-21 would normally have Anatomy)
  const holRes = getEffectiveScheduleForDate('2026-10-21', config);
  assert.strictEqual(holRes.isApplicable, true);
  assert.strictEqual(holRes.status, 'holiday');
  assert.strictEqual(holRes.holidayName, 'Autumn Festival');
  assert.strictEqual(holRes.slots.length, 0, 'Holiday overrides ordinary class slots');

  // 4. Normal teaching day (Monday 2026-10-19)
  const teachRes = getEffectiveScheduleForDate('2026-10-19', config);
  assert.strictEqual(teachRes.isApplicable, true);
  assert.strictEqual(teachRes.status, 'teaching_day');
  assert.strictEqual(teachRes.slots.length, 1);
  assert.strictEqual(teachRes.slots[0].subject, 'Physiology');
});

test('8. Config sanitizer handles corrupt, missing, and unsupported-version data safely', () => {
  // Empty raw
  const emptyRes = validateAndSanitizeConfig(null, '2026-10-01');
  assert.strictEqual(emptyRes.valid, false);
  assert.strictEqual(emptyRes.config.version, 1);
  assert.strictEqual(emptyRes.config.slots.length, 0);

  // Unsupported version 2
  const v2Res = validateAndSanitizeConfig({ version: 2 }, '2026-10-01');
  assert.strictEqual(v2Res.valid, false);
  assert.match(v2Res.error ?? '', /Unsupported timetable configuration version/);

  // Corrupt slots: filters valid slots and drops malformed slots
  const mixedConfig = {
    version: 1,
    effectiveFrom: '2026-10-01',
    slots: [
      { id: 'valid_1', day: 'Monday', startTime: '09:00', endTime: '10:00', subject: 'Physiology' },
      { id: 'bad_time', day: 'Monday', startTime: 'invalid', endTime: '10:00', subject: 'Samhita' },
      { id: 'valid_1', day: 'Monday', startTime: '11:00', endTime: '12:00', subject: 'Duplicate ID' }, // duplicate ID dropped
    ],
    holidays: [
      { id: 'h_valid', date: '2026-10-20', name: 'Valid Holiday' },
      { id: 'h_bad', date: '2026-02-30', name: 'Impossible Date' }, // dropped
    ],
  };

  const sanitized = validateAndSanitizeConfig(mixedConfig);
  assert.strictEqual(sanitized.valid, true);
  assert.strictEqual(sanitized.config.slots.length, 1);
  assert.strictEqual(sanitized.config.slots[0].id, 'valid_1');
  assert.strictEqual(sanitized.config.holidays.length, 1);
  assert.strictEqual(sanitized.config.holidays[0].id, 'h_valid');
});

test('9. Storage CRUD operations for timetable slots and holidays', async () => {
  const storage = createMockStorage();

  // 1. Initial load on empty storage returns default config without crashing
  const initial = await loadTimetableConfig(storage);
  assert.strictEqual(initial.isCorrupt, false);
  assert.strictEqual(initial.config.slots.length, 0);

  // 2. Add slot
  const slot1: TimetableSlot = {
    id: 'slot_mon_physio',
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
    subject: 'Physiology',
    professor: 'Satish Sir (Dean)',
  };
  const addRes1 = await addOrUpdateSlot(slot1, storage);
  assert.strictEqual(addRes1.success, true);

  // Verify stored
  const loaded1 = await loadTimetableConfig(storage);
  assert.strictEqual(loaded1.config.slots.length, 1);
  assert.strictEqual(loaded1.config.slots[0].subject, 'Physiology');

  // 3. Overlapping slot rejected
  const overlappingSlot: TimetableSlot = {
    id: 'slot_mon_anatomy',
    day: 'Monday',
    startTime: '09:30',
    endTime: '10:30',
    subject: 'Anatomy',
  };
  const addRes2 = await addOrUpdateSlot(overlappingSlot, storage);
  assert.strictEqual(addRes2.success, false);
  assert.match(addRes2.error ?? '', /Time overlaps with existing Physiology/);

  // 4. Update existing slot
  const updatedSlot: TimetableSlot = {
    ...slot1,
    room: 'Room 101',
  };
  const updateRes = await addOrUpdateSlot(updatedSlot, storage);
  assert.strictEqual(updateRes.success, true);
  const loadedUpdated = await loadTimetableConfig(storage);
  assert.strictEqual(loadedUpdated.config.slots[0].room, 'Room 101');

  // 5. Add holiday
  const holiday1: AcademicHoliday = {
    id: 'hol_diwali',
    date: '2026-11-01',
    name: 'Diwali',
  };
  const addHolRes = await addHoliday(holiday1, storage);
  assert.strictEqual(addHolRes.success, true);

  // Duplicate holiday date rejected
  const duplicateDateHol: AcademicHoliday = {
    id: 'hol_diwali_2',
    date: '2026-11-01',
    name: 'Duplicate Diwali',
  };
  const dupHolRes = await addHoliday(duplicateDateHol, storage);
  assert.strictEqual(dupHolRes.success, false);

  // 6. Set effective-from date
  const effRes = await setEffectiveFromDate('2026-10-15', storage);
  assert.strictEqual(effRes.success, true);
  const loadedEff = await loadTimetableConfig(storage);
  assert.strictEqual(loadedEff.config.effectiveFrom, '2026-10-15');

  // 7. Remove slot and holiday
  const removeSlotRes = await removeSlot('slot_mon_physio', storage);
  assert.strictEqual(removeSlotRes, true);
  const removeHolRes = await removeHoliday('hol_diwali', storage);
  assert.strictEqual(removeHolRes, true);

  const finalConfig = await loadTimetableConfig(storage);
  assert.strictEqual(finalConfig.config.slots.length, 0);
  assert.strictEqual(finalConfig.config.holidays.length, 0);
});

test('10. Corrupt storage data does not overwrite or destroy user data on load', async () => {
  const corruptPayload = '{ "version": 1, "slots": "invalid_json_structure", broken';
  const storage = createMockStorage({
    '@attendance/timetable-v1': corruptPayload,
  });

  // Loading returns safe fallback and flags isCorrupt=true
  const { config, isCorrupt } = await loadTimetableConfig(storage);
  assert.strictEqual(isCorrupt, true);
  assert.strictEqual(config.slots.length, 0);

  // Verify storage was NOT overwritten
  assert.strictEqual(storage.data['@attendance/timetable-v1'], corruptPayload);
});
