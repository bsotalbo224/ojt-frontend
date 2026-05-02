import { useState, useEffect } from 'react';
import { Calendar, Clock, Download, BookOpen, CalendarDays, Sun, Briefcase, Moon, Timer } from 'lucide-react';
import { getStudentAttendanceHistory } from '../../api/attendance';

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
const formatTime = (timeStr) => {
  if (!timeStr) return null;
  const [h, m, s = 0] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, s);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};

/** Returns decimal hours, or null if either value missing. */
const computeSessionHours = (timeIn, timeOut) => {
  if (!timeIn || !timeOut) return null;
  try {
    const start = new Date(`1970-01-01T${timeIn}`);
    const end   = new Date(`1970-01-01T${timeOut}`);
    const diff  = (end - start) / 3_600_000;
    return diff > 0 ? Math.round(diff * 10) / 10 : null;
  } catch { return null; }
};

/** Sum morning + afternoon + OT hours for a record. Returns a number. */
const computeTotalHours = (record) => {
  const m  = computeSessionHours(record.morning?.timeIn,   record.morning?.timeOut)   ?? 0;
  const af = computeSessionHours(record.afternoon?.timeIn, record.afternoon?.timeOut) ?? 0;
  const ot = computeSessionHours(record.ot?.timeIn,        record.ot?.timeOut)        ?? 0;
  return Math.round((m + af + ot) * 10) / 10;
};

const formatDateLong = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00"))
    .toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

/** "8:00 AM – 12:00 PM" or status string */
const sessionRange = (timeIn, timeOut) => {
  const inStr  = formatTime(timeIn);
  const outStr = formatTime(timeOut);
  if (inStr && outStr)  return `${inStr} – ${outStr}`;
  if (inStr)            return `${inStr} – In Progress`;
  return null;
};

const getSessionStatus = (timeIn, timeOut) => {
  if (timeIn && timeOut) return "completed";
  if (timeIn)            return "inprogress";
  return "pending";
};

/** Read a --primary-N CSS var as [r,g,b], fallback to primary-ish green. */
const cssVar = (name, fallback = "22 163 74") => {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim() || fallback;
  return raw.split(/\s+/).map(Number);
};

/* ═══════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════ */

/** Colored session cell used inside the desktop table */
const SessionCell = ({ timeIn, timeOut }) => {
  const status = getSessionStatus(timeIn, timeOut);
  const range  = sessionRange(timeIn, timeOut);

  if (status === "pending") return <span className="text-gray-400 text-sm">—</span>;

  const colors = {
    completed:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", dot: "#22c55e" },
    inprogress: { bg: "#fefce8", border: "#fde68a",  text: "#a16207", dot: "#eab308" },
  };
  const c = colors[status];

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 whitespace-nowrap"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.dot }} />
      {range}
    </span>
  );
};

