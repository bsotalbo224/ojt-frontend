import {
  X, CalendarClock, LogIn, LogOut, Coffee, Moon,
} from 'lucide-react';
import Avatar from '../../../components/ui/Avatar';
import { analyzeShift } from '../../../utils/shiftUtils';
import {
  formatTime12h,
  safePercent,
  computeTotalHours,
  getAttendanceStatus,
  getEarlyAttendanceInfo,
} from '../../../utils/attendanceUtils';
import WorkflowCell from './WorkflowCell';
import ScheduleBadge from './ScheduleBadge';

// ─── EarlyAttendanceBadges ────────────────────────────────────────────────────
// Renders the "early mins" + approval-status pair for an early-arrival record,
// plus the rejected/pending counted-time line with its hover tooltip.

const EARLY_STATUS_STYLE = {
  approved: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', label: 'Approved' },
  rejected: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', label: 'Rejected' },
  pending:  { bg: '#fffbeb', border: '#fde68a', text: '#a16207', label: 'Pending'  },
};

const EarlyAttendanceBadges = ({ record }) => {
  const info = getEarlyAttendanceInfo(record);
  if (!info) return null;

  const style = EARLY_STATUS_STYLE[info.status] || EARLY_STATUS_STYLE.pending;
  const tooltip = !info.isCounted
    ? `Actual Time-In: ${formatTime12h(info.actualTimeIn)}\nStatus: ${style.label}\n${info.countedLabel}: ${formatTime12h(info.countedTimeIn)}`
    : undefined;

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1" title={tooltip}>
      {info.earlyMins != null && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
          {info.earlyMins}m early
        </span>
      )}
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
        style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.text }}>
        {style.label}
      </span>
      {!info.isCounted && (
        <span className="text-[10px]" style={{ color: '#9ca3af' }}>
          counted as {formatTime12h(info.countedTimeIn)}
        </span>
      )}
    </div>
  );
};

// ─── Progress Modal ───────────────────────────────────────────────────────────

