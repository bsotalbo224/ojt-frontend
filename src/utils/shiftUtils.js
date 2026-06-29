// ─── shiftUtils.js ──────────────────────────────────────────────────────────
// Pure helpers for reasoning about shift timing: minute math, overnight-safe
// diffs, and classifying a schedule as Day / Night / Half Day.

/**
 * Parse a "HH:MM" or "HH:MM:SS" string into minutes since midnight.
 * Returns null if the input is missing or unparseable.
 */
export const toMins = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return isNaN(h) || isNaN(m) ? null : h * 60 + m;
};

/**
 * Classify a scheduled start/end time pair.
 * - isNightShift: end time is numerically before start time (crosses midnight)
 * - isHalfDay: scheduled shift length is under 5 hours
 * - shiftType: human-readable label, precedence Half Day > Night Shift > Day Shift
 */
export const analyzeShift = (startTime, endTime) => {
  const s = toMins(startTime);
  const e = toMins(endTime);
  if (s == null || e == null) return { isNightShift: false, isHalfDay: false, shiftType: 'Day Shift' };
  const isNightShift = e < s;
  const shiftMins    = isNightShift ? (1440 - s + e) : (e - s);
  const isHalfDay    = shiftMins < 300;
  let shiftType = 'Day Shift';
  if (isHalfDay)         shiftType = 'Half Day';
  else if (isNightShift) shiftType = 'Night Shift';
  return { isNightShift, isHalfDay, shiftType };
};

/**
 * Overnight-safe minutes difference between two "HH:MM[:SS]" times.
 * If end <= start, assume end crossed midnight and add 24 hrs.
 */
export const diffMins = (start, end) => {
  if (!start || !end) return 0;
  let s = toMins(start), e = toMins(end);
  if (s == null || e == null) return 0;
  if (e <= s) e += 1440; // cross-midnight
  return Math.max(0, e - s);
};

/** Same as diffMins but expressed in hours, rounded to 2 decimal places. */
export const diffHours = (start, end) => parseFloat((diffMins(start, end) / 60).toFixed(2));