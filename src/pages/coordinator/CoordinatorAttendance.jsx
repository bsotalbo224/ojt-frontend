import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Users,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  TrendingUp,
  ArrowRight,
  Coffee,
  Utensils,
  CircleDot,
  XCircle,
  Activity,
} from 'lucide-react';
import { getCoordinatorAttendance } from '../../api/attendance';
import Avatar from "../../components/ui/Avatar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const resolveFullName = (r) => {
  if (r.student_name && r.student_name.trim()) return r.student_name.trim();
  const f = (r.f_name ?? '').trim();
  const l = (r.l_name ?? '').trim();
  const combined = [f, l].filter(Boolean).join(' ');
  return combined || 'Unknown Student';
};

const isMissingTimeOut = (t) => !t || t === '00:00:00' || t === '0000-00-00 00:00:00';

const todayString = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Normalize various date formats to "YYYY-MM-DD"
const normalizeDate = (value) => {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '';
  }
};

const formatTime = (value) => {
  if (isMissingTimeOut(value) && value !== undefined) return null;
  if (!value) return null;
  try {
    const date = new Date(value);
    if (!isNaN(date.getTime()) && value.includes('T')) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const [h, m] = value.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
};

const parseTimeToMinutes = (t) => {
  if (!t || isMissingTimeOut(t)) return null;
  try {
    const plain = t.includes('T') ? t.split('T')[1] : t;
    const [h, m] = plain.split(':').map(Number);
    return h * 60 + m;
  } catch {
    return null;
  }
};

/**
 * analyzeSchedule — detect shift type from start_time / end_time.
 * Returns: 'night' | 'half_day' | 'day'
 */
const analyzeSchedule = (record) => {
  const startMins = parseTimeToMinutes(record.start_time);
  const endMins   = parseTimeToMinutes(record.end_time);
  if (startMins === null || endMins === null) return 'day';
  const adjustedEnd = endMins < startMins ? endMins + 24 * 60 : endMins;
  const duration = adjustedEnd - startMins;
  const isNightStart = startMins >= 18 * 60;
  const isCrossMidnight = endMins < startMins;
  if (isNightStart || isCrossMidnight) return 'night';
  if (duration <= 5 * 60) return 'half_day';
  return 'day';
};

/**
 * computeAttendanceStatus — derive attendance status from a record.
 * Returns: 'active' | 'completed' | 'missing_timeout' | 'flagged'
 */
const computeAttendanceStatus = (record) => {
  if (record.location_status === 'flagged') return 'flagged';
  const hasIn  = record.time_in  && !isMissingTimeOut(record.time_in);
  const hasOut = record.time_out && !isMissingTimeOut(record.time_out);
  if (!hasIn) return 'missing_timeout';
  if (hasIn && !hasOut) {
    // Is it an old record (not today)?
    const recDate = normalizeDate(record.attendance_date);
    const today   = todayString();
    if (recDate && recDate < today) return 'missing_timeout';
    return 'active';
  }
  if (hasIn && hasOut) return 'completed';
  return 'missing_timeout';
};

const groupByStudent = (records) => {
  const map = {};
  records.forEach((r) => {
    const id = r.student_id;
    if (!map[id]) {
      map[id] = {
        student_id: id,
        full_name: resolveFullName(r),
        course: r.course ?? '',
        company: r.company ?? '',
        photo: r.photo ?? '',
        records: [],
      };
    }
    map[id].records.push(r);
  });
  return Object.values(map);
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SummaryCard = ({ title, value, icon: Icon, accent, loading }) => (
  <div
    className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow duration-200"
    style={{ border: `1px solid rgb(var(--primary-50))` }}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: `rgb(var(--primary-500))` }}>
          {title}
        </p>
        <p className={`text-3xl font-bold ${accent}`}>
          {loading ? '—' : value}
        </p>
      </div>
      <div className="p-3 rounded-lg" style={{ backgroundColor: `rgb(var(--primary-50))` }}>
        <Icon className="w-5 h-5" style={{ color: `rgb(var(--primary-600))` }} />
      </div>
    </div>
  </div>
);

