import { useState, useEffect } from 'react';
import {
  Calendar, Clock, Download, BookOpen, CalendarDays, Timer,
  LogIn, LogOut, Coffee, UtensilsCrossed, Moon, Sunrise, Hourglass,
} from 'lucide-react';
import { getStudentAttendanceHistory } from '../../api/attendance';

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
  const s = toMs(start), e = toMs(end);
  if (s == null || e == null) return null;
  return e - s > 0 ? e - s : null;
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

/* ═══════════════════════════════════════════════════════
   EARLY ATTENDANCE LOGIC
   - Show "Pending" only when early_attendance exists AND early_status === "pending"
   - Everything else (approved, rejected, no request) → "—"
   - early_status NEVER affects schedule visibility (start_time / end_time always shown)
═══════════════════════════════════════════════════════ */
const getEarlyAttendanceDisplay = (r) => {
  if (r.early_attendance && r.early_status === 'pending') {
    return 'pending';
  }
  return null; // approved, rejected, or no request → show "—"
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

  const workMs  = msDiff(r.time_in, r.time_out) ?? 0;
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
   EARLY ATTENDANCE BADGE
   Pending → amber badge
   Everything else (approved / rejected / none) → "—"
═══════════════════════════════════════════════════════ */
const EarlyAttendanceBadge = ({ record }) => {
  const display = getEarlyAttendanceDisplay(record);

  if (display === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 whitespace-nowrap"
        style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
        <Hourglass className="w-3 h-3" />
        Pending
      </span>
    );
  }

  return <span className="text-gray-300 text-sm">—</span>;
};

