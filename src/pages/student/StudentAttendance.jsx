import { useState, useEffect } from 'react';
import { Calendar, Clock, Download, BookOpen, CalendarDays } from 'lucide-react';
import { getStudentAttendanceHistory } from '../../api/attendance';

const formatTime = (timeStr) => {
  if (!timeStr) return "—";
  const [h, m, s] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m, s || 0);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const computeHours = (timeIn, timeOut) => {
  if (!timeIn || !timeOut) return "—";
  try {
    const start = new Date(`1970-01-01T${timeIn}`);
    const end   = new Date(`1970-01-01T${timeOut}`);
    return Math.floor((end - start) / 36e5);
  } catch {
    return "—";
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
};

/* ─────────────────────────────────────────
   Read a --primary-N CSS variable as an
   [r, g, b] number array so jsPDF can use it.
   Falls back to green-600 if var is missing.
───────────────────────────────────────────*/
const cssVar = (name, fallback = "22 163 74") => {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim() || fallback;
  return raw.split(/\s+/).map(Number); // → [r, g, b]
};

export default function AttendanceHistory() {
  const [loading, setLoading] = useState(true);
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

  const totalHours = attendanceHistory.reduce((sum, r) => {
    const h = computeHours(r.timeIn, r.timeOut);
    return sum + (typeof h === "number" ? h : 0);
  }, 0);

  const totalDays = attendanceHistory.filter((r) => r.timeIn && r.timeOut).length;

  /* ── PDF export — colours pulled from active CSS vars at call time ── */
  const exportDTR = async () => {
    const { jsPDF } = await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Read theme colours once, right when the user clicks Export
    const c600 = cssVar("--primary-600"); // main brand
    const c700 = cssVar("--primary-700"); // dark text
    const c50  = cssVar("--primary-50");  // lightest bg
    const c100 = cssVar("--primary-100"); // row dividers
    const c200 = cssVar("--primary-200"); // hours badge bg

    const pageW = 210;
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = 20;

    // Header top line
    doc.setDrawColor(...c600);
    doc.setLineWidth(0.8);
    doc.line(margin, y, margin + contentW, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...c600);
    doc.text("DAILY TIME RECORD", pageW / 2, y, { align: "center" });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Official OJT Attendance Log", pageW / 2, y, { align: "center" });
    y += 6;

    // Header bottom line
    doc.setDrawColor(...c600);
    doc.setLineWidth(0.8);
    doc.line(margin, y, margin + contentW, y);
    y += 8;

    // Meta row
    const printedDate = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Generated: ${printedDate}`, margin, y);
    doc.text(`Total Entries: ${attendanceHistory.length}`, pageW - margin, y, { align: "right" });
    y += 10;

    // Table header
    const colX = [margin, margin + 65, margin + 100, margin + 135];
    const rowH = 8;

    doc.setFillColor(...c600);
    doc.rect(margin, y, contentW, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    ["Date", "Time In", "Time Out", "Total Hours"].forEach((h, i) =>
      doc.text(h, colX[i] + 3, y + 5.2)
    );
    y += rowH;

    // Table rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    attendanceHistory.forEach((record, idx) => {
      const hours = computeHours(record.timeIn, record.timeOut);

      if (idx % 2 === 0) {
        doc.setFillColor(...c50);
        doc.rect(margin, y, contentW, rowH, "F");
      }

      doc.setTextColor(30, 30, 30);
      doc.text(formatDate(record.date),                              colX[0] + 3, y + 5.2);
      doc.text(record.timeIn  ? formatTime(record.timeIn)  : "—",   colX[1] + 3, y + 5.2);
      doc.text(record.timeOut ? formatTime(record.timeOut) : "—",   colX[2] + 3, y + 5.2);

      if (typeof hours === "number") {
        doc.setFillColor(...c200);
        doc.roundedRect(colX[3] + 2, y + 1.5, 26, 5, 2, 2, "F");
        doc.setTextColor(...c700);
        doc.setFont("helvetica", "bold");
        doc.text(`${hours} hrs`, colX[3] + 15, y + 5.2, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 30);
      } else {
        doc.text("—", colX[3] + 3, y + 5.2);
      }

      doc.setDrawColor(...c100);
      doc.line(margin, y + rowH, margin + contentW, y + rowH);
      y += rowH;

      if (y > 270) { doc.addPage(); y = 20; }
    });

    // Totals
    y += 6;
    doc.setDrawColor(...c600);
    doc.setLineWidth(0.8);
    doc.line(margin, y, margin + contentW, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...c600);
    doc.text(`Days Logged: ${totalDays}`,        margin,       y);
    doc.text(`Total Hours: ${totalHours} hrs`,   margin + 55,  y);

    // Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(
      "Generated from the OJT Attendance System  •  For official use only",
      pageW / 2, 285, { align: "center" }
    );

    doc.save("Daily_Time_Record.pdf");
  };

  return (
    <div
      className="min-h-screen p-4 sm:p-6 lg:p-8"
      style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.4), rgb(var(--primary-50)))` }}
    >
      <style>{`
        .dtr-row { transition: background 0.15s; }
        .dtr-row:hover { background: rgb(var(--primary-200) / 0.4) !important; }
        .export-btn { transition: all 0.15s ease; }
        .export-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgb(var(--primary-600) / 0.2); }
        .summary-card { transition: box-shadow 0.15s; }
        .summary-card:hover { box-shadow: 0 8px 24px rgb(var(--primary-600) / 0.12); }
      `}</style>

      <div className="max-w-6xl mx-auto">

        {/* ── Header ── */}
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
          <p className="text-gray-600">Official attendance log of your OJT working hours</p>
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
                style={{
                  border: `4px solid rgb(var(--primary-200))`,
                  borderTopColor: `rgb(var(--primary-600))`,
                }}
              ></div>
              <p className="text-gray-600 font-medium">Loading attendance records...</p>
            </div>
          </div>
        )}

        {!loading && (
          <>
            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {[
                { icon: CalendarDays, label: "Days Logged",  value: totalDays,   sub: "completed entries" },
                { icon: Clock,        label: "Total Hours",  value: totalHours,  sub: "hours rendered"    },
              ].map(({ icon: Icon, label, value, sub }) => (
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
                  <p className="text-sm text-gray-600 mt-1">Complete history of your attendance</p>
                </div>
                <button
                  onClick={exportDTR}
                  className="export-btn flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                  style={{ backgroundColor: `rgb(var(--primary-600))` }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}
                >
                  <Download className="w-4 h-4" />
                  Export DTR
                </button>
              </div>

              {/* Empty State */}
              {attendanceHistory.length === 0 && (
                <div className="p-12 text-center">
                  <Calendar
                    className="w-16 h-16 mx-auto mb-4"
                    style={{ color: `rgb(var(--primary-300))` }}
                  />
                  <p className="text-gray-600 font-medium mb-2">No attendance records yet</p>
                  <p className="text-sm text-gray-500">
                    Your DTR entries will appear here once you start logging attendance.
                  </p>
                </div>
              )}

              {/* ── Desktop Table ── */}
              {attendanceHistory.length > 0 && (
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.6))` }}>
                        {["Date", "Time In", "Time Out", "Total Hours"].map((h) => (
                          <th key={h} className="px-6 py-4 text-left text-sm font-semibold text-gray-700">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {attendanceHistory.map((record) => {
                        const hours = computeHours(record.timeIn, record.timeOut);
                        return (
                          <tr key={record.id} className="dtr-row">
                            <td className="px-6 py-4 text-sm font-medium text-gray-800">{formatDate(record.date)}</td>
                            <td className="px-6 py-4 text-sm text-gray-700">{record.timeIn  ? formatTime(record.timeIn)  : "—"}</td>
                            <td className="px-6 py-4 text-sm text-gray-700">{record.timeOut ? formatTime(record.timeOut) : "—"}</td>
                            <td className="px-6 py-4">
                              {typeof hours === "number" ? (
                                <span
                                  className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full"
                                  style={{
                                    backgroundColor: `rgb(var(--primary-100))`,
                                    color: `rgb(var(--primary-700))`,
                                  }}
                                >
                                  {hours} hrs
                                </span>
                              ) : (
                                <span className="text-sm font-semibold text-gray-800">—</span>
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
                      { label: "Days:",        value: totalDays },
                      { label: "Total Hours:", value: `${totalHours} hrs` },
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
                <div className="sm:hidden divide-y divide-gray-200">
                  {attendanceHistory.map((record) => {
                    const hours = computeHours(record.timeIn, record.timeOut);
                    return (
                      <div key={record.id} className="dtr-row p-4">
                        <div className="flex justify-between items-start mb-3">
                          <p className="font-semibold text-gray-800">{formatDate(record.date)}</p>
                          {typeof hours === "number" ? (
                            <span
                              className="text-xs font-semibold px-3 py-1 rounded-full"
                              style={{
                                backgroundColor: `rgb(var(--primary-100))`,
                                color: `rgb(var(--primary-700))`,
                              }}
                            >
                              {hours} hrs
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: "Time In",  value: record.timeIn  ? formatTime(record.timeIn)  : "—" },
                            { label: "Time Out", value: record.timeOut ? formatTime(record.timeOut) : "—" },
                          ].map(({ label, value }) => (
                            <div
                              key={label}
                              className="rounded-lg p-3"
                              style={{
                                backgroundColor: `rgb(var(--primary-50))`,
                                border: `1px solid rgb(var(--primary-100))`,
                              }}
                            >
                              <p className="text-xs text-gray-600 mb-1">{label}</p>
                              <p className="text-sm font-semibold text-gray-800">{value}</p>
                            </div>
                          ))}
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
                      { label: "Days",        value: totalDays },
                      { label: "Total Hours", value: `${totalHours} hrs` },
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

            {/* Footer note */}
            <p className="text-center text-xs text-gray-400 mt-6">
              For official OJT documentation purposes only
            </p>
          </>
        )}
      </div>
    </div>
  );
}