const StudentCard = ({ student, onClick }) => {
  const { records, full_name } = student;
  const verified   = records.filter((r) => r.location_status === 'verified').length;
  const flagged    = records.filter((r) => r.location_status === 'flagged').length;
  const missingOut = records.filter((r) => isMissingTimeOut(r.time_out)).length;

  return (
    <div
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group h-full"
      style={{ border: `1px solid rgb(var(--primary-50))` }}
      onMouseEnter={e => e.currentTarget.style.borderColor = `rgb(var(--primary-200))`}
      onMouseLeave={e => e.currentTarget.style.borderColor = `rgb(var(--primary-50))`}
    >
      <div className="p-5 flex items-center gap-4">
        <Avatar
          name={full_name}
          src={student.photo && student.photo.startsWith("http") ? student.photo : ""}
          size="md"
        />
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: `rgb(var(--primary-800))` }}>{full_name}</p>
          {student.course && (
            <p className="text-xs truncate mt-0.5" style={{ color: `rgb(var(--primary-500))` }}>{student.course}</p>
          )}
        </div>
      </div>

      <div className="px-5 pb-4 grid grid-cols-3 gap-2 items-stretch">
        <div
          className="flex flex-col items-center justify-center rounded-lg py-2 min-h-14"
          style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}
        >
          <span className="text-lg font-bold" style={{ color: `rgb(var(--primary-600))` }}>{verified}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-center whitespace-nowrap" style={{ color: `rgb(var(--primary-500))` }}>Verified</span>
        </div>
        <div className="flex flex-col items-center justify-center bg-amber-50 border border-amber-100 rounded-lg py-2 min-h-14">
          <span className="text-lg font-bold text-amber-600">{flagged}</span>
          <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide text-center whitespace-nowrap">Flagged</span>
        </div>
        <div className="flex flex-col items-center justify-center bg-orange-50 border border-orange-100 rounded-lg py-2 min-h-14">
          <span className="text-lg font-bold text-orange-500">{missingOut}</span>
          <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-wide text-center whitespace-nowrap">No T-Out</span>
        </div>
      </div>

      <div className="px-5 pb-3">
        <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>
          <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>{records.length}</span>{' '}
          attendance record{records.length !== 1 ? 's' : ''} total
        </p>
      </div>

      <div className="mt-auto px-5 pb-5">
        <button
          onClick={onClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-lg active:scale-[0.98] transition-all duration-150 shadow-sm group-hover:shadow-md"
          style={{ backgroundColor: `rgb(var(--primary-600))` }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}
        >
          <Calendar className="w-4 h-4" />
          View Attendance
          <ChevronRight className="w-4 h-4 ml-auto" />
        </button>
      </div>
    </div>
  );
};

const SkeletonCard = () => (
  <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4 animate-pulse" style={{ border: `1px solid rgb(var(--primary-50))` }}>
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-full" style={{ backgroundColor: `rgb(var(--primary-100))` }} />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 rounded w-3/4" style={{ backgroundColor: `rgb(var(--primary-100))` }} />
        <div className="h-3 rounded w-1/2" style={{ backgroundColor: `rgb(var(--primary-50))` }} />
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2">
      {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-lg" style={{ backgroundColor: `rgb(var(--primary-50))` }} />)}
    </div>
    <div className="h-9 rounded-lg" style={{ backgroundColor: `rgb(var(--primary-100))` }} />
  </div>
);

const EmptyState = ({ hasFilter }) => (
  <div className="col-span-full py-20 flex flex-col items-center gap-3 text-center">
    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: `rgb(var(--primary-50))` }}>
      <Calendar className="w-8 h-8" style={{ color: `rgb(var(--primary-300))` }} />
    </div>
    <p className="text-base font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
      {hasFilter ? 'No matching students' : 'No attendance records yet'}
    </p>
    <p className="text-sm max-w-xs" style={{ color: `rgb(var(--primary-500))` }}>
      {hasFilter ? 'Try adjusting your search or date.' : 'Attendance records will appear once students start logging.'}
    </p>
  </div>
);