/* ═══════════════════════════════════════════════════════
   MOBILE WORKFLOW CARD (dynamic)
═══════════════════════════════════════════════════════ */
const MobileWorkflowCard = ({ record }) => {
  const { steps } = buildWorkflow(record);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
      {steps.map((step, i) => {
        const val    = record[step.key];
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
        {/* Early attendance status — minimal: Pending or nothing */}
        {getEarlyAttendanceDisplay(record) === 'pending' && (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
            <Hourglass className="w-2.5 h-2.5" />Pending
          </span>
        )}
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
   PDF EXPORT
═══════════════════════════════════════════════════════ */
const exportDTR = async (history, totalDays, totalHours) => {
  const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const c600 = cssVar('--primary-600'), c700 = cssVar('--primary-700');
  const c50  = cssVar('--primary-50'),  c100 = cssVar('--primary-100'), c200 = cssVar('--primary-200');

  const pageW = 297, margin = 16, contentW = pageW - margin * 2;
  let y = 18;

  doc.setDrawColor(...c600); doc.setLineWidth(0.8);
  doc.line(margin, y, margin + contentW, y); y += 7;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...c600);
  doc.text('DAILY TIME RECORD', pageW / 2, y, { align: 'center' }); y += 5;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(100, 100, 100);
  doc.text('Official OJT Attendance Log — Schedule-Aware Workflow Record', pageW / 2, y, { align: 'center' }); y += 6;

  doc.setDrawColor(...c600); doc.line(margin, y, margin + contentW, y); y += 7;

  doc.setFontSize(8.5); doc.setTextColor(80, 80, 80);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);
  doc.text(`Total Entries: ${history.length}`, pageW - margin, y, { align: 'right' }); y += 10;

  const cols = [
    { label: 'Date',             x: margin,       w: 36 },
    { label: 'Time In',          x: margin + 36,  w: 30 },
    { label: 'Schedule',         x: margin + 66,  w: 46 },
    { label: 'Break',            x: margin + 112, w: 46 },
    { label: 'Overtime',         x: margin + 158, w: 46 },
    { label: 'Early Attendance', x: margin + 204, w: 38 },
    { label: 'Total Hrs',        x: margin + 242, w: 23 },
  ];
  const rowH = 9;

  doc.setFillColor(...c600); doc.rect(margin, y, contentW, rowH, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255);
  cols.forEach(({ label, x }) => doc.text(label, x + 2, y + 6)); y += rowH;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);

  history.forEach((r, idx) => {
    if (y > 175) { doc.addPage(); y = 18; }
    if (idx % 2 === 0) { doc.setFillColor(...c50); doc.rect(margin, y, contentW, rowH, 'F'); }

    const { isNightShift, isHalfDay } = analyzeRecord(r);
    const breakLabel  = isNightShift ? 'Meal' : 'Lunch';
    const total       = computeTotalHours(r);
    const timeInStr   = formatTime(r.time_in) ?? '—';
    // Schedule always from official start_time / end_time
    const scheduleStr = r.start_time && r.end_time
      ? `${formatTime(r.start_time)} → ${formatTime(r.end_time)}`
      : '—';
    const autoDeduct  = !isHalfDay && !r.lunch_break_start && r.time_in && r.time_out && msToHrs(msDiff(r.time_in, r.time_out) ?? 0) >= 5;
    const breakStr    = isHalfDay ? '—' : (timeRange(r.lunch_break_start, r.lunch_break_end) ?? (autoDeduct ? 'Auto-deducted 1 hr' : '—'));
    const otStr       = timeRange(r.ot_time_in, r.ot_time_out) ?? '—';
    // Early attendance: only "Pending" or "—"
    const earlyStr    = (r.early_attendance && r.early_status === 'pending') ? 'Pending' : '—';

    doc.setTextColor(30, 30, 30);
    doc.text(formatDateShort(r.date), cols[0].x + 2, y + 6);
    doc.text(timeInStr,               cols[1].x + 2, y + 6);
    doc.text(scheduleStr,             cols[2].x + 2, y + 6);
    doc.text(breakStr,                cols[3].x + 2, y + 6);
    doc.text(otStr,                   cols[4].x + 2, y + 6);

    if (earlyStr === 'Pending') {
      doc.setFillColor(254, 243, 199);
      doc.roundedRect(cols[5].x + 1, y + 1.8, 28, 5.5, 2, 2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setTextColor(146, 64, 14);
      doc.text('Pending', cols[5].x + 15, y + 5.8, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30);
    } else {
      doc.text('—', cols[5].x + 2, y + 6);
    }

    if (total > 0) {
      doc.setFillColor(...c200);
      doc.roundedRect(cols[6].x + 1, y + 1.8, 20, 5.5, 2, 2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...c700);
      doc.text(`${total}h`, cols[6].x + 11, y + 5.8, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30);
    } else {
      doc.text('—', cols[6].x + 2, y + 6);
    }

    doc.setDrawColor(...c100); doc.line(margin, y + rowH, margin + contentW, y + rowH); y += rowH;
  });

  y += 5;
  doc.setDrawColor(...c600); doc.setLineWidth(0.8); doc.line(margin, y, margin + contentW, y); y += 7;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...c600);
  doc.text(`Days Logged: ${totalDays}`, margin, y);
  doc.text(`Total Hours: ${totalHours} hrs`, margin + 55, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(160, 160, 160);
  doc.text('Generated from the OJT Attendance System  •  For official use only', pageW / 2, 198, { align: 'center' });

  doc.save('Daily_Time_Record.pdf');
};

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
export default function StudentAttendance() {
  const [loading, setLoading]                     = useState(true);
  const [attendanceHistory, setAttendanceHistory] = useState([]);

  useEffect(() => { fetchAttendance(); }, []);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const data = await getStudentAttendanceHistory();
      if (!data.success) { console.error('API error:', data); return; }
      setAttendanceHistory(data.history);
    } catch (err) {
      console.error('Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalHours   = attendanceHistory.reduce((sum, r) => sum + computeTotalHours(r), 0);
  const roundedTotal = Math.round(totalHours * 10) / 10;
  const totalDays    = attendanceHistory.filter((r) => r.time_in && r.time_out).length;

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
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {[
                { Icon: CalendarDays, label: 'Days Logged',  value: totalDays,             sub: 'completed work days' },
                { Icon: Clock,        label: 'Total Hours',  value: `${roundedTotal} hrs`, sub: 'hours rendered'      },
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
                    { Icon: LogIn,     label: 'Time In/Out',      color: '#10b981' },
                    { Icon: Coffee,    label: 'Break',             color: '#f59e0b' },
                    { Icon: Moon,      label: 'Overtime',          color: '#8b5cf6' },
                    { Icon: Hourglass, label: 'Early (Pending)',   color: '#d97706' },
                  ].map(({ Icon, label, color }) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Icon className="w-3.5 h-3.5" style={{ color }} /><span>{label}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => exportDTR(attendanceHistory, totalDays, roundedTotal)}
                  className="export-btn flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg shadow-sm"
                  style={{ backgroundColor: `rgb(var(--primary-600))` }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`; }}
                >
                  <Download className="w-4 h-4" />Export DTR
                </button>
              </div>

              {/* Empty state */}
              {attendanceHistory.length === 0 && (
                <div className="p-12 text-center">
                  <Calendar className="w-16 h-16 mx-auto mb-4" style={{ color: `rgb(var(--primary-300))` }} />
                  <p className="text-gray-600 font-medium mb-2">No attendance records yet</p>
                  <p className="text-sm text-gray-500">Your DTR entries will appear here once you start logging work attendance.</p>
                </div>
              )}

              {/* Desktop Table */}
              {attendanceHistory.length > 0 && (
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.6))` }}>
                        {['Date', 'Time In', 'Schedule', 'Break', 'Overtime', 'Early Attendance', 'Total Hours'].map((label) => (
                          <th key={label} className="px-5 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                            {label === 'Total Hours'
                              ? <div className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5 text-gray-500" />{label}</div>
                              : label === 'Early Attendance'
                              ? <div className="flex items-center gap-1.5"><Hourglass className="w-3.5 h-3.5 text-gray-500" />{label}</div>
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
                        const breakLabel                   = isNightShift ? 'Meal' : 'Lunch';
                        const autoDeduct                   = !isHalfDay && !r.lunch_break_start && r.time_in && r.time_out && msToHrs(msDiff(r.time_in, r.time_out) ?? 0) >= 5;

                        return (
                          <tr key={r.id} className="dtr-row">
                            {/* Date + shift badge */}
                            <td className="px-5 py-4 whitespace-nowrap">
                              <p className="text-sm font-semibold text-gray-800">{formatDateLong(r.date)}</p>
                              <div className="mt-0.5"><ShiftBadge isNightShift={isNightShift} isHalfDay={isHalfDay} /></div>
                            </td>

                            {/* Time In — actual clock-in time */}
                            <td className="px-5 py-4">
                              {r.time_in ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 whitespace-nowrap"
                                  style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#374151' }}>
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500" />
                                  {formatTime(r.time_in)}
                                </span>
                              ) : (
                                <span className="text-gray-300 text-sm">—</span>
                              )}
                            </td>

                            {/* Schedule — ALWAYS from start_time → end_time.
                                Never hidden or altered by early_attendance / early_status. */}
                            <td className="px-5 py-4">
                              <ScheduleCell record={r} />
                            </td>

                            {/* Break (dynamic label, hidden for half-day) */}
                            <td className="px-5 py-4">
                              {isHalfDay ? (
                                <span className="text-xs text-gray-400 italic">N/A</span>
                              ) : r.lunch_break_start ? (
                                <div>
                                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{breakLabel}</p>
                                  <RangeCell start={r.lunch_break_start} end={r.lunch_break_end} color="#f59e0b" />
                                </div>
                              ) : autoDeduct ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5"
                                  style={{ background: '#fafafa', border: '1px solid #e5e7eb', color: '#9ca3af' }}>
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-gray-300" />
                                  Auto-deducted 1 hr
                                </span>
                              ) : (
                                <span className="text-gray-300 text-sm">—</span>
                              )}
                            </td>

                            {/* Overtime */}
                            <td className="px-5 py-4">
                              <RangeCell start={r.ot_time_in} end={r.ot_time_out} color="#8b5cf6" />
                            </td>

                            {/* Early Attendance — Pending or "—" only.
                                approved, rejected, and no-request all render "—". */}
                            <td className="px-5 py-4">
                              <EarlyAttendanceBadge record={r} />
                            </td>

                            {/* Total Hours */}
                            <td className="px-5 py-4">
                              {total > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full"
                                  style={{ backgroundColor: `rgb(var(--primary-100))`, color: `rgb(var(--primary-700))` }}>
                                  <Timer className="w-3 h-3" />{total} hrs
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Desktop footer */}
                  <div className="border-t-2 px-6 py-3 flex gap-8"
                    style={{ borderColor: `rgb(var(--primary-100))`, background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.6))` }}>
                    {[{ label: 'Days:', value: totalDays }, { label: 'Total Hours:', value: `${roundedTotal} hrs` }].map(({ label, value }) => (
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
                    const autoDeduct                   = !isHalfDay && !r.lunch_break_start && r.time_in && r.time_out && msToHrs(msDiff(r.time_in, r.time_out) ?? 0) >= 5;

                    return (
                      <div key={r.id} className="dtr-row p-4">
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
                          MobileWorkflowCard always renders the schedule row (start_time → end_time).
                          early_status only affects the optional "Pending" badge inside — never hides the row.
                        */}
                        <MobileWorkflowCard record={r} />
                      </div>
                    );
                  })}

                  {/* Mobile footer */}
                  <div className="px-4 py-3 flex gap-6"
                    style={{ borderTop: `2px solid rgb(var(--primary-100))`, background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.6))` }}>
                    {[{ label: 'Days', value: totalDays }, { label: 'Total Hours', value: `${roundedTotal} hrs` }].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
                        <p className="text-base font-bold" style={{ color: `rgb(var(--primary-700))` }}>{value}</p>
                      </div>
                    ))}
                  </div>
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