const ProgressModal = ({ progressData, progressLoading, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-9998 p-4">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="h-2 w-full" style={{ background: `linear-gradient(to right, rgb(var(--primary-700)), rgb(var(--primary-600)), rgb(var(--primary-500)))` }} />
        <button onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 z-10"
          style={{ backgroundColor: `rgb(var(--primary-50))`, color: `rgb(var(--primary-500))` }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-100))`; e.currentTarget.style.color = `rgb(var(--primary-700))`; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`;  e.currentTarget.style.color = `rgb(var(--primary-500))`; }}>
          <X className="w-4 h-4" />
        </button>

        <div className="p-8 overflow-y-auto max-h-[85vh]">
          {progressLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-full animate-spin" style={{ border: `4px solid rgb(var(--primary-100))`, borderTopColor: `rgb(var(--primary-600))` }} />
              <p className="text-sm tracking-wide" style={{ color: `rgb(var(--primary-500))` }}>Loading progress...</p>
            </div>
          ) : progressData ? (
            <>
              <div className="flex items-start gap-4 mb-6">
                <Avatar name={`${progressData.student?.f_name} ${progressData.student?.l_name}`} src={progressData.student?.photo} size="lg" />
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-tight" style={{ color: `rgb(var(--primary-800))` }}>
                    {progressData.student?.f_name} {progressData.student?.l_name}
                  </h2>
                  <p className="text-sm mt-0.5" style={{ color: `rgb(var(--primary-500))` }}>OJT Progress Overview</p>
                  {(progressData.student?.start_time || progressData.student?.end_time) && (
                    <div className="mt-2">
                      <ScheduleBadge startTime={progressData.student.start_time} endTime={progressData.student.end_time} />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[{ label: 'Course', value: progressData.student?.course ?? '—' }, { label: 'Company', value: progressData.student?.company ?? '—' }].map(({ label, value }) => (
                  <div key={label} className="rounded-xl px-5 py-4" style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: `rgb(var(--primary-400))` }}>{label}</p>
                    <p className="text-sm font-semibold truncate" style={{ color: `rgb(var(--primary-800))` }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* ── Progress bar — guarded against division by zero ── */}
              {(() => {
                const pct = safePercent(progressData.hoursCompleted, progressData.student?.ojt_hours_required);
                return (
                  <div className="rounded-xl px-5 py-5 mb-4" style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), rgb(var(--primary-100)))`, border: `1px solid rgb(var(--primary-100))` }}>
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: `rgb(var(--primary-400))` }}>Hours Completed</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold" style={{ color: `rgb(var(--primary-800))` }}>{progressData.hoursCompleted}</span>
                          <span className="text-sm" style={{ color: `rgb(var(--primary-500))` }}>/ {progressData.student?.ojt_hours_required} hrs</span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ color: `rgb(var(--primary-600))`, backgroundColor: `rgb(var(--primary-100))` }}>
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full rounded-full h-2.5 overflow-hidden" style={{ backgroundColor: `rgb(var(--primary-100))` }}>
                      <div className="h-2.5 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: `linear-gradient(to right, rgb(var(--primary-500)), rgb(var(--primary-400)))` }} />
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-3 gap-3 mb-4">
                {[{ label: 'Days Attended', value: progressData.attendanceDays ?? 0 }, { label: 'Records', value: progressData.attendanceRecords ?? 0 }].map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-xl px-4 py-4 shadow-sm text-center" style={{ border: `1px solid rgb(var(--primary-100))` }}>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: `rgb(var(--primary-400))` }}>{label}</p>
                    <p className="text-2xl font-bold" style={{ color: `rgb(var(--primary-800))` }}>{value}</p>
                  </div>
                ))}
                <div className="bg-white rounded-xl px-4 py-4 shadow-sm text-center" style={{ border: `1px solid rgb(var(--primary-100))` }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: `rgb(var(--primary-400))` }}>Last Attendance</p>
                  <p className="text-sm font-semibold mt-1" style={{ color: `rgb(var(--primary-800))` }}>
                    {(() => { const d = progressData?.lastAttendance ? new Date(progressData.lastAttendance) : null; return d && !isNaN(d) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; })()}
                  </p>
                </div>
              </div>

              {/* Recent Attendance — dynamic workflow-based */}
              {progressData.recentAttendance?.some((r) => r?.date) && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: `1px solid rgb(var(--primary-100))` }}>
                  <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2"
                    style={{ borderBottom: `1px solid rgb(var(--primary-50))`, backgroundColor: `rgb(var(--primary-50))` }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: `rgb(var(--primary-600))` }}>Recent Attendance</p>
                    <div className="flex items-center gap-3">
                      {[
                        { dot: '#e5e7eb', label: 'No record',  text: '#9ca3af' },
                        { dot: '#fde68a', label: 'In progress', text: '#a16207' },
                        { dot: '#bbf7d0', label: 'Completed',   text: '#15803d' },
                        { dot: '#fecaca', label: 'Excluded',    text: '#dc2626' },
                      ].map(({ dot, label, text }) => (
                        <span key={label} className="flex items-center gap-1 text-xs" style={{ color: text }}>
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: dot }} />{label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ backgroundColor: `rgb(var(--primary-50))` }}>
                          {[
                            { label: 'Date',       Icon: null          },
                            { label: 'Schedule',   Icon: CalendarClock },
                            { label: 'Work Hours', Icon: LogIn         },
                            { label: 'Break',      Icon: Coffee        },
                            { label: 'Time Out',   Icon: LogOut        },
                            { label: 'Overtime',   Icon: Moon          },
                            { label: 'Total',      Icon: null          },
                            { label: 'Status',     Icon: null          },
                          ].map(({ label, Icon }) => (
                            <th key={label} className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: `rgb(var(--primary-500))` }}>
                              <span className="inline-flex items-center gap-1">
                                {Icon && <Icon className="w-3 h-3" style={{ color: `rgb(var(--primary-400))` }} />}
                                {label}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {progressData.recentAttendance.filter((r) => r?.date).map((rec, idx) => {
                          const isFlagged = rec.location_status === 'flagged';

                          const startT  = rec.start_time || progressData.student?.start_time;
                          const endT    = rec.end_time   || progressData.student?.end_time;
                          const recWithSched = { ...rec, start_time: startT, end_time: endT };
                          const { isNightShift, isHalfDay, shiftType } = analyzeShift(startT, endT);
                          const breakLabel    = isNightShift ? 'On Meal Break' : 'On Break';
                          // computeTotalHours and getAttendanceStatus both already
                          // short-circuit flagged records internally, and both also
                          // already use the effective (early-attendance-aware) time-in.
                          // NOTE: computeTotalHours() always returns a number (>= 0) —
                          // it no longer returns '—' for incomplete records — so
                          // completeness must be derived from the raw record fields,
                          // not from the value total itself.
                          const total               = computeTotalHours(recWithSched);
                          const hasCompleteAttendance = Boolean(rec.time_in && rec.time_out);
                          const status         = getAttendanceStatus(recWithSched);
                          const schedStart    = formatTime12h(startT);
                          const schedEnd      = formatTime12h(endT);

                          return (
                            <tr key={idx} className="transition-colors duration-150" style={{ borderTop: `1px solid rgb(var(--primary-50))` }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>

                              {/* Date + shift badge */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <p className="text-sm font-medium" style={{ color: `rgb(var(--primary-800))` }}>
                                  {(() => { const d = rec?.date ? new Date(rec.date) : null; return d && !isNaN(d) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; })()}
                                </p>
                                {shiftType !== 'Day Shift' && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                    style={{
                                      background: isHalfDay ? '#fefce8' : '#f5f3ff',
                                      border: `1px solid ${isHalfDay ? '#fde68a' : '#ddd6fe'}`,
                                      color: isHalfDay ? '#a16207' : '#6d28d9',
                                    }}>
                                    {shiftType}
                                  </span>
                                )}
                              </td>

                              {/* Schedule */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                {schedStart && schedEnd
                                  ? <span className="text-xs font-medium" style={{ color: `rgb(var(--primary-500))` }}>{schedStart} – {schedEnd}</span>
                                  : <span className="text-xs text-gray-400">—</span>}
                              </td>

                              {/* Work Hours */}
                              <td className="py-3 px-4">
                                <WorkflowCell start={rec.time_in} end={rec.time_out} inProgressLabel="Working" />
                                {!isFlagged && <EarlyAttendanceBadges record={recWithSched} />}
                              </td>

                              {/* Break (hidden for half-day) */}
                              <td className="py-3 px-4">
                                {isHalfDay
                                  ? <span className="text-xs text-gray-400 italic">N/A</span>
                                  : <WorkflowCell start={rec.lunch_break_start} end={rec.lunch_break_end} inProgressLabel={breakLabel} />}
                              </td>

                              {/* Time Out */}
                              <td className="py-3 px-4">
                                {rec.time_out
                                  ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
                                      style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>{formatTime12h(rec.time_out)}</span>
                                  : <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
                                      style={{ backgroundColor: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb' }}>—</span>}
                              </td>

                              {/* Overtime */}
                              <td className="py-3 px-4">
                                <WorkflowCell start={rec.ot_time_in} end={rec.ot_time_out} inProgressLabel="OT Active" />
                              </td>

                              {/* Total — "Excluded" for flagged, "—" for incomplete, computed hours otherwise */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                {isFlagged ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold"
                                    style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                                    Excluded
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold"
                                    style={!hasCompleteAttendance
                                      ? { backgroundColor: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb' }
                                      : { backgroundColor: `rgb(var(--primary-50))`, color: `rgb(var(--primary-700))`, border: `1px solid rgb(var(--primary-100))` }}>
                                    {!hasCompleteAttendance ? '—' : `${total} hrs`}
                                  </span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                                  style={{ backgroundColor: status.bg, color: status.text, border: `1px solid ${status.border}` }}>
                                  {status.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: `rgb(var(--primary-400))` }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: `rgb(var(--primary-50))` }}>
                <X className="w-5 h-5" />
              </div>
              <p className="text-sm">No progress data found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressModal;