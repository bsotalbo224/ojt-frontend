import { useState, useEffect } from 'react';
import {
  Calendar, Clock, Download, BookOpen, CalendarDays, Timer,
  LogIn, LogOut, Coffee, UtensilsCrossed, Moon, Sunrise, ArrowRight,
} from 'lucide-react';
import { getStudentAttendanceHistory } from '../../api/attendance';

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
const formatTime = (timeStr) => {
  if (!timeStr) return null;
  const [h, m, s = 0] = timeStr.split(':').map(Number);
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
  const d = e - s;
  return d > 0 ? d : null;
};

const msToHrs = (ms) => (ms == null ? 0 : ms / 3_600_000);

/**
 * Regular hours = time_in → time_out minus lunch.
 * If no lunch logged and work >= 5 hrs → auto deduct 1 hr.
 * OT added separately.
 */
const computeTotalHours = (r) => {
  if (!r?.time_in || !r?.time_out) return 0;
  const workMs  = msDiff(r.time_in, r.time_out) ?? 0;
  const lunchMs = msDiff(r.lunch_break_start, r.lunch_break_end);
  const otMs    = msDiff(r.ot_time_in, r.ot_time_out) ?? 0;

  let deductMs = 0;
  if (lunchMs != null) {
    deductMs = lunchMs;
  } else if (msToHrs(workMs) >= 5) {
    deductMs = 3_600_000;
  }

  const total = Math.max(0, msToHrs(workMs) - msToHrs(deductMs)) + msToHrs(otMs);
  return Math.round(total * 10) / 10;
};

const timeRange = (start, end) => {
  const s = formatTime(start), e = formatTime(end);
  if (s && e)  return `${s} → ${e}`;
  if (s)       return `${s} → In Progress`;
  return null;
};

/** Read a --primary-N CSS var as [r,g,b] */
const cssVar = (name, fallback = '22 163 74') => {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim() || fallback;
  return raw.split(/\s+/).map(Number);
};

/* ═══════════════════════════════════════════════════════
   WORKFLOW STEPS CONFIG
═══════════════════════════════════════════════════════ */
const WORKFLOW = [
  { key: 'time_in',           label: 'Time In',     pairKey: null,              Icon: LogIn,           color: '#10b981' },
  { key: 'lunch_break_start', label: 'Lunch Start', pairKey: 'lunch_break_end', Icon: Coffee,          color: '#f59e0b' },
  { key: 'lunch_break_end',   label: 'Lunch End',   pairKey: null,              Icon: UtensilsCrossed, color: '#f97316' },
  { key: 'time_out',          label: 'Time Out',    pairKey: null,              Icon: LogOut,          color: '#ef4444' },
  { key: 'ot_time_in',        label: 'OT Start',    pairKey: 'ot_time_out',     Icon: Moon,            color: '#8b5cf6' },
  { key: 'ot_time_out',       label: 'OT End',      pairKey: null,              Icon: Sunrise,         color: '#6366f1' },
];

