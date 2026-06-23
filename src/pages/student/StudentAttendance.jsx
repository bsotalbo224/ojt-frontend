import { useState, useEffect, useRef } from 'react';
import {
  Calendar, Clock, Download, BookOpen, CalendarDays, Timer,
  LogIn, LogOut, Coffee, UtensilsCrossed, Moon, Sunrise,
} from 'lucide-react';
import { getStudentAttendanceHistory, getStudentAttendanceHistoryExport } from '../../api/attendance';

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
const formatTime = (t) => {
  if (!t) return null;
  const [h, m, s = 0] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, s);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const formatDateLong = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
    .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const toMs = (t) => {
  if (!t) return null;
  const [h, m, s = 0] = t.split(':').map(Number);
  return (h * 3600 + m * 60 + s) * 1000;
};

const msDiff = (start, end) => {
  const s = toMs(start);
  const e = toMs(end);

  if (s == null || e == null) return null;

  if (e >= s) {
    return e - s;
  }

  // Overnight shift (crosses midnight)
  return (24 * 60 * 60 * 1000 - s) + e;
};

const msToHrs = (ms) => (ms == null ? 0 : ms / 3_600_000);

const toMins = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return isNaN(h) ? null : h * 60 + m;
};

const timeRange = (start, end) => {
  const s = formatTime(start), e = formatTime(end);
  if (s && e) return `${s} → ${e}`;
  if (s)      return `${s} → In Progress`;
  return null;
};

const cssVar = (name, fallback = '22 163 74') => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  return raw.split(/\s+/).map(Number);
};

// Stable, collision-resistant identity for an attendance record. Prefers
// the real DB id; falls back to a composite of date + time_in + time_out
// for records that somehow lack one (never just `date` alone, since
// multiple records can share a date). Used for both React `key`s and the
// pagination dedupe logic so the two stay perfectly in sync.
const getRecordKey = (r) =>
  r.attendance_id ??
  r.id ??
  `${r.date}-${r.time_in}-${r.time_out}`;

/* ═══════════════════════════════════════════════════════
   TIME-IN vs SCHEDULE COMPARISON
   Determines whether a given time_in is "earlier than schedule".
   - Day / half-day shifts: simple minute comparison.
   - Night shifts: a time_in is only treated as "early" when it falls
     in the same evening window as start_time. A small clock value
     (early-morning hours) when start_time is in the evening means the
     time_in belongs to the wraparound side of the shift, not an early
     check-in, so it is NOT flagged as early.
═══════════════════════════════════════════════════════ */
const isEarlyTimeIn = (timeInStr, startStr, isNightShift) => {
  const ti = toMins(timeInStr);
  const st = toMins(startStr);
  if (ti == null || st == null) return false;

  if (!isNightShift) return ti < st;

  if (ti >= st) return false; // on/after scheduled start → not early
  // Night shift: ti < st here. Only treat as early if still in the
  // same "evening" window as the scheduled start, not the wraparound
  // early-morning hours on the other side of midnight.
  if (st >= 720 && ti < 720) return false;
  return true;
};

/* ═══════════════════════════════════════════════════════
   SCHEDULE ANALYSIS
   Always derived from record.start_time / record.end_time —
   never influenced by early_attendance or early_status.
═══════════════════════════════════════════════════════ */
const analyzeRecord = (r) => {
  // Always use the official schedule times regardless of early_attendance / early_status
  const s = toMins(r.start_time);
  const e = toMins(r.end_time);
  if (s == null || e == null) return { isNightShift: false, isHalfDay: false };
  const isNightShift = e < s;
  const shiftMins    = isNightShift ? (1440 - s + e) : (e - s);
  const isHalfDay    = shiftMins < 300;
  return { isNightShift, isHalfDay };
};

/* ═══════════════════════════════════════════════════════
   DISPLAY TIME IN
   Rules:
   1. No time_in → null
   2. Approved early attendance (early_attendance && early_status === 'approved')
      → show the actual (early) time_in
   3. Otherwise → compare time_in against start_time:
        - If time_in is earlier than the schedule (rejected / pending /
          no request, or just early minutes with no request at all)
          → show start_time instead (early minutes don't count)
        - Else → show the actual time_in
   Supports day, half-day, and night shifts via analyzeRecord/isEarlyTimeIn.
═══════════════════════════════════════════════════════ */
const getDisplayTimeIn = (record) => {
  if (!record?.time_in) return null;

  if (record.early_attendance && record.early_status === 'approved') {
    return record.time_in;
  }

  if (!record.start_time) return record.time_in;

  const { isNightShift } = analyzeRecord(record);
  return isEarlyTimeIn(record.time_in, record.start_time, isNightShift)
    ? record.start_time
    : record.time_in;
};