const ErrorState = () => (
  <div className="col-span-full py-20 flex flex-col items-center gap-3 text-center">
    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
      <AlertTriangle className="w-8 h-8 text-red-300" />
    </div>
    <p className="text-base font-semibold text-red-700">Failed to load attendance records</p>
    <p className="text-sm text-red-400">Please refresh the page or try again later.</p>
  </div>
);

// ─── Shift Badge ──────────────────────────────────────────────────────────────

const SHIFT_CFG = {
  day:      { label: 'Day Shift',   icon: Sun,    className: 'bg-sky-50 text-sky-700 border border-sky-200'       },
  night:    { label: 'Night Shift', icon: Moon,   className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  half_day: { label: 'Half Day',    icon: Sunset, className: 'bg-amber-50 text-amber-700 border border-amber-200' },
};

const ShiftBadge = ({ shiftType }) => {
  const cfg = SHIFT_CFG[shiftType] ?? SHIFT_CFG.day;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.className}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
};

// ─── Attendance Status Badge ──────────────────────────────────────────────────

const STATUS_CFG = {
  active:          { label: 'Active',           icon: Activity,    className: 'bg-green-50 text-green-700 border border-green-200'   },
  completed:       { label: 'Completed',        icon: CheckCircle, className: 'bg-sky-50 text-sky-700 border border-sky-200'         },
  missing_timeout: { label: 'Missing Time-Out', icon: XCircle,     className: 'bg-orange-50 text-orange-700 border border-orange-200' },
  flagged:         { label: 'Flagged',          icon: MapPin,      className: 'bg-amber-50 text-amber-700 border border-amber-200'   },
};

const AttendanceStatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.missing_timeout;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${cfg.className}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
};

// ─── Workflow Display ─────────────────────────────────────────────────────────

/**
 * Renders a compact inline workflow like:
 * 8:00 AM → Lunch → 5:00 PM  [+OT 6:00 PM – 8:00 PM]
 */
const WorkflowDisplay = ({ record, shiftType }) => {
  const timeIn   = formatTime(record.time_in);
  const timeOut  = formatTime(record.time_out);
  const lunchIn  = formatTime(record.lunch_break_start);
  const lunchOut = formatTime(record.lunch_break_end);
  const otIn     = formatTime(record.ot_time_in);
  const otOut    = formatTime(record.ot_time_out);

  const mealLabel = shiftType === 'night' ? 'Meal' : 'Lunch';

  const hasTimeIn  = !!timeIn;
  const hasTimeOut = !!timeOut;
  const hasLunch   = !!lunchIn;
  const hasOT      = !!otIn;

  if (!hasTimeIn) {
    return <span className="text-xs text-gray-400 italic">No attendance</span>;
  }

  // Detect overnight for "+1 day" label
  const inMins  = parseTimeToMinutes(record.time_in);
  const outMins = parseTimeToMinutes(record.time_out);
  const isOvernight = inMins !== null && outMins !== null && outMins < inMins;

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      {/* Time In */}
      <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>{timeIn}</span>

      {/* Lunch/Meal */}
      {hasLunch && (
        <>
          <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-100">
            <Utensils className="w-2.5 h-2.5" />{mealLabel}
          </span>
        </>
      )}
      {!hasLunch && shiftType !== 'half_day' && hasTimeOut && (
        <>
          <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-50 text-gray-400 text-[10px] border border-gray-100">
            <Coffee className="w-2.5 h-2.5" />{mealLabel}
          </span>
        </>
      )}

      {/* Time Out */}
      {hasTimeOut ? (
        <>
          <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
          <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>
            {timeOut}
            {isOvernight && (
              <span className="ml-1 text-[9px] font-medium px-1 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">+1d</span>
            )}
          </span>
        </>
      ) : (
        <>
          <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-50 text-orange-500 text-[10px] font-semibold border border-orange-100 animate-pulse">
            <CircleDot className="w-2.5 h-2.5" />Ongoing
          </span>
        </>
      )}

      {/* OT */}
      {hasOT && (
        <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-semibold border border-indigo-100">
          <TrendingUp className="w-2.5 h-2.5" />OT {otIn}{otOut ? ` – ${otOut}` : ''}
        </span>
      )}
    </div>
  );
};

