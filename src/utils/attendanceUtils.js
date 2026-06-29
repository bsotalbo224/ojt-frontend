// ─── attendanceUtils.js ─────────────────────────────────────────────────────
// Formatting helpers + attendance/time-card computation.

import { analyzeShift, diffMins, diffHours } from './shiftUtils';

// ─── Formatting ───────────────────────────────────────────────────────────

/** "14:30" / "14:30:00" → "2:30 PM". Returns null for empty input. */
export const formatTime12h = (t) => {
  if (!t) return null;
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return null;
  return `${h % 12 || 12}:${mStr} ${h >= 12 ? 'PM' : 'AM'}`;
};

/** Normalize any "HH:MM[:SS]" string to "HH:MM" for use in <input type="time">. */
export const toTimeInput = (t) => {
  if (!t) return '';
  const parts = t.split(':');
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : t;
};

/** Normalize a "HH:MM" input value to "HH:MM:00" for storage. */
export const toTimeStorage = (t) => (t && t.length === 5 ? `${t}:00` : t);

/**
 * Safe percentage calculation — returns 0 when required hours is 0 or missing.
 */
export const safePercent = (completed, required) => {
  const req = Number(required);
  if (!req || req <= 0) return 0;
  return Math.min(Math.round((Number(completed) / req) * 100), 100);
};

// ─── Early-attendance field configuration ──────────────────────────────────

/**
 * Field names on an attendance record that describe an early clock-in.
 *
 * NOTE: No backend contract for "early attendance" fields currently exists
 * anywhere in this codebase — no API response, model, or consumer references
 * `is_early` / `early_status` outside of this file. The names below are a
 * placeholder convention, kept in one place and exported so they can be
 * pointed at whatever the backend actually calls them (or overridden by
 * passing a config into the helpers below) without editing function bodies.
 *
 *   isEarly      — boolean, true if time_in was logged before start_time
 *   earlyStatus  — 'approved' | 'rejected' | 'pending'
 */
export const EARLY_ATTENDANCE_FIELDS = {
  isEarly: 'is_early',
  earlyStatus: 'early_status',
};

const readEarlyFlag = (record, fields) => record?.[fields.isEarly];
const readEarlyStatus = (record, fields) => record?.[fields.earlyStatus];

// ─── Effective time-in (early attendance support) ──────────────────────────

/**
 * Determine which timestamp should count as the start of work for a record.
 *
 * Rules:
 * - Normal attendance (no early flag)         → use the actual `time_in`
 * - Early arrival, approved                   → use the actual `time_in`
 * - Early arrival, rejected or still pending   → use the scheduled `start_time`
 *   (the student doesn't get credit for time logged before their shift
 *   officially starts until that early clock-in is approved)
 *
 * @param {object} record
 * @param {{isEarly: string, earlyStatus: string}} [fields] - field-name
 *   overrides; defaults to EARLY_ATTENDANCE_FIELDS.
 */
export const getEffectiveTimeIn = (record, fields = EARLY_ATTENDANCE_FIELDS) => {
  if (!record) return null;
  if (!readEarlyFlag(record, fields)) return record.time_in;
  if (readEarlyStatus(record, fields) === 'approved') return record.time_in;
  // rejected or pending early arrivals fall back to the scheduled start time
  return record.start_time || record.time_in;
};

/**
 * Minutes a student clocked in ahead of their scheduled start time.
 *
 * Rules:
 * - Not an early arrival (or missing data) → 0
 * - Early arrival → max(0, start_time − time_in) in minutes
 *   e.g. time_in 7:30 AM, start_time 8:00 AM → 30
 *
 * @param {object} record
 * @param {{isEarly: string, earlyStatus: string}} [fields]
 */
export const getEarlyMinutes = (record, fields = EARLY_ATTENDANCE_FIELDS) => {
  if (!record) return 0;
  if (!readEarlyFlag(record, fields)) return 0;
  if (!record.time_in || !record.start_time) return 0;
  return Math.max(0, diffMins(record.time_in, record.start_time));
};

/**
 * Tooltip text for an early-arrival record, matching the approval status.
 *
 * Rules:
 * - Approved (or not an early arrival at all) → null (nothing to disambiguate;
 *   the actual time-in is what's counted)
 * - Pending  → "Actual Time-In: 7:30 AM\nStatus: Pending\nTemporarily Counted As: 8:00 AM"
 * - Rejected → "Actual Time-In: 7:30 AM\nStatus: Rejected\nCounted Time-In: 8:00 AM"
 *
 * @param {object} record
 * @param {{isEarly: string, earlyStatus: string}} [fields]
 */