/* ═══════════════════════════════════════════════════════
   DESKTOP TABLE CELL
═══════════════════════════════════════════════════════ */
const RangeCell = ({ start, end, color }) => {
  const range = timeRange(start, end);
  if (!range && !start) return <span className="text-gray-300 text-sm">—</span>;

  const isDone = !!(start && end);
  const bg     = isDone ? `${color}10` : '#fefce8';
  const border = isDone ? `${color}30` : '#fde68a';
  const dot    = isDone ? color        : '#eab308';
  const text   = '#374151';

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 whitespace-nowrap"
      style={{ background: bg, border: `1px solid ${border}`, color: text }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
      {range}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════
   MOBILE WORKFLOW CARD
═══════════════════════════════════════════════════════ */
const MobileWorkflowCard = ({ record }) => {
  const steps = WORKFLOW.filter(
    (s) => !s.key.startsWith('ot') || record.ot_time_in || record.ot_time_out
  );

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid #e5e7eb' }}
    >
      {steps.map((step, i) => {
        const val    = record[step.key];
        const isDone = !!val;
        const isOpt  = step.key === 'lunch_break_start' || step.key === 'lunch_break_end' || step.key.startsWith('ot');

        return (
          <div
            key={step.key}
            className="flex items-center gap-3 px-3 py-2.5 transition-colors"
            style={{
              background: isDone ? `${step.color}08` : '#fafafa',
              borderBottom: i < steps.length - 1 ? '1px solid #f3f4f6' : 'none',
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: isDone ? `${step.color}18` : '#f3f4f6',
                border: `1px solid ${isDone ? `${step.color}35` : '#e5e7eb'}`,
              }}
            >
              <step.Icon className="w-3.5 h-3.5" style={{ color: isDone ? step.color : '#9ca3af' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{step.label}</span>
                {isOpt && <span className="text-[8px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded-full font-semibold">opt</span>}
              </div>
              <p className={`text-xs font-bold tabular-nums ${isDone ? 'text-gray-800' : 'text-gray-400'}`}>
                {formatTime(val) ?? '—'}
              </p>
            </div>
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: isDone ? step.color : '#e5e7eb' }}
            />
          </div>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   PDF EXPORT
═══════════════════════════════════════════════════════ */
const exportDTR = async (history, totalDays, totalHours) => {
  const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const c600 = cssVar('--primary-600');
  const c700 = cssVar('--primary-700');
  const c50  = cssVar('--primary-50');
  const c100 = cssVar('--primary-100');
  const c200 = cssVar('--primary-200');

  const pageW    = 297;
  const margin   = 16;
  const contentW = pageW - margin * 2;
  let y = 18;

  // ── Header ──
  doc.setDrawColor(...c600);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + contentW, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...c600);
  doc.text('DAILY TIME RECORD', pageW / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text('Official OJT Attendance Log — Workflow-Based Record', pageW / 2, y, { align: 'center' });
  y += 6;

  doc.setDrawColor(...c600);
  doc.line(margin, y, margin + contentW, y);
  y += 7;

  const printedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated: ${printedDate}`, margin, y);
  doc.text(`Total Entries: ${history.length}`, pageW - margin, y, { align: 'right' });
  y += 10;

  // ── Column definitions ──
  // Date | Work Schedule | Lunch Break | Overtime | Total Hrs
  const cols = [
    { label: 'Date',          x: margin,       w: 44 },
    { label: 'Work Schedule', x: margin + 44,  w: 58 },
    { label: 'Lunch Break',   x: margin + 102, w: 54 },
    { label: 'Overtime',      x: margin + 156, w: 54 },
    { label: 'Total Hrs',     x: margin + 210, w: 55 },
  ];
  const rowH = 9;

  // Header row
  doc.setFillColor(...c600);
  doc.rect(margin, y, contentW, rowH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  cols.forEach(({ label, x }) => doc.text(label, x + 3, y + 6));
  y += rowH;

  // Data rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  history.forEach((r, idx) => {
    if (y > 175) { doc.addPage(); y = 18; }

    if (idx % 2 === 0) {
      doc.setFillColor(...c50);
      doc.rect(margin, y, contentW, rowH, 'F');
    }

    const total        = computeTotalHours(r);
    const workStr      = timeRange(r.time_in, r.time_out)                     ?? '—';
    const lunchStr     = timeRange(r.lunch_break_start, r.lunch_break_end)    ?? (r.time_in && msToHrs(msDiff(r.time_in, r.time_out) ?? 0) >= 5 ? 'Auto-deducted 1 hr' : '—');
    const otStr        = timeRange(r.ot_time_in, r.ot_time_out)               ?? '—';

    doc.setTextColor(30, 30, 30);
    doc.text(formatDateShort(r.date), cols[0].x + 3, y + 6);
    doc.text(workStr,                 cols[1].x + 3, y + 6);
    doc.text(lunchStr,                cols[2].x + 3, y + 6);
    doc.text(otStr,                   cols[3].x + 3, y + 6);

    if (total > 0) {
      doc.setFillColor(...c200);
      doc.roundedRect(cols[4].x + 2, y + 1.8, 32, 5.5, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...c700);
      doc.text(`${total} hrs`, cols[4].x + 18, y + 5.8, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
    } else {
      doc.text('—', cols[4].x + 3, y + 6);
    }

    doc.setDrawColor(...c100);
    doc.line(margin, y + rowH, margin + contentW, y + rowH);
    y += rowH;
  });

  // Totals row
  y += 5;
  doc.setDrawColor(...c600);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + contentW, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...c600);
  doc.text(`Days Logged: ${totalDays}`,      margin,      y);
  doc.text(`Total Hours: ${totalHours} hrs`, margin + 55, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  doc.text(
    'Generated from the OJT Attendance System  •  For official use only',
    pageW / 2, 198, { align: 'center' }
  );

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

  /* ── Aggregates ── */
  const totalHours = attendanceHistory.reduce((sum, r) => sum + computeTotalHours(r), 0);
  const roundedTotal = Math.round(totalHours * 10) / 10;

  const totalDays = attendanceHistory.filter((r) => r.time_in && r.time_out).length;

  /* ── Desktop table columns ── */
  const TABLE_COLS = [
    { label: 'Date',          key: 'date'  },
    { label: 'Work Schedule', key: 'work'  },
    { label: 'Lunch Break',   key: 'lunch' },
    { label: 'Overtime',      key: 'ot'    },
    { label: 'Total Hours',   key: 'total' },
  ];

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

        {/* ── Page Header ── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shadow-sm"
              style={{ backgroundColor: `rgb(var(--primary-600))` }}
            >
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: `rgb(var(--primary-600))` }}>
              Official Document
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">Daily Time Record</h1>
          <p className="text-gray-600">Professional OJT attendance log tracking your daily work hours</p>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-lg p-12 mb-8" style={{ border: `1px solid rgb(var(--primary-100))` }}>
            <div className="flex flex-col items-center justify-center gap-4">
              <div
                className="w-12 h-12 rounded-full animate-spin"
                style={{ border: `4px solid rgb(var(--primary-200))`, borderTopColor: `rgb(var(--primary-600))` }}
              />
              <p className="text-gray-600 font-medium">Loading attendance records…</p>
            </div>
          </div>
        )}

        {!loading && (
          <>
            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {[
                { Icon: CalendarDays, label: 'Days Logged',  value: totalDays,              sub: 'completed work days'  },
                { Icon: Clock,        label: 'Total Hours',  value: `${roundedTotal} hrs`,  sub: 'hours rendered'       },
              ].map(({ Icon, label, value, sub }) => (
                <div
                  key={label}
                  className="summary-card bg-white rounded-2xl shadow-lg p-6 flex items-center gap-5"
                  style={{ border: `1px solid rgb(var(--primary-100))` }}
                >
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: `linear-gradient(to bottom right, rgb(var(--primary-50)), rgb(var(--primary-100)))`,
                      border: `1px solid rgb(var(--primary-200))`,
                    }}
                  >
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

            {/* ── Table Card ── */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden" style={{ border: `1px solid rgb(var(--primary-100))` }}>

              {/* Table header bar */}
              <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Attendance Log</h2>
                  <p className="text-sm text-gray-600 mt-1">Complete work attendance history and DTR entries</p>
                </div>

                {/* Workflow legend */}
                <div className="hidden sm:flex items-center gap-3 flex-wrap">
                  {[
                    { Icon: LogIn,  label: 'Time In/Out', color: '#10b981' },
                    { Icon: Coffee, label: 'Lunch Break',  color: '#f59e0b' },
                    { Icon: Moon,   label: 'Overtime',     color: '#8b5cf6' },
                  ].map(({ Icon, label, color }) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                      <span>{label}</span>
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
                  <Download className="w-4 h-4" />
                  Export DTR
                </button>
              </div>

              {/* ── Empty State ── */}
              {attendanceHistory.length === 0 && (
                <div className="p-12 text-center">
                  <Calendar className="w-16 h-16 mx-auto mb-4" style={{ color: `rgb(var(--primary-300))` }} />
                  <p className="text-gray-600 font-medium mb-2">No attendance records yet</p>
                  <p className="text-sm text-gray-500">
                    Your DTR entries will appear here once you start logging work attendance.
                  </p>
                </div>
              )}

              {/* ── Desktop Table ── */}
              {attendanceHistory.length > 0 && (
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.6))` }}>
                        {TABLE_COLS.map(({ label, key }) => (
                          <th key={key} className="px-5 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                            {key === 'total'
                              ? <div className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5 text-gray-500" />{label}</div>
                              : label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {attendanceHistory.map((r) => {
                        const total     = computeTotalHours(r);
                        const autoDeduct = !r.lunch_break_start && r.time_in && r.time_out
                          && msToHrs(msDiff(r.time_in, r.time_out) ?? 0) >= 5;

                        return (
                          <tr key={r.id} className="dtr-row">
                            {/* Date */}
                            <td className="px-5 py-4 text-sm font-semibold text-gray-800 whitespace-nowrap">
                              {formatDateLong(r.date)}
                            </td>

                            {/* Work Schedule: time_in → time_out */}
                            <td className="px-5 py-4">
                              <RangeCell start={r.time_in} end={r.time_out} color="#10b981" />
                            </td>

                            {/* Lunch Break */}
                            <td className="px-5 py-4">
                              {r.lunch_break_start ? (
                                <RangeCell start={r.lunch_break_start} end={r.lunch_break_end} color="#f59e0b" />
                              ) : autoDeduct ? (
                                <span
                                  className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5"
                                  style={{ background: '#fafafa', border: '1px solid #e5e7eb', color: '#9ca3af' }}
                                >
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

                            {/* Total Hours */}
                            <td className="px-5 py-4">
                              {total > 0 ? (
                                <span
                                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full"
                                  style={{ backgroundColor: `rgb(var(--primary-100))`, color: `rgb(var(--primary-700))` }}
                                >
                                  <Timer className="w-3 h-3" />
                                  {total} hrs
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

                  {/* Desktop footer totals */}
                  <div
                    className="border-t-2 px-6 py-3 flex gap-8"
                    style={{
                      borderColor: `rgb(var(--primary-100))`,
                      background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.6))`,
                    }}
                  >
                    {[
                      { label: 'Days:',        value: totalDays },
                      { label: 'Total Hours:', value: `${roundedTotal} hrs` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
                        <span className="text-sm font-bold" style={{ color: `rgb(var(--primary-700))` }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Mobile Cards ── */}
              {attendanceHistory.length > 0 && (
                <div className="sm:hidden divide-y divide-gray-100">
                  {attendanceHistory.map((r) => {
                    const total = computeTotalHours(r);
                    const autoDeduct = !r.lunch_break_start && r.time_in && r.time_out
                      && msToHrs(msDiff(r.time_in, r.time_out) ?? 0) >= 5;

                    return (
                      <div key={r.id} className="dtr-row p-4">
                        {/* Card header */}
                        <div className="flex justify-between items-center mb-3">
                          <p className="font-semibold text-gray-800 text-sm">{formatDateLong(r.date)}</p>
                          {total > 0 ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                              style={{ backgroundColor: `rgb(var(--primary-100))`, color: `rgb(var(--primary-700))` }}
                            >
                              <Timer className="w-3 h-3" />
                              {total} hrs
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>

                        {/* Auto deduct badge */}
                        {autoDeduct && (
                          <div
                            className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 mb-2"
                            style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#9ca3af' }}
                          >
                            Auto lunch deduction applied
                          </div>
                        )}

                        {/* Workflow timeline */}
                        <MobileWorkflowCard record={r} />
                      </div>
                    );
                  })}

                  {/* Mobile footer totals */}
                  <div
                    className="px-4 py-3 flex gap-6"
                    style={{
                      borderTop: `2px solid rgb(var(--primary-100))`,
                      background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.6))`,
                    }}
                  >
                    {[
                      { label: 'Days',        value: totalDays },
                      { label: 'Total Hours', value: `${roundedTotal} hrs` },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
                        <p className="text-base font-bold" style={{ color: `rgb(var(--primary-700))` }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className="text-center text-xs text-gray-400 mt-6">
              For official OJT documentation purposes only
            </p>
          </>
        )}
      </div>
    </div>
  );
}