// ─── Attendance Table ─────────────────────────────────────────────────────────

const AttendanceTable = ({ records }) => {
  if (records.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid rgb(var(--primary-50))` }}>
      <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid rgb(var(--primary-100))` }}>
        <h2 className="text-lg font-bold" style={{ color: `rgb(var(--primary-800))` }}>Attendance Details</h2>
        <span className="text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: `rgb(var(--primary-50))`, color: `rgb(var(--primary-600))`, border: `1px solid rgb(var(--primary-100))` }}>
          {records.length} record{records.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: `rgb(var(--primary-50))`, borderBottom: `1px solid rgb(var(--primary-100))` }}>
              {['Student', 'Date', 'Time In', 'Meal Break', 'Time Out', 'OT', 'Location', 'Status'].map((col) => (
                <th
                  key={col}
                  className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                  style={{ color: `rgb(var(--primary-700))` }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record, idx) => {
              const shiftType  = analyzeSchedule(record);
              const attStatus  = computeAttendanceStatus(record);
              const timeIn     = formatTime(record.time_in);
              const timeOut    = formatTime(record.time_out);
              const lunchStart = formatTime(record.lunch_break_start);
              const lunchEnd   = formatTime(record.lunch_break_end);
              const otIn       = formatTime(record.ot_time_in);
              const otOut      = formatTime(record.ot_time_out);
              const mealLabel  = shiftType === 'night' ? 'Meal' : 'Lunch';

              // Overnight indicator
              const inMins  = parseTimeToMinutes(record.time_in);
              const outMins = parseTimeToMinutes(record.time_out);
              const isOvernight = inMins !== null && outMins !== null && outMins < inMins;

              const fullName = resolveFullName(record);

              return (
                <tr
                  key={`${record.student_id}-${record.attendance_date}-${idx}`}
                  className="transition-colors"
                  style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50) / 0.5)`}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                >
                  {/* Student */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        name={fullName}
                        src={record.photo && record.photo.startsWith("http") ? record.photo : ""}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: `rgb(var(--primary-800))` }}>{fullName}</p>
                        <ShiftBadge shiftType={shiftType} />
                      </div>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-4">
                    <span className="text-xs whitespace-nowrap" style={{ color: `rgb(var(--primary-700))` }}>
                      {record.attendance_date
                        ? new Date(record.attendance_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </span>
                  </td>

                  {/* Time In */}
                  <td className="py-3.5 px-4">
                    {timeIn ? (
                      <span className="text-xs font-semibold" style={{ color: `rgb(var(--primary-700))` }}>{timeIn}</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  {/* Meal Break */}
                  <td className="py-3.5 px-4">
                    {lunchStart && lunchEnd ? (
                      <span className="text-xs font-medium text-amber-700 whitespace-nowrap">
                        {lunchStart} – {lunchEnd}
                      </span>
                    ) : lunchStart ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                        <CircleDot className="w-3 h-3 animate-pulse" />{mealLabel} ongoing
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  {/* Time Out */}
                  <td className="py-3.5 px-4">
                    {timeOut ? (
                      <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: `rgb(var(--primary-700))` }}>
                        {timeOut}
                        {isOvernight && (
                          <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">+1d</span>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-orange-500 font-medium">
                        <CircleDot className="w-3 h-3 animate-pulse" />Ongoing
                      </span>
                    )}
                  </td>

                  {/* OT */}
                  <td className="py-3.5 px-4">
                    {otIn ? (
                      <span className="text-xs font-medium text-indigo-700 whitespace-nowrap">
                        {otIn}{otOut ? ` – ${otOut}` : <span className="text-indigo-400"> ongoing</span>}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  {/* Location */}
                  <td className="py-3.5 px-4">
                    {record.location_status === 'flagged' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <MapPin className="w-3 h-3" />Flagged
                      </span>
                    ) : record.location_status === 'verified' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                        <CheckCircle className="w-3 h-3" />Verified
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">{record.location_status ?? '—'}</span>
                    )}
                  </td>

                  {/* Attendance Status */}
                  <td className="py-3.5 px-4">
                    <AttendanceStatusBadge status={attStatus} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Table Footer */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderTop: `1px solid rgb(var(--primary-50))`, backgroundColor: `rgb(var(--primary-50) / 0.4)` }}
        >
          <p className="text-xs" style={{ color: `rgb(var(--primary-600))` }}>
            Showing{' '}
            <span className="font-semibold" style={{ color: `rgb(var(--primary-800))` }}>{records.length}</span>{' '}
            {records.length === 1 ? 'record' : 'records'}
          </p>
          <p className="text-xs italic" style={{ color: `rgb(var(--primary-500))` }}>
            Meal break columns reflect actual time punches only.
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const CoordinatorAttendance = () => {
  const navigate = useNavigate();

  const [records,      setRecords]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  // FIX 1: Default to '' so all records show on initial load instead of
  // filtering to today (which produced an empty dashboard when no one had
  // timed-in yet on the current day).
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    getCoordinatorAttendance()
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .catch((err) => { console.error("Attendance API error:", err); setError(true); })
      .finally(() => setLoading(false));
  }, []);

  // FIX 2: When selectedDate is empty return ALL records; otherwise filter by date.
  const filteredRecords = useMemo(() => {
    if (!selectedDate) return records;
    return records.filter((r) => normalizeDate(r.attendance_date) === selectedDate);
  }, [records, selectedDate]);

  // Step 2: group filtered records by student
  const students = useMemo(() => groupByStudent(filteredRecords), [filteredRecords]);

  // Step 3: stats from filtered records
  const stats = useMemo(() => ({
    totalStudents: students.length,
    flagged:    filteredRecords.filter((r) => r.location_status === 'flagged').length,
    missingOut: filteredRecords.filter((r) => isMissingTimeOut(r.time_out)).length,
  }), [students, filteredRecords]);

  // Step 4: search filter on top of grouped students
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const name   = s.full_name.toLowerCase();
      const course = (s.course ?? '').toLowerCase();
      return name.includes(q) || course.includes(q);
    });
  }, [students, searchQuery]);

  // Filtered records that match searched students (for the table)
  const tableRecords = useMemo(() => {
    if (!searchQuery.trim()) return filteredRecords;
    const ids = new Set(filteredStudents.map((s) => s.student_id));
    return filteredRecords.filter((r) => ids.has(r.student_id));
  }, [filteredRecords, filteredStudents, searchQuery]);

  // FIX 3: hasFilter is true when a search query exists OR a date is selected.
  // No longer compared against todayString().
  const hasFilter = searchQuery.trim() !== '' || !!selectedDate;

  // FIX 4: isToday is only true when a date is explicitly selected AND it equals today.
  const isToday = !!selectedDate && selectedDate === todayString();

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), white)` }}
    >
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: `rgb(var(--primary-800))` }}>
              Attendance Monitoring
            </h1>
            <p className="mt-1 text-sm" style={{ color: `rgb(var(--primary-500))` }}>
              Review student time-in, time-out, and location records
            </p>
          </div>
          <div
            className="hidden lg:flex items-center gap-2 text-xs font-medium bg-white rounded-lg px-3 py-2 shadow-sm"
            style={{ color: `rgb(var(--primary-400))`, border: `1px solid rgb(var(--primary-100))` }}
          >
            <Users className="w-3.5 h-3.5" />
            {loading ? '—' : students.length} student{students.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard title="Total Students"     value={stats.totalStudents} icon={Users}         accent="text-gray-800"   loading={loading} />
          <SummaryCard title="Flagged Attendance" value={stats.flagged}       icon={MapPin}         accent="text-amber-600"  loading={loading} />
          <SummaryCard title="Missing Time-Out"   value={stats.missingOut}    icon={AlertTriangle}  accent="text-orange-500" loading={loading} />
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-2xl shadow-sm px-6 py-4" style={{ border: `1px solid rgb(var(--primary-50))` }}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <h2 className="text-lg font-bold" style={{ color: `rgb(var(--primary-800))` }}>Student Records</h2>

            <div className="flex flex-wrap items-center gap-2">
              {/* Date picker */}
              <div className="relative flex items-center">
                <Calendar className="absolute left-3 w-4 h-4 pointer-events-none" style={{ color: `rgb(var(--primary-400))` }} />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-9 pr-3 py-2 text-sm rounded-lg outline-none transition"
                  style={{
                    border: `1px solid rgb(var(--primary-200))`,
                    backgroundColor: `rgb(var(--primary-50) / 0.4)`,
                    color: `rgb(var(--primary-800))`,
                  }}
                  onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                  onBlur={e  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
                />
              </div>

              {/* Today quick-filter: show as active badge when already on today,
                  or as a clickable button when on any other date/no date */}
              {isToday ? (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg"
                  style={{ backgroundColor: `rgb(var(--primary-50))`, color: `rgb(var(--primary-600))`, border: `1px solid rgb(var(--primary-200))` }}
                >
                  <Clock className="w-3.5 h-3.5" />Today
                </span>
              ) : (
                <button
                  onClick={() => setSelectedDate(todayString())}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors"
                  style={{
                    backgroundColor: `rgb(var(--primary-600))`,
                    color: 'white',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}
                >
                  <Clock className="w-3.5 h-3.5" />Today
                </button>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `rgb(var(--primary-400))` }} />
                <input
                  type="text"
                  placeholder="Search by name or course…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm rounded-lg w-56 transition outline-none"
                  style={{
                    border: `1px solid rgb(var(--primary-200))`,
                    backgroundColor: `rgb(var(--primary-50) / 0.4)`,
                    color: `rgb(var(--primary-800))`,
                  }}
                  onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                  onBlur={e  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
                />
              </div>
            </div>
          </div>

          {hasFilter && !loading && (
            <p className="text-xs mt-2" style={{ color: `rgb(var(--primary-500))` }}>
              Showing{' '}
              <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>{filteredStudents.length}</span>{' '}
              of{' '}
              <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>{students.length}</span>{' '}
              student{students.length !== 1 ? 's' : ''}{selectedDate ? (
                <> for{' '}
                  <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </>
              ) : null}
            </p>
          )}
        </div>

        {/* Student Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          ) : error ? (
            <ErrorState />
          ) : filteredStudents.length === 0 ? (
            <EmptyState hasFilter={hasFilter} />
          ) : (
            filteredStudents.map((student) => (
              <StudentCard
                key={student.student_id}
                student={student}
                onClick={() => navigate(`/coordinator/attendance/${student.student_id}`)}
              />
            ))
          )}
        </div>

        {/* Attendance Details Table */}
        {!loading && !error && tableRecords.length > 0 && (
          <AttendanceTable records={tableRecords} />
        )}

      </div>
    </div>
  );
};

export default CoordinatorAttendance;