export const getEarlyTooltip = (record, fields = EARLY_ATTENDANCE_FIELDS) => {
  if (!record) return null;
  if (!readEarlyFlag(record, fields) || !record.time_in) return null;

  const status = readEarlyStatus(record, fields) || 'pending';
  if (status === 'approved') return null;

  const actualTimeIn = formatTime12h(record.time_in);
  const countedTimeIn = formatTime12h(getEffectiveTimeIn(record, fields));
  const statusLabel = status === 'rejected' ? 'Rejected' : 'Pending';
  const countedLabel = status === 'rejected' ? 'Counted Time-In' : 'Temporarily Counted As';

  return `Actual Time-In: ${actualTimeIn}\nStatus: ${statusLabel}\n${countedLabel}: ${countedTimeIn}`;
};

/**
 * Display data for an early-arrival record: how early they clocked in, the
 * approval status, and which time-in is actually being counted toward hours.
 *
 * Returns null when the record isn't an early-arrival case at all (so callers
 * can skip rendering the early-attendance badges entirely).
 *
 * @param {object} record
 * @param {{isEarly: string, earlyStatus: string}} [fields]
 */
export const getEarlyAttendanceInfo = (record, fields = EARLY_ATTENDANCE_FIELDS) => {
  if (!readEarlyFlag(record, fields) || !record?.time_in) return null;

  const status = readEarlyStatus(record, fields) || 'pending'; // 'approved' | 'rejected' | 'pending'
  const earlyMins = record.start_time ? getEarlyMinutes(record, fields) : null;
  const countedTimeIn = getEffectiveTimeIn(record, fields);
  const isCounted = status === 'approved';

  return {
    status,
    earlyMins,
    actualTimeIn: record.time_in,
    countedTimeIn,
    isCounted,
    // Label differs by status per the UX spec: rejected shows "Counted
    // Time-In", pending shows "Temporarily Counted As".
    countedLabel: status === 'pending' ? 'Temporarily Counted As' : 'Counted Time-In',
    tooltip: getEarlyTooltip(record, fields),
  };
};

// ─── Total hours ────────────────────────────────────────────────────────────

/**
 * Total hours = (effective time_in → time_out) − lunch + OT.
 * Auto-deduct 1 hr for long shifts without logged lunch.
 * Skip deduction for half-day shifts.
 *
 * Flagged records (location_status === 'flagged') are always excluded and
 * count as 0 hours, regardless of any other field on the record.
 *
 * ALWAYS returns a number (never a string placeholder like '—'). Any
 * "no hours computable" case — missing time_in/time_out, flagged record,
 * or a net-zero result — returns 0. Display formatting (e.g. showing an
 * em dash for 0) is the caller's responsibility.
 *
 * @param {object} rec
 * @param {{isEarly: string, earlyStatus: string}} [fields]
 * @returns {number}
 */
export const computeTotalHours = (rec, fields = EARLY_ATTENDANCE_FIELDS) => {
  if (rec?.location_status === 'flagged') return 0;

  const effectiveTimeIn = getEffectiveTimeIn(rec, fields);
  if (!effectiveTimeIn || !rec?.time_out) return 0;

  const startT = rec.start_time || null;
  const endT   = rec.end_time   || null;
  const { isHalfDay } = analyzeShift(startT, endT);

  const workHrs  = diffHours(effectiveTimeIn, rec.time_out);
  const lunchHrs = diffHours(rec.lunch_break_start, rec.lunch_break_end);
  const otHrs    = diffHours(rec.ot_time_in, rec.ot_time_out);

  let deduct = 0;
  if (!isHalfDay) {
    if (lunchHrs > 0)      deduct = lunchHrs;
    else if (workHrs >= 5) deduct = 1;
  }

  const total = Math.max(0, workHrs - deduct) + otHrs;
  return total > 0 ? parseFloat(total.toFixed(2)) : 0;
};

// ─── Attendance status (shift-aware) ───────────────────────────────────────

/**
 * Null-safe: returns the "No Record" status for null/undefined input instead
 * of throwing, since callers may pass through records that haven't loaded
 * yet or attendance days with no record at all.
 */
export const getAttendanceStatus = (rec) => {
  if (!rec)
    return { label: 'No Record',  bg: '#f3f4f6', border: '#e5e7eb', text: '#9ca3af' };

  if (rec.location_status === 'flagged')
    return { label: 'Excluded',  bg: '#fef2f2', border: '#fecaca', text: '#dc2626' };

  const { isNightShift } = analyzeShift(rec.start_time, rec.end_time);
  const breakLabel = isNightShift ? 'On Meal Break' : 'On Break';

  if (!rec.time_in)
    return { label: 'No Record',  bg: '#f3f4f6', border: '#e5e7eb', text: '#9ca3af' };
  if (rec.lunch_break_start && !rec.lunch_break_end)
    return { label: breakLabel,   bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' };
  if (rec.ot_time_in && !rec.ot_time_out)
    return { label: 'OT Active',  bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' };
  if (!rec.time_out)
    return { label: 'Working',    bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' };
  return       { label: 'Completed', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' };
};