/* ═══════════════════════════════════════════════════════
   DYNAMIC WORKFLOW BUILDER
═══════════════════════════════════════════════════════ */
const buildWorkflow = (r) => {
  const { isNightShift, isHalfDay } = analyzeRecord(r);
  const breakLabel = isNightShift ? 'Meal' : 'Lunch';

  const steps = [
    { key: 'time_in',  label: 'Time In',  Icon: LogIn,  color: '#10b981' },
  ];

  if (!isHalfDay) {
    steps.push(
      { key: 'lunch_break_start', label: `${breakLabel} Start`, Icon: Coffee,          color: '#f59e0b' },
      { key: 'lunch_break_end',   label: `${breakLabel} End`,   Icon: UtensilsCrossed, color: '#f97316' },
    );
  }

  steps.push(
    { key: 'time_out', label: 'Time Out', Icon: LogOut, color: '#ef4444' },
  );

  if (r.ot_time_in || r.ot_time_out) {
    steps.push(
      { key: 'ot_time_in',  label: 'OT Start', Icon: Moon,    color: '#8b5cf6' },
      { key: 'ot_time_out', label: 'OT End',   Icon: Sunrise, color: '#6366f1' },
    );
  }

  return { steps, isNightShift, isHalfDay, breakLabel };
};

/* ═══════════════════════════════════════════════════════
   HOURS CALCULATION (schedule-aware)
═══════════════════════════════════════════════════════ */
const computeTotalHours = (r) => {
  if (!r?.time_in || !r?.time_out) return 0;
  const { isHalfDay } = analyzeRecord(r);

  // Use the schedule-aware effective time-in (not the raw DB time_in) so
  // rejected / pending / unapproved early clock-ins never earn extra hours.
  const effectiveTimeIn = getDisplayTimeIn(r);

  const workMs  = msDiff(effectiveTimeIn, r.time_out) ?? 0;
  const lunchMs = msDiff(r.lunch_break_start, r.lunch_break_end);
  const otMs    = msDiff(r.ot_time_in, r.ot_time_out) ?? 0;

  let deductMs = 0;
  if (!isHalfDay) {
    if (lunchMs != null) deductMs = lunchMs;
    else if (msToHrs(workMs) >= 5) deductMs = 3_600_000;
  }

  const total = Math.max(0, msToHrs(workMs) - msToHrs(deductMs)) + msToHrs(otMs);
  return Math.round(total * 10) / 10;
};

/* ═══════════════════════════════════════════════════════
   DESKTOP TABLE CELL
═══════════════════════════════════════════════════════ */
const RangeCell = ({ start, end, color }) => {
  const range = timeRange(start, end);
  if (!range && !start) return <span className="text-gray-300 text-sm">—</span>;
  const isDone = !!(start && end);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 whitespace-nowrap"
      style={{ background: isDone ? `${color}10` : '#fefce8', border: `1px solid ${isDone ? `${color}30` : '#fde68a'}`, color: '#374151' }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: isDone ? color : '#eab308' }} />
      {range}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════
   SCHEDULE CELL — always shows official start_time → end_time
   regardless of early_attendance or early_status
═══════════════════════════════════════════════════════ */
const ScheduleCell = ({ record }) => {
  const start = formatTime(record.start_time);
  const end   = formatTime(record.end_time);

  if (!start && !end) return <span className="text-gray-300 text-sm">—</span>;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 whitespace-nowrap"
      style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#374151' }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-400" />
      {start && end ? `${start} → ${end}` : start ?? end ?? '—'}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════
   TIME OUT CELL — desktop badge, styled like the Time In badge
═══════════════════════════════════════════════════════ */
const TimeOutCell = ({ record }) => {
  if (!record.time_out) return <span className="text-gray-300 text-sm">—</span>;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 whitespace-nowrap"
      style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#374151' }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-red-500" />
      {formatTime(record.time_out)}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════
   COMPACT DESKTOP TABLE BADGES
   Lightweight, single-line badges for the slimmed-down desktop table.
   Kept visually distinct (green / red / purple) but much smaller than
   the original RangeCell/ScheduleCell/TimeOutCell components above,
   which are still used by the mobile workflow card and are left as-is.
═══════════════════════════════════════════════════════ */
const CompactTimeBadge = ({ value, color, bg, border }) => {
  if (!value) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-2 py-1 whitespace-nowrap"
      style={{ background: bg, border: `1px solid ${border}`, color: '#374151' }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      {formatTime(value)}
    </span>
  );
};

const CompactOtBadge = ({ otIn, otOut }) => {
  if (!otIn && !otOut) return <span className="text-gray-300 text-xs">—</span>;
  const s = formatTime(otIn);
  const e = formatTime(otOut);
  const label = s && e ? `${s} → ${e}` : (s || e || '—');
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-2 py-1 whitespace-nowrap"
      style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#374151' }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-violet-500" />
      {label}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════
   MOBILE WORKFLOW CARD (dynamic)
═══════════════════════════════════════════════════════ */
const MobileWorkflowCard = ({ record }) => {
  const { steps } = buildWorkflow(record);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
      {steps.map((step, i) => {
        // Time In uses the schedule-aware display value; every other
        // step still reads its raw value directly from the record.
        const val    = step.key === 'time_in' ? getDisplayTimeIn(record) : record[step.key];
        const isDone = !!val;
        const isOt   = step.key.startsWith('ot');

        return (
          <div key={step.key}
            className="flex items-center gap-3 px-3 py-2.5 transition-colors"
            style={{ background: isDone ? `${step.color}08` : '#fafafa', borderBottom: i < steps.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: isDone ? `${step.color}18` : '#f3f4f6', border: `1px solid ${isDone ? `${step.color}35` : '#e5e7eb'}` }}>
              <step.Icon className="w-3.5 h-3.5" style={{ color: isDone ? step.color : '#9ca3af' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{step.label}</span>
                {isOt && <span className="text-[8px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded-full font-semibold">opt</span>}
              </div>
              <p className={`text-xs font-bold tabular-nums ${isDone ? 'text-gray-800' : 'text-gray-400'}`}>
                {formatTime(val) ?? '—'}
              </p>
            </div>
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: isDone ? step.color : '#e5e7eb' }} />
          </div>
        );
      })}

      {/* Schedule row — always visible, never hidden by early_status */}
      <div className="flex items-center gap-3 px-3 py-2.5"
        style={{ background: '#f0fdf4', borderTop: '1px solid #f3f4f6' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: '#dcfce7', border: '1px solid #bbf7d0' }}>
          <Clock className="w-3.5 h-3.5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Schedule</span>
          <p className="text-xs font-bold text-gray-800 tabular-nums">
            {record.start_time && record.end_time
              ? `${formatTime(record.start_time)} → ${formatTime(record.end_time)}`
              : '—'}
          </p>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   SHIFT TYPE BADGE
═══════════════════════════════════════════════════════ */
const ShiftBadge = ({ isNightShift, isHalfDay }) => {
  if (isHalfDay)    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#fefce8', border: '1px solid #fde68a', color: '#a16207' }}>Half Day</span>;
  if (isNightShift) return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6d28d9' }}>Night</span>;
  return null;
};

/* ═══════════════════════════════════════════════════════
   PDF EXPORT — Two-Column Masonry Layout (A4 portrait)

   Every month block (or, for months that exceed maxRowsPerBlock,
   every <=15-row chunk of one) renders at the SAME half-page width,
   but blocks are placed independently with true masonry packing:
   each block goes into whichever of the two columns (left/right) is
   currently shorter, so it stacks directly under whatever's already
   there — not paired permanently with a same-index neighbor.

     LEFT           RIGHT
     Dec 2025       Jan 2026
     Feb 2026       Mar 2026 (Part 1 of 2)
     Apr 2026       Mar 2026 (Part 2 of 2)
     ...

   A tiny 1-row December block no longer leaves dead space under
   itself just because it happened to be paired with a tall January
   block — February fills that space instead. A new page only starts
   once a block would overflow the column it's about to enter.
═══════════════════════════════════════════════════════ */

// ---- Layout constants (mm, A4 portrait) ----
const PDF_MARGIN    = 10;
const PDF_PAGE_W     = 210;
const PDF_PAGE_H     = 297;
const PDF_CONTENT_W  = PDF_PAGE_W - PDF_MARGIN * 2;
const PDF_USABLE_H   = PDF_PAGE_H - PDF_MARGIN * 2;
const PDF_PAIR_GAP   = 6;                                   // horizontal gap between the left and right columns
const PDF_HALF_W     = (PDF_CONTENT_W - PDF_PAIR_GAP) / 2;   // every block always renders at this width now
const PDF_ROW_GAP_Y  = 4;                                    // vertical gap between two blocks stacked in the same column
const PDF_ROW_H            = 3.6;
const PDF_TABLE_HEAD_H     = 4;
const PDF_BLOCK_BOTTOM_PAD = 1.3;
// Header text block (school/title/student/company/month) before the table
// starts. Must stay in sync with the literal cy increments inside
// renderDTRBlock() — if you change one, change the other.
const PDF_HEADER_TEXT_H    = 22.3; // 3 + 3 + 3.6 + 2.6 + 2.8 + 2.8 + 3.0 + 1.5
const PDF_HEADER_SECTION_H = PDF_HEADER_TEXT_H + PDF_TABLE_HEAD_H; // 26.3

// Final, fixed column set — exactly 5 columns, no more.
const PDF_COLUMNS = [
  { key: 'date',     w: 12 },
  { key: 'timeIn',   w: 10 },
  { key: 'timeOut',  w: 10 },
  { key: 'ot',       w: 18 },
  { key: 'hours',    w: 8  },
];

const PDF_COLUMN_LABELS = {
  date:    'Date',
  timeIn:  'In',
  timeOut: 'Out',
  ot:      'OT',
  hours:   'Hrs',
};

// Compact "6:30a / 5:00p" time format — keeps the narrow side-by-side
// columns from wrapping onto a second line.
const formatTimeShort = (t) => {
  if (!t) return '—';
  const [h, m, s = 0] = t.split(':').map(Number);
  const d = new Date(); d.setHours(h, m, s);
  return d
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(' ', '')
    .replace('AM', 'a')
    .replace('PM', 'p');
};

// "5:30p - 6:00p" when both OT bounds exist, otherwise an em-dash.
// Collapsing OT In/Out into a single column halves the column count
// without losing any information — half an OT pair on its own isn't
// meaningful anyway.
const formatOtRange = (otIn, otOut) =>
  (otIn && otOut) ? `${formatTimeShort(otIn)} - ${formatTimeShort(otOut)}` : '—';

// "Mon 5" — the month is already shown in the block header, so the date
// cell itself only needs the weekday + day number.
const formatDayCell = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}`;
};

/* ---- groupAttendanceByMonth: chronological month buckets ---- */
const groupAttendanceByMonth = (history) => {
  const sorted = [...history].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });

  const map = new Map();
  sorted.forEach((r) => {
    let key = 'unspecified', label = 'Unspecified Date';
    if (r.date) {
      const d = new Date(r.date + (r.date.includes('T') ? '' : 'T00:00:00'));
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (!map.has(key)) map.set(key, { key, label, records: [] });
    map.get(key).records.push(r);
  });

  return Array.from(map.values());
};

/* ---- splitLargeMonths: cap every block at maxRows so a single oversized
        month becomes several <=maxRows chunks that can each pair
        side-by-side with any other block in the grid ---- */
const splitLargeMonths = (monthGroups, maxRows = 15) => {
  const blocks = [];
  monthGroups.forEach(({ label, records }) => {
    if (records.length <= maxRows) {
      blocks.push({ label, records, rowCount: records.length });
      return;
    }
    const totalParts = Math.ceil(records.length / maxRows);
    for (let i = 0; i < totalParts; i++) {
      const chunk = records.slice(i * maxRows, (i + 1) * maxRows);
      blocks.push({
        label: `${label} (Part ${i + 1} of ${totalParts})`,
        records: chunk,
        rowCount: chunk.length,
      });
    }
  });
  return blocks;
};

/* ---- calculateBlockHeight: must mirror renderDTRBlock's cy increments
        exactly, so pagination never overflows a page ---- */
const calculateBlockHeight = (rowCount) =>
  PDF_HEADER_SECTION_H + rowCount * PDF_ROW_H + PDF_BLOCK_BOTTOM_PAD;

/* ---- getBlockColumns: scales the 5 fixed-weight columns to the
        half-page width every block now renders at ---- */
const getBlockColumns = (x, width) => {
  const totalWeight = PDF_COLUMNS.reduce((sum, c) => sum + c.w, 0);
  let curX = x;
  return PDF_COLUMNS.map((c) => {
    const colW  = (c.w / totalWeight) * width;
    const col   = { key: c.key, label: PDF_COLUMN_LABELS[c.key], x: curX, colW };
    curX += colW;
    return col;
  });
};

/* ---- renderDTRBlock: draws one compact-header + 5-column table block
        at (x, y) and returns the y position right below it ---- */
const renderDTRBlock = (doc, block, x, y, width, ctx) => {
  const { c600, c50, c100, schoolName, studentName, companyName } = ctx;
  let cy = y;

  doc.setDrawColor(...c600); doc.setLineWidth(0.5);
  doc.line(x, cy, x + width, cy); cy += 3;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(60, 60, 60);
  doc.text(schoolName, x, cy); cy += 3;

  doc.setFontSize(9.5); doc.setTextColor(...c600);
  doc.text('DAILY TIME RECORD', x, cy); cy += 3.6;

  doc.setDrawColor(...c100); doc.setLineWidth(0.25);
  doc.line(x, cy, x + width, cy); cy += 2.6;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(50, 50, 50);
  doc.text(`Name: ${studentName}`, x, cy); cy += 2.8;
  doc.text(`Company: ${companyName}`, x, cy); cy += 2.8;
  doc.setFont('helvetica', 'bold');
  doc.text(`Month: ${block.label}`, x, cy); cy += 3.0;

  doc.setDrawColor(...c600); doc.setLineWidth(0.4);
  doc.line(x, cy, x + width, cy); cy += 1.5;

  const cols     = getBlockColumns(x, width);
  const tableTop = cy;

  doc.setFillColor(...c600);
  doc.rect(x, cy, width, PDF_TABLE_HEAD_H, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.2); doc.setTextColor(255, 255, 255);
  cols.forEach((col) => doc.text(col.label, col.x + 1, cy + 2.9));
  cy += PDF_TABLE_HEAD_H;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8);
  block.records.forEach((r, idx) => {
    if (idx % 2 === 0) { doc.setFillColor(...c50); doc.rect(x, cy, width, PDF_ROW_H, 'F'); }

    const effectiveTimeIn = getDisplayTimeIn(r);
    const total = computeTotalHours(r);

    const values = {
      date:    formatDayCell(r.date),
      timeIn:  formatTimeShort(effectiveTimeIn),
      timeOut: formatTimeShort(r.time_out),
      ot:      formatOtRange(r.ot_time_in, r.ot_time_out),
      hours:   total > 0 ? `${total}h` : '—',
    };

    doc.setTextColor(30, 30, 30);
    cols.forEach((col) => doc.text(values[col.key], col.x + 1, cy + PDF_ROW_H - 1.1));

    cy += PDF_ROW_H;
  });

  const tableBottom = cy;

  // Grid lines — gives the table a formal, form-like appendix look
  doc.setDrawColor(...c100); doc.setLineWidth(0.15);
  cols.forEach((col) => doc.line(col.x, tableTop, col.x, tableBottom));
  doc.setDrawColor(...c600); doc.setLineWidth(0.3);
  doc.line(x + width, tableTop, x + width, tableBottom);
  doc.line(x, tableBottom, x + width, tableBottom);

  cy += PDF_BLOCK_BOTTOM_PAD;
  return cy;
};

/* ---- buildExportPages: TRUE two-column masonry packing.
        Each block is placed independently — not permanently paired with
        a neighbor — into whichever of the two column cursors (leftY /
        rightY) is currently shorter. That's what lets a tiny 1-row
        December block sit directly above a short February block in the
        SAME column, while a taller January block fills the other column
        on its own timeline, instead of every block being forced to share
        a row height with whatever block happens to be next in the list.
        A block only triggers a new page when it would overflow the
        usable page height in the column it's about to go into; both
        column cursors reset to 0 for the new page. ---- */
const buildExportPages = (blocks) => {
  const pages = [];
  let currentPage = null;
  let leftY = 0;
  let rightY = 0;

  const startNewPage = () => {
    currentPage = { blocks: [] };
    pages.push(currentPage);
    leftY = 0;
    rightY = 0;
  };

  startNewPage();

  blocks.forEach((block) => {
    const height = calculateBlockHeight(block.rowCount);

    // Pick the shorter column (ties go left, for a stable left-to-right flow).
    let useLeft = leftY <= rightY;
    let colY    = useLeft ? leftY : rightY;

    // If placing it in its column would overflow the current page, start a
    // fresh page (both columns reset to 0) before placing it.
    if (colY + height > PDF_USABLE_H && (leftY > 0 || rightY > 0)) {
      startNewPage();
      useLeft = leftY <= rightY;
      colY    = useLeft ? leftY : rightY;
    }

    const x = useLeft ? PDF_MARGIN : PDF_MARGIN + PDF_HALF_W + PDF_PAIR_GAP;
    const y = PDF_MARGIN + colY;

    currentPage.blocks.push({ block, x, y, width: PDF_HALF_W, height });

    // Advance just this column's cursor — the other column is untouched,
    // which is the whole point: short blocks don't inherit a tall
    // neighbor's height.
    if (useLeft) leftY = colY + height + PDF_ROW_GAP_Y;
    else         rightY = colY + height + PDF_ROW_GAP_Y;
  });

  return pages;
};

const exportDTR = async (history, totalDays, totalHours) => {
  const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const c600 = cssVar('--primary-600');
  const c50  = cssVar('--primary-50');
  const c100 = cssVar('--primary-100');

  // NOTE: student/company/school names aren't part of the attendance
  // history payload today — falls back gracefully if a record happens to
  // carry them, otherwise prints a placeholder. Wire in real values here
  // once those fields are available on the record (or passed as props).
  const ctx = {
    c600, c50, c100,
    schoolName:  history[0]?.school_name  || 'OJT Attendance System',
    studentName: history[0]?.student_name || history[0]?.full_name || '—',
    companyName: history[0]?.company_name || history[0]?.company  || '—',
  };

  const monthGroups = groupAttendanceByMonth(history);
  const blocks       = splitLargeMonths(monthGroups, 15);
  const pages         = buildExportPages(blocks);

  pages.forEach((page, idx) => {
    if (idx > 0) doc.addPage();

    page.blocks.forEach(({ block, x, y, width }) => {
      renderDTRBlock(doc, block, x, y, width, ctx);
    });
  });

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...c600);
  doc.text(`Days Logged: ${totalDays}   |   Total Hours: ${totalHours} hrs`, PDF_MARGIN, PDF_PAGE_H - 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(150, 150, 150);
  doc.text('Generated from the OJT Attendance System  •  For official use only', PDF_PAGE_W / 2, PDF_PAGE_H - 2.5, { align: 'center' });

  const today = new Date().toISOString().slice(0, 10);
  doc.save(`Daily_Time_Record_${today}.pdf`);
};

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
const ATTENDANCE_PAGE_LIMIT = 15;

export default function StudentAttendance() {
  const [loading, setLoading]                     = useState(true);
  const [attendanceHistory, setAttendanceHistory] = useState([]);

  // Pagination / infinite scroll
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Real totals — always computed from the FULL record set via the
  // export endpoint, never from just the currently-loaded page. Backs
  // the summary cards and the desktop/mobile footers.
  const [summary, setSummary]               = useState({ totalDays: 0, totalHours: 0 });
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Guards the export button against double-clicks while the full
  // export fetch + PDF generation are in flight.
  const [isExporting, setIsExporting] = useState(false);

  const observerRef = useRef(null);
  const sentinelRef = useRef(null);

  // Mirrors `page` synchronously so fetchNextPage always computes the
  // next page off the latest value, even if the IntersectionObserver
  // fires more than once before React has re-rendered with the new
  // `page` state. Prevents duplicate "page+1" requests.
  const pageRef = useRef(1);

  useEffect(() => {
    fetchInitialAttendance();
    fetchSummary();
  }, []);

  // Infinite scroll observer. Re-attached whenever the conditions it
  // closes over change so the intersection callback always sees fresh
  // state, and the sentinel itself only exists in the DOM while there's
  // more to load.
  useEffect(() => {
    if (!sentinelRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );

    observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, loading]);

  // Belt-and-suspenders cleanup on unmount.
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const fetchInitialAttendance = async () => {
    setLoading(true);
    try {
      const data = await getStudentAttendanceHistory({ page: 1, limit: ATTENDANCE_PAGE_LIMIT });
      if (!data.success) { console.error('API error:', data); return; }
      setAttendanceHistory(data.history);
      pageRef.current = 1;
      setPage(1);
      setHasMore(data.pagination?.hasMore ?? false);
    } catch (err) {
      console.error('Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNextPage = async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    // Remember where we were so a failed request can roll the ref back
    // instead of permanently advancing past an unfetched page.
    const previousPage = pageRef.current;
    try {
      // Compute off the ref (always current), not the `page` state
      // closure, so two rapid observer firings can't both resolve to
      // the same "next page" and double-request it.
      const nextPage = previousPage + 1;
      pageRef.current = nextPage;

      const data = await getStudentAttendanceHistory({ page: nextPage, limit: ATTENDANCE_PAGE_LIMIT });
      if (!data.success) {
        console.error('API error:', data);
        // API-level failure (no throw) — roll back so the next retry
        // re-requests this same page instead of skipping it.
        pageRef.current = previousPage;
        return;
      }

      setAttendanceHistory((prev) => {
        const merged = [...prev, ...data.history];
        // O(n) dedupe via Map, keyed the same way as the rendered React
        // `key`s (getRecordKey), so identity is consistent everywhere.
        // Map.set on a repeated key keeps the key's original insertion
        // position, so first-occurrence ordering is preserved.
        const deduped = new Map();
        merged.forEach((item) => deduped.set(getRecordKey(item), item));
        return Array.from(deduped.values());
      });

      setPage(nextPage);
      setHasMore(data.pagination?.hasMore ?? false);
    } catch (err) {
      console.error('Fetch more failed:', err);
      // Thrown failure (network error, etc.) — roll back for the same reason.
      pageRef.current = previousPage;
    } finally {
      setLoadingMore(false);
    }
  };

  // Pulls the FULL attendance history once (independent of pagination)
  // so the summary cards/footers always reflect real totals, not just
  // whatever page(s) happen to be loaded into attendanceHistory.
  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const data = await getStudentAttendanceHistoryExport();
      if (!data.success) { console.error('Summary fetch error:', data); return; }
      const fullHistory = data.history;
      const hours = fullHistory.reduce((sum, r) => sum + computeTotalHours(r), 0);
      const days  = fullHistory.filter((r) => r.time_in && r.time_out).length;
      setSummary({ totalDays: days, totalHours: Math.round(hours * 10) / 10 });
    } catch (err) {
      console.error('Summary fetch failed:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Export always pulls the complete history fresh from the export
  // endpoint — never the paginated attendanceHistory state — so the PDF
  // is never missing rows that haven't been scrolled into view yet.
  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const exportData = await getStudentAttendanceHistoryExport();
      if (!exportData.success) { console.error('Export fetch error:', exportData); return; }

      const exportHistory = exportData.history;
      const exportTotalHours   = exportHistory.reduce((sum, r) => sum + computeTotalHours(r), 0);
      const exportRoundedTotal = Math.round(exportTotalHours * 10) / 10;
      const exportTotalDays    = exportHistory.filter((r) => r.time_in && r.time_out).length;

      await exportDTR(exportHistory, exportTotalDays, exportRoundedTotal);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="min-h-screen p-4 sm:p-6 lg:p-8"
      style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.4), rgb(var(--primary-50)))` }}
    >
      <style>{`
        .dtr-row { transition: background 0.15s; }
        .dtr-row:hover { background: rgb(var(--primary-200) / 0.3) !important; }
        .export-btn { transition: all 0.15s ease; }
        .export-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgb(var(--primary-600) / 0.2); }
        .summary-card { transition: box-shadow 0.15s; }
        .summary-card:hover { box-shadow: 0 8px 24px rgb(var(--primary-600) / 0.12); }
      `}</style>

      <div className="max-w-7xl mx-auto">

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-sm" style={{ backgroundColor: `rgb(var(--primary-600))` }}>
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: `rgb(var(--primary-600))` }}>Official Document</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">Daily Time Record</h1>
          <p className="text-gray-600">Schedule-aware OJT attendance log with dynamic workflow support</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-lg p-12 mb-8" style={{ border: `1px solid rgb(var(--primary-100))` }}>
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full animate-spin" style={{ border: `4px solid rgb(var(--primary-200))`, borderTopColor: `rgb(var(--primary-600))` }} />
              <p className="text-gray-600 font-medium">Loading attendance records…</p>
            </div>
          </div>
        )}

        {!loading && (
          <>
            {/* Summary Cards — driven by `summary`, which reflects the FULL
                record set fetched via the export endpoint, not the paginated
                attendanceHistory state. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {[
                { Icon: CalendarDays, label: 'Days Logged',  value: summaryLoading ? '—' : summary.totalDays,                 sub: 'completed work days' },
                { Icon: Clock,        label: 'Total Hours',  value: summaryLoading ? '—' : `${summary.totalHours} hrs`,       sub: 'hours rendered'      },
              ].map(({ Icon, label, value, sub }) => (
                <div key={label} className="summary-card bg-white rounded-2xl shadow-lg p-6 flex items-center gap-5" style={{ border: `1px solid rgb(var(--primary-100))` }}>
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), rgb(var(--primary-100)))`, border: `1px solid rgb(var(--primary-200))` }}>
                    <Icon className="w-7 h-7" style={{ color: `rgb(var(--primary-600))` }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
                    <p className="text-4xl font-bold text-gray-800 leading-none">{value}</p>
                    <p className="text-xs text-gray-500 mt-1">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden" style={{ border: `1px solid rgb(var(--primary-100))` }}>

              {/* Header bar */}
              <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Attendance Log</h2>
                  <p className="text-sm text-gray-600 mt-1">Complete work attendance history — supports day, night, and half-day shifts</p>
                </div>
                <div className="hidden sm:flex items-center gap-3 flex-wrap">
                  {[
                    { Icon: LogIn,  label: 'Time In/Out', color: '#10b981' },
                    { Icon: Coffee, label: 'Break',        color: '#f59e0b' },
                    { Icon: Moon,   label: 'Overtime',     color: '#8b5cf6' },
                  ].map(({ Icon, label, color }) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Icon className="w-3.5 h-3.5" style={{ color }} /><span>{label}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="export-btn flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: `rgb(var(--primary-600))` }}
                  onMouseEnter={(e) => { if (!isExporting) e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`; }}
                  onMouseLeave={(e) => { if (!isExporting) e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`; }}
                >
                  <Download className="w-4 h-4" />{isExporting ? 'Exporting…' : 'Export DTR'}
                </button>
              </div>

              {/* Empty state — guarded against false flashes. Without the
                  extra conditions, a brief moment where attendanceHistory
                  is still [] during a loading transition could flash
                  "No attendance records yet" before real data lands. */}
              {!loading && attendanceHistory.length === 0 && !loadingMore && (
                <div className="p-12 text-center">
                  <Calendar className="w-16 h-16 mx-auto mb-4" style={{ color: `rgb(var(--primary-300))` }} />
                  <p className="text-gray-600 font-medium mb-2">No attendance records yet</p>
                  <p className="text-sm text-gray-500">Your DTR entries will appear here once you start logging work attendance.</p>
                </div>
              )}

              {/* Desktop Table — compact attendance-sheet style.
                  Columns: Date | Time In | Time Out | OT | Hours.
                  Schedule and Break columns removed; rows are tighter
                  (px-3 / py-2.5) and use small single-line badges instead
                  of the larger card-style cells. All underlying logic
                  (effective time-in, shift detection, hours calc) is
                  unchanged — only how it's displayed here changes. */}
              {attendanceHistory.length > 0 && (
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.6))` }}>
                        {['Date', 'In', 'Out', 'OT', 'Hours'].map((label) => (
                          <th key={label} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                            {label === 'Hours'
                              ? <div className="flex items-center gap-1"><Timer className="w-3 h-3 text-gray-500" />{label}</div>
                              : label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {attendanceHistory.map((r) => {
                        const total                        = computeTotalHours(r);
                        // analyzeRecord always uses start_time / end_time — unaffected by early_status
                        const { isNightShift, isHalfDay } = analyzeRecord(r);
                        const effectiveTimeIn               = getDisplayTimeIn(r);

                        return (
                          <tr key={getRecordKey(r)} className="dtr-row">
                            {/* Date + shift badge below it */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <p className="text-xs font-semibold text-gray-800">{formatDateLong(r.date)}</p>
                              <div className="mt-0.5"><ShiftBadge isNightShift={isNightShift} isHalfDay={isHalfDay} /></div>
                            </td>

                            {/* Time In — schedule-aware effective time-in.
                                Approved early attendance shows the real early time;
                                rejected / pending / unrequested early minutes fall back to start_time. */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <CompactTimeBadge value={effectiveTimeIn} color="#10b981" bg="#f0fdf4" border="#bbf7d0" />
                            </td>

                            {/* Time Out */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <CompactTimeBadge value={r.time_out} color="#ef4444" bg="#fef2f2" border="#fecaca" />
                            </td>

                            {/* Overtime — "OT Start → OT End", or — if none */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <CompactOtBadge otIn={r.ot_time_in} otOut={r.ot_time_out} />
                            </td>

                            {/* Total Hours — compact pill */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {total > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
                                  style={{ backgroundColor: `rgb(var(--primary-100))`, color: `rgb(var(--primary-700))` }}>
                                  <Timer className="w-3 h-3" />{total} hrs
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Desktop footer — uses the real summary totals, same as
                      the summary cards above, not the paginated attendanceHistory. */}
                  <div className="border-t-2 px-6 py-3 flex gap-8"
                    style={{ borderColor: `rgb(var(--primary-100))`, background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.6))` }}>
                    {[
                      { label: 'Days:', value: summaryLoading ? '—' : summary.totalDays },
                      { label: 'Total Hours:', value: summaryLoading ? '—' : `${summary.totalHours} hrs` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
                        <span className="text-sm font-bold" style={{ color: `rgb(var(--primary-700))` }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mobile Cards */}
              {attendanceHistory.length > 0 && (
                <div className="sm:hidden divide-y divide-gray-100">
                  {attendanceHistory.map((r) => {
                    const total                        = computeTotalHours(r);
                    const { isNightShift, isHalfDay }  = analyzeRecord(r);
                    const effectiveTimeIn               = getDisplayTimeIn(r);
                    const autoDeduct                   = !isHalfDay && !r.lunch_break_start && r.time_in && r.time_out && msToHrs(msDiff(effectiveTimeIn, r.time_out) ?? 0) >= 5;

                    return (
                      <div key={getRecordKey(r)} className="dtr-row p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{formatDateLong(r.date)}</p>
                            <div className="mt-1 flex items-center gap-1.5">
                              <ShiftBadge isNightShift={isNightShift} isHalfDay={isHalfDay} />
                              {autoDeduct && (
                                <span className="text-[9px] font-semibold rounded-full px-1.5 py-0.5"
                                  style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#9ca3af' }}>
                                  Auto-deducted
                                </span>
                              )}
                            </div>
                          </div>
                          {total > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                              style={{ backgroundColor: `rgb(var(--primary-100))`, color: `rgb(var(--primary-700))` }}>
                              <Timer className="w-3 h-3" />{total} hrs
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                        {/*
                          MobileWorkflowCard always renders the schedule row (start_time → end_time)
                          and the Time Out step as part of the dynamic workflow steps.
                          The Time In step inside it uses the same schedule-aware display value.
                        */}
                        <MobileWorkflowCard record={r} />
                      </div>
                    );
                  })}

                  {/* Mobile footer — same real summary totals as the desktop footer. */}
                  <div className="px-4 py-3 flex gap-6"
                    style={{ borderTop: `2px solid rgb(var(--primary-100))`, background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.6))` }}>
                    {[
                      { label: 'Days', value: summaryLoading ? '—' : summary.totalDays },
                      { label: 'Total Hours', value: summaryLoading ? '—' : `${summary.totalHours} hrs` },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
                        <p className="text-base font-bold" style={{ color: `rgb(var(--primary-700))` }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Infinite scroll sentinel + loading indicator. Only rendered
                  while there's more data to fetch, so the IntersectionObserver
                  effect naturally tears down once pagination is exhausted. */}
              {attendanceHistory.length > 0 && (hasMore || loadingMore) && (
                <div ref={sentinelRef} className="px-6 py-6 flex flex-col items-center justify-center gap-2 border-t border-gray-100">
                  {loadingMore && (
                    <>
                      <div className="w-8 h-8 rounded-full animate-spin" style={{ border: `3px solid rgb(var(--primary-200))`, borderTopColor: `rgb(var(--primary-600))` }} />
                      <p className="text-sm text-gray-500 font-medium">Loading more attendance...</p>
                    </>
                  )}
                </div>
              )}
            </div>

            <p className="text-center text-xs text-gray-400 mt-6">For official OJT documentation purposes only</p>
          </>
        )}
      </div>
    </div>
  );
}