/** Mobile session row */
const MobileSessionRow = ({ Icon, label, timeIn, timeOut, accentColor }) => {
  const status = getSessionStatus(timeIn, timeOut);
  const range  = sessionRange(timeIn, timeOut);

  const pillColors = {
    completed:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
    inprogress: { bg: "#fefce8", border: "#fde68a",  text: "#a16207" },
    pending:    { bg: "#f9fafb", border: "#e5e7eb",  text: "#9ca3af" },
  };
  const pc = pillColors[status];

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
        <span className="text-xs font-semibold text-gray-500">{label}</span>
      </div>
      <span
        className="text-xs font-medium rounded-lg px-2.5 py-1"
        style={{ background: pc.bg, border: `1px solid ${pc.border}`, color: pc.text }}
      >
        {range ?? "Not started"}
      </span>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   PDF EXPORT
═══════════════════════════════════════════════════════ */
const exportDTR = async (attendanceHistory, totalDays, totalHours) => {
  const { jsPDF } = await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Pull theme colours at call time
  const c600 = cssVar("--primary-600");
  const c700 = cssVar("--primary-700");
  const c50  = cssVar("--primary-50");
  const c100 = cssVar("--primary-100");
  const c200 = cssVar("--primary-200");

  const pageW   = 297; // A4 landscape
  const margin  = 16;
  const contentW = pageW - margin * 2;
  let y = 18;

  // ── Header ──
  doc.setDrawColor(...c600);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + contentW, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...c600);
  doc.text("DAILY TIME RECORD", pageW / 2, y, { align: "center" });
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text("Official OJT Attendance Log — Session-Based Record", pageW / 2, y, { align: "center" });
  y += 6;

  doc.setDrawColor(...c600);
  doc.line(margin, y, margin + contentW, y);
  y += 7;

  const printedDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated: ${printedDate}`, margin, y);
  doc.text(`Total Entries: ${attendanceHistory.length}`, pageW - margin, y, { align: "right" });
  y += 10;

  // ── Column definitions ──
  // Date | Morning | Afternoon | OT | Total Hrs
  const colDefs = [
    { label: "Date",      x: margin,       w: 48 },
    { label: "Morning",   x: margin + 48,  w: 56 },
    { label: "Afternoon", x: margin + 104, w: 56 },
    { label: "OT",        x: margin + 160, w: 56 },
    { label: "Total Hrs", x: margin + 216, w: 49 },
  ];
  const rowH = 9;

  // Header row
  doc.setFillColor(...c600);
  doc.rect(margin, y, contentW, rowH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  colDefs.forEach(({ label, x }) => doc.text(label, x + 3, y + 6));
  y += rowH;

  // Data rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  attendanceHistory.forEach((record, idx) => {
    if (y > 175) { doc.addPage(); y = 18; }

    if (idx % 2 === 0) {
      doc.setFillColor(...c50);
      doc.rect(margin, y, contentW, rowH, "F");
    }

    const totalH = computeTotalHours(record);

    const morningStr   = sessionRange(record.morning?.timeIn,   record.morning?.timeOut)   ?? "—";
    const afternoonStr = sessionRange(record.afternoon?.timeIn, record.afternoon?.timeOut) ?? "—";
    const otStr        = sessionRange(record.ot?.timeIn,        record.ot?.timeOut)        ?? "—";

    doc.setTextColor(30, 30, 30);
    doc.text(formatDateLong(record.date), colDefs[0].x + 3, y + 6);
    doc.text(morningStr,                  colDefs[1].x + 3, y + 6);
    doc.text(afternoonStr,                colDefs[2].x + 3, y + 6);
    doc.text(otStr,                       colDefs[3].x + 3, y + 6);

    if (totalH > 0) {
      doc.setFillColor(...c200);
      doc.roundedRect(colDefs[4].x + 2, y + 1.8, 28, 5.5, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...c700);
      doc.text(`${totalH} hrs`, colDefs[4].x + 16, y + 5.8, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
    } else {
      doc.text("—", colDefs[4].x + 3, y + 6);
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...c600);
  doc.text(`Days Logged: ${totalDays}`,       margin,      y);
  doc.text(`Total Hours: ${totalHours} hrs`,  margin + 55, y);

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  doc.text(
    "Generated from the OJT Attendance System  •  For official use only",
    pageW / 2, 198, { align: "center" }
  );

  doc.save("Daily_Time_Record.pdf");
};

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
export default function AttendanceHistory() {
  const [loading, setLoading]                   = useState(true);
  const [attendanceHistory, setAttendanceHistory] = useState([]);

  useEffect(() => { fetchAttendance(); }, []);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const data = await getStudentAttendanceHistory();
      if (!data.success) { console.error("API returned error:", data); return; }
      setAttendanceHistory(data.history);
    } catch (err) {
      console.error("Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Aggregate totals ── */
  const totalHours = attendanceHistory.reduce((sum, r) => {
    const h = computeTotalHours(r);
    return sum + (typeof h === "number" ? h : 0);
  }, 0);
  const roundedTotal = Math.round(totalHours * 10) / 10;

  const totalDays = attendanceHistory.filter(
    (r) => r.morning?.timeIn && r.morning?.timeOut &&
           r.afternoon?.timeIn && r.afternoon?.timeOut
  ).length;

  /* ── Session icon/color map ── */
  const SESSION_META = {
    morning:   { label: "Morning Session",   Icon: Sun,       accentColor: "#f59e0b" },
    afternoon: { label: "Afternoon Session", Icon: Briefcase, accentColor: "#3b82f6" },
    ot:        { label: "Overtime",          Icon: Moon,      accentColor: "#8b5cf6" },
  };

  /* ── Render ── */
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
            <span
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: `rgb(var(--primary-600))` }}
            >
              Official Document
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">Daily Time Record</h1>
          <p className="text-gray-600">Official session-based attendance log of your OJT working hours</p>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div
            className="bg-white rounded-2xl shadow-lg p-12 mb-8"
            style={{ border: `1px solid rgb(var(--primary-100))` }}
          >
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
                { Icon: CalendarDays, label: "Days Logged",  value: totalDays,            sub: "completed entries" },
                { Icon: Clock,        label: "Total Hours",  value: `${roundedTotal} hrs`, sub: "hours rendered"   },
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
            <div
              className="bg-white rounded-2xl shadow-lg overflow-hidden"
              style={{ border: `1px solid rgb(var(--primary-100))` }}
            >
              {/* Table header bar */}
              <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Daily Time Record Log</h2>
                  <p className="text-sm text-gray-600 mt-1">Complete session-based attendance history</p>
                </div>

                {/* Session legend */}
                <div className="hidden sm:flex items-center gap-4 text-xs font-medium text-gray-500">
                  {Object.values(SESSION_META).map(({ label, Icon, accentColor }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
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
                  <p className="text-gray-600 font-medium mb-2">No attendance sessions recorded yet</p>
                  <p className="text-sm text-gray-500">
                    Your DTR entries will appear here once you start logging attendance sessions.
                  </p>
                </div>
              )}

              {/* ── Desktop Table ── */}
              {attendanceHistory.length > 0 && (
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.6))` }}>
                        {/* Date */}
                        <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                          Date
                        </th>
                        {/* Session columns */}
                        {Object.entries(SESSION_META).map(([key, { label, Icon, accentColor }]) => (
                          <th key={key} className="px-4 py-4 text-left">
                            <div className="flex items-center gap-1.5">
                              <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
                              <span className="text-sm font-semibold text-gray-700">{label}</span>
                            </div>
                          </th>
                        ))}
                        {/* Total */}
                        <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Timer className="w-3.5 h-3.5 text-gray-500" />
                            Total Hours
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {attendanceHistory.map((record) => {
                        const total = computeTotalHours(record);
                        return (
                          <tr key={record.id} className="dtr-row">
                            <td className="px-5 py-4 text-sm font-semibold text-gray-800 whitespace-nowrap">
                              {formatDateLong(record.date)}
                            </td>
                            <td className="px-4 py-4">
                              <SessionCell timeIn={record.morning?.timeIn}   timeOut={record.morning?.timeOut}   />
                            </td>
                            <td className="px-4 py-4">
                              <SessionCell timeIn={record.afternoon?.timeIn} timeOut={record.afternoon?.timeOut} />
                            </td>
                            <td className="px-4 py-4">
                              <SessionCell timeIn={record.ot?.timeIn}        timeOut={record.ot?.timeOut}        />
                            </td>
                            <td className="px-4 py-4">
                              {total > 0 ? (
                                <span
                                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full"
                                  style={{
                                    backgroundColor: `rgb(var(--primary-100))`,
                                    color: `rgb(var(--primary-700))`,
                                  }}
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
                      { label: "Days:",        value: totalDays        },
                      { label: "Total Hours:", value: `${roundedTotal} hrs` },
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
                  {attendanceHistory.map((record) => {
                    const total = computeTotalHours(record);
                    return (
                      <div key={record.id} className="dtr-row p-4">
                        {/* Card header */}
                        <div className="flex justify-between items-center mb-3">
                          <p className="font-semibold text-gray-800 text-sm">{formatDateLong(record.date)}</p>
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

                        {/* Session rows */}
                        <div
                          className="rounded-xl p-3 space-y-1 divide-y divide-gray-100"
                          style={{ background: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}
                        >
                          <MobileSessionRow
                            Icon={SESSION_META.morning.Icon}
                            label="Morning Session"
                            timeIn={record.morning?.timeIn}
                            timeOut={record.morning?.timeOut}
                            accentColor={SESSION_META.morning.accentColor}
                          />
                          <MobileSessionRow
                            Icon={SESSION_META.afternoon.Icon}
                            label="Afternoon Session"
                            timeIn={record.afternoon?.timeIn}
                            timeOut={record.afternoon?.timeOut}
                            accentColor={SESSION_META.afternoon.accentColor}
                          />
                          <MobileSessionRow
                            Icon={SESSION_META.ot.Icon}
                            label="Overtime"
                            timeIn={record.ot?.timeIn}
                            timeOut={record.ot?.timeOut}
                            accentColor={SESSION_META.ot.accentColor}
                          />
                        </div>
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
                      { label: "Days",        value: totalDays             },
                      { label: "Total Hours", value: `${roundedTotal} hrs` },
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