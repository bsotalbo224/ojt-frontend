import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
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
  CircleDot,
  XCircle,
  Activity,
  X,
  Paperclip,
} from 'lucide-react';
import {
  getCoordinatorAttendance,
  getPendingEarlyAttendance,
  approveEarlyAttendance,
  rejectEarlyAttendance,
} from '../../api/attendance';
import Avatar from '../../components/ui/Avatar';

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
    if (!isNaN(date.getTime()) && typeof value === 'string' && value.includes('T')) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (typeof value !== 'string') return null;
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
    const plain = typeof t === 'string' && t.includes('T') ? t.split('T')[1] : t;
    if (typeof plain !== 'string') return null;
    const [h, m] = plain.split(':').map(Number);
    return h * 60 + m;
  } catch {
    return null;
  }
};

const analyzeSchedule = (record) => {
  const startMins = parseTimeToMinutes(record.start_time);
  const endMins = parseTimeToMinutes(record.end_time);
  if (startMins === null || endMins === null) return 'day';
  const adjustedEnd = endMins < startMins ? endMins + 24 * 60 : endMins;
  const duration = adjustedEnd - startMins;
  const isNightStart = startMins >= 18 * 60;
  const isCrossMidnight = endMins < startMins;
  if (isNightStart || isCrossMidnight) return 'night';
  if (duration <= 5 * 60) return 'half_day';
  return 'day';
};

// Fix 2: Distinguish missing time-in from missing time-out.
// Records with no time_in are treated as missing_timein.
// This should be rare and usually indicates incomplete or corrupted attendance data.
const computeAttendanceStatus = (record) => {
  if (record.location_status === 'flagged') return 'flagged';
  const hasIn = record.time_in && !isMissingTimeOut(record.time_in);
  const hasOut = record.time_out && !isMissingTimeOut(record.time_out);
  if (!hasIn) return 'missing_timein';
  if (hasIn && !hasOut) {
    const recDate = normalizeDate(record.attendance_date);
    const today = todayString();
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

// Fix 2 (image detection): supports query-string URLs (e.g. signed Cloudinary/S3 URLs)
const isImageFile = (url = '') => {
  return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
};

// ─── Custom Calendar Popover ──────────────────────────────────────────────────

const CalendarPopover = ({ selectedDate, onSelect, onClear }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selectedDateObj = selectedDate ? new Date(selectedDate + 'T00:00:00') : undefined;

  const displayLabel = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'All dates';

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDaySelect = (day) => {
    if (!day) return;
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, '0');
    const d = String(day.getDate()).padStart(2, '0');
    onSelect(`${y}-${m}-${d}`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 pl-3 pr-2 py-2 text-sm rounded-lg transition-all outline-none"
        style={{
          border: open
            ? `1px solid rgb(var(--primary-400))`
            : `1px solid rgb(var(--primary-200))`,
          backgroundColor: open
            ? `rgb(var(--primary-50))`
            : `rgb(var(--primary-50) / 0.4)`,
          color: selectedDate ? `rgb(var(--primary-800))` : `rgb(var(--primary-400))`,
          boxShadow: open ? `0 0 0 2px rgb(var(--primary-200))` : 'none',
        }}
      >
        <Calendar className="w-4 h-4 shrink-0" style={{ color: `rgb(var(--primary-400))` }} />
        <span className="text-sm font-medium">{displayLabel}</span>
        {selectedDate && (
          <span
            className="ml-1 p-0.5 rounded-full hover:bg-orange-100 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            <X className="w-3 h-3" style={{ color: `rgb(var(--primary-500))` }} />
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          className="absolute top-full mt-2 z-50 rounded-2xl shadow-xl overflow-hidden"
          style={{
            border: `1px solid rgb(var(--primary-100))`,
            backgroundColor: 'white',
            minWidth: '280px',
          }}
        >
          <style>{`
            .rdp {
              --rdp-cell-size: 36px;
              --rdp-accent-color: rgb(var(--primary-600));
              --rdp-background-color: rgb(var(--primary-50));
              --rdp-accent-color-dark: rgb(var(--primary-700));
              --rdp-background-color-dark: rgb(var(--primary-100));
              --rdp-outline: 2px solid rgb(var(--primary-300));
              --rdp-outline-selected: 2px solid rgb(var(--primary-600));
              margin: 0;
              padding: 12px;
            }
            .rdp-months { justify-content: center; }
            .rdp-head_cell {
              font-size: 11px;
              font-weight: 700;
              color: rgb(var(--primary-400));
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .rdp-day {
              font-size: 13px;
              font-weight: 500;
              border-radius: 8px;
              color: rgb(var(--primary-800));
            }
            .rdp-day:hover:not(.rdp-day_selected):not(.rdp-day_disabled) {
              background-color: rgb(var(--primary-50)) !important;
              color: rgb(var(--primary-700)) !important;
            }
            .rdp-day_selected, .rdp-day_selected:hover {
              background-color: rgb(var(--primary-600)) !important;
              color: white !important;
              font-weight: 700;
            }
            .rdp-day_today:not(.rdp-day_selected) {
              color: rgb(var(--primary-600));
              font-weight: 700;
              border: 1.5px solid rgb(var(--primary-300));
              border-radius: 8px;
            }
            .rdp-day_outside { opacity: 0.35; }
            .rdp-nav_button {
              color: rgb(var(--primary-600));
              border-radius: 8px;
            }
            .rdp-nav_button:hover {
              background-color: rgb(var(--primary-50)) !important;
            }
            .rdp-caption_label {
              font-size: 14px;
              font-weight: 700;
              color: rgb(var(--primary-800));
            }
          `}</style>
          <DayPicker
            mode="single"
            selected={selectedDateObj}
            onSelect={handleDaySelect}
            showOutsideDays
          />
          {/* Footer quick actions */}
          <div
            className="px-3 pb-3 flex gap-2"
            style={{ borderTop: `1px solid rgb(var(--primary-50))`, paddingTop: '8px' }}
          >
            <button
              className="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors"
              style={{ backgroundColor: `rgb(var(--primary-600))`, color: 'white' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`)}
              onClick={() => {
                onSelect(todayString());
                setOpen(false);
              }}
            >
              Today
            </button>
            {selectedDate && (
              <button
                className="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                style={{
                  backgroundColor: `rgb(var(--primary-50))`,
                  color: `rgb(var(--primary-600))`,
                  border: `1px solid rgb(var(--primary-200))`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `rgb(var(--primary-100))`)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`)}
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SummaryCard = ({ title, value, icon: Icon, accent, loading }) => (
  <div
    className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow duration-200"
    style={{ border: `1px solid rgb(var(--primary-50))` }}
  >
    <div className="flex items-start justify-between">
      <div>
        <p
          className="text-xs font-semibold uppercase tracking-wider mb-1"
          style={{ color: `rgb(var(--primary-500))` }}
        >
          {title}
        </p>
        <p className={`text-3xl font-bold ${accent}`}>{loading ? '—' : value}</p>
      </div>
      <div className="p-3 rounded-lg" style={{ backgroundColor: `rgb(var(--primary-50))` }}>
        <Icon className="w-5 h-5" style={{ color: `rgb(var(--primary-600))` }} />
      </div>
    </div>
  </div>
);

const StudentCard = ({ student, onClick }) => {
  const { records, full_name } = student;
  const verified = records.filter((r) => r.location_status === 'verified').length;
  const flagged = records.filter((r) => r.location_status === 'flagged').length;
  // Exclude flagged records from missing time-out count (they belong in Flagged only)
  const missingOut = records.filter(
    (r) =>
      r.location_status !== 'flagged' &&
      isMissingTimeOut(r.time_out)
  ).length;

  return (
    <div
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group h-full"
      style={{ border: `1px solid rgb(var(--primary-50))` }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = `rgb(var(--primary-200))`)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = `rgb(var(--primary-50))`)}
    >
      <div className="p-5 flex items-center gap-4">
        <Avatar
          name={full_name}
          src={student.photo && student.photo.startsWith('http') ? student.photo : ''}
          size="md"
        />
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: `rgb(var(--primary-800))` }}>
            {full_name}
          </p>
          {student.course && (
            <p className="text-xs truncate mt-0.5" style={{ color: `rgb(var(--primary-500))` }}>
              {student.course}
            </p>
          )}
        </div>
      </div>

      <div className="px-5 pb-4 grid grid-cols-3 gap-2 items-stretch">
        <div
          className="flex flex-col items-center justify-center rounded-lg py-2 min-h-14"
          style={{
            backgroundColor: `rgb(var(--primary-50))`,
            border: `1px solid rgb(var(--primary-100))`,
          }}
        >
          <span className="text-lg font-bold" style={{ color: `rgb(var(--primary-600))` }}>
            {verified}
          </span>
          <span
            className="text-[10px] font-semibold uppercase tracking-wide text-center whitespace-nowrap"
            style={{ color: `rgb(var(--primary-500))` }}
          >
            Verified
          </span>
        </div>
        <div className="flex flex-col items-center justify-center bg-amber-50 border border-amber-100 rounded-lg py-2 min-h-14">
          <span className="text-lg font-bold text-amber-600">{flagged}</span>
          <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide text-center whitespace-nowrap">
            Flagged
          </span>
        </div>
        <div className="flex flex-col items-center justify-center bg-orange-50 border border-orange-100 rounded-lg py-2 min-h-14">
          <span className="text-lg font-bold text-orange-500">{missingOut}</span>
          <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-wide text-center whitespace-nowrap">
            No T-Out
          </span>
        </div>
      </div>

      <div className="px-5 pb-3">
        <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>
          <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>
            {records.length}
          </span>{' '}
          attendance record{records.length !== 1 ? 's' : ''} total
        </p>
      </div>

      <div className="mt-auto px-5 pb-5">
        <button
          onClick={onClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-lg active:scale-[0.98] transition-all duration-150 shadow-sm group-hover:shadow-md"
          style={{ backgroundColor: `rgb(var(--primary-600))` }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`)}
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
  <div
    className="bg-white rounded-2xl shadow-sm p-5 space-y-4 animate-pulse"
    style={{ border: `1px solid rgb(var(--primary-50))` }}
  >
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-full" style={{ backgroundColor: `rgb(var(--primary-100))` }} />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 rounded w-3/4" style={{ backgroundColor: `rgb(var(--primary-100))` }} />
        <div className="h-3 rounded w-1/2" style={{ backgroundColor: `rgb(var(--primary-50))` }} />
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 rounded-lg" style={{ backgroundColor: `rgb(var(--primary-50))` }} />
      ))}
    </div>
    <div className="h-9 rounded-lg" style={{ backgroundColor: `rgb(var(--primary-100))` }} />
  </div>
);

const SkeletonRow = () => (
  <tr className="animate-pulse">
    {Array.from({ length: 8 }).map((_, i) => (
      <td key={i} className="py-3.5 px-4">
        <div
          className="h-4 rounded"
          style={{
            backgroundColor: `rgb(var(--primary-50))`,
            width: i === 0 ? '120px' : i === 1 ? '80px' : '60px',
          }}
        />
      </td>
    ))}
  </tr>
);

const EmptyState = ({ hasFilter }) => (
  <div className="col-span-full py-20 flex flex-col items-center gap-3 text-center">
    <div
      className="w-16 h-16 rounded-full flex items-center justify-center"
      style={{ backgroundColor: `rgb(var(--primary-50))` }}
    >
      <Calendar className="w-8 h-8" style={{ color: `rgb(var(--primary-300))` }} />
    </div>
    <p className="text-base font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
      {hasFilter ? 'No matching students' : 'No attendance records yet'}
    </p>
    <p className="text-sm max-w-xs" style={{ color: `rgb(var(--primary-500))` }}>
      {hasFilter
        ? 'Try adjusting your search or date.'
        : 'Attendance records will appear once students start logging.'}
    </p>
  </div>
);

const EmptyTableState = () => (
  <tr>
    <td colSpan={8} className="py-20">
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `rgb(var(--primary-50))` }}
        >
          <Calendar className="w-8 h-8" style={{ color: `rgb(var(--primary-300))` }} />
        </div>
        <p className="text-base font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
          No records for this date
        </p>
        <p className="text-sm" style={{ color: `rgb(var(--primary-500))` }}>
          Try selecting a different date.
        </p>
      </div>
    </td>
  </tr>
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
  day: { label: 'Day Shift', icon: Sun, className: 'bg-sky-50 text-sky-700 border border-sky-200' },
  night: {
    label: 'Night Shift',
    icon: Moon,
    className: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  },
  half_day: {
    label: 'Half Day',
    icon: Sunset,
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
};

const ShiftBadge = ({ shiftType }) => {
  const cfg = SHIFT_CFG[shiftType] ?? SHIFT_CFG.day;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.className}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

// ─── Attendance Status Badge ──────────────────────────────────────────────────

const STATUS_CFG = {
  active: {
    label: 'Active',
    icon: Activity,
    className: 'bg-green-50 text-green-700 border border-green-200',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    className: 'bg-sky-50 text-sky-700 border border-sky-200',
  },
  // Fix 2: separate badge for missing time-in vs missing time-out
  missing_timein: {
    label: 'Missing Time-In',
    icon: AlertTriangle,
    className: 'bg-red-50 text-red-700 border border-red-200',
  },
  missing_timeout: {
    label: 'Missing Time-Out',
    icon: XCircle,
    className: 'bg-orange-50 text-orange-700 border border-orange-200',
  },
  flagged: {
    label: 'Flagged',
    icon: MapPin,
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
};

const AttendanceStatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.missing_timeout;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${cfg.className}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

// ─── Attendance Table (Date-Mode, with lazy rendering + row click) ─────────────

const ROWS_PER_PAGE = 20;

const AttendanceTable = ({ records, onRowClick }) => {
  const [visibleCount, setVisibleCount] = useState(ROWS_PER_PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef(null);

  // Reset visible count when records change (new date selected)
  useEffect(() => {
    setVisibleCount(ROWS_PER_PAGE);
  }, [records]);

  const loadMore = useCallback(() => {
    if (loadingMore || visibleCount >= records.length) return;
    setLoadingMore(true);
    // 300 ms delay is intentional: it lets skeleton rows render and gives the
    // browser a paint frame before appending more DOM nodes, preventing jank
    // during rapid scroll on large record sets.
    setTimeout(() => {
      setVisibleCount((c) => Math.min(c + ROWS_PER_PAGE, records.length));
      setLoadingMore(false);
    }, 300);
  }, [loadingMore, visibleCount, records.length]);

  // IntersectionObserver on the sentinel element
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const visibleRecords = records.slice(0, visibleCount);
  const hasMore = visibleCount < records.length;

  return (
    <div
      className="bg-white rounded-2xl shadow-sm overflow-hidden"
      style={{ border: `1px solid rgb(var(--primary-50))` }}
    >
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: `1px solid rgb(var(--primary-100))` }}
      >
        <h2 className="text-lg font-bold" style={{ color: `rgb(var(--primary-800))` }}>
          Attendance Details
        </h2>
        <span
          className="text-xs font-medium px-3 py-1 rounded-full"
          style={{
            backgroundColor: `rgb(var(--primary-50))`,
            color: `rgb(var(--primary-600))`,
            border: `1px solid rgb(var(--primary-100))`,
          }}
        >
          {records.length} record{records.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              style={{
                backgroundColor: `rgb(var(--primary-50))`,
                borderBottom: `1px solid rgb(var(--primary-100))`,
              }}
            >
              {['Student', 'Date', 'Time In', 'Meal Break', 'Time Out', 'OT', 'Location', 'Status'].map(
                (col) => (
                  <th
                    key={col}
                    className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                    style={{ color: `rgb(var(--primary-700))` }}
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <EmptyTableState />
            ) : (
              <>
                {visibleRecords.map((record, idx) => {
                  const shiftType = analyzeSchedule(record);
                  const attStatus = computeAttendanceStatus(record);
                  const timeIn = formatTime(record.time_in);
                  const timeOut = formatTime(record.time_out);
                  const lunchStart = formatTime(record.lunch_break_start);
                  const lunchEnd = formatTime(record.lunch_break_end);
                  const otIn = formatTime(record.ot_time_in);
                  const otOut = formatTime(record.ot_time_out);
                  const mealLabel = shiftType === 'night' ? 'Meal' : 'Lunch';

                  const inMins = parseTimeToMinutes(record.time_in);
                  const outMins = parseTimeToMinutes(record.time_out);
                  const isOvernight = inMins !== null && outMins !== null && outMins < inMins;

                  const fullName = resolveFullName(record);

                  return (
                    <tr
                      // Fix 1: stable key based on attendance_id; falls back to
                      // composite string only when attendance_id is absent so
                      // filtering and lazy rendering never reuse wrong rows.
                      key={record.attendance_id ?? `${record.student_id}-${record.attendance_date}-${idx}`}
                      className="transition-colors cursor-pointer"
                      style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`)
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                      onClick={() => onRowClick(record)}
                    >
                      {/* Student */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar
                            name={fullName}
                            src={record.photo && record.photo.startsWith('http') ? record.photo : ''}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p
                              className="text-xs font-semibold truncate"
                              style={{ color: `rgb(var(--primary-800))` }}
                            >
                              {fullName}
                            </p>
                            <ShiftBadge shiftType={shiftType} />
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4">
                        <span
                          className="text-xs whitespace-nowrap"
                          style={{ color: `rgb(var(--primary-700))` }}
                        >
                          {record.attendance_date
                            ? new Date(record.attendance_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </span>
                      </td>

                      {/* Time In */}
                      <td className="py-3.5 px-4">
                        {timeIn ? (
                          <span
                            className="text-xs font-semibold"
                            style={{ color: `rgb(var(--primary-700))` }}
                          >
                            {timeIn}
                          </span>
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
                            <CircleDot className="w-3 h-3 animate-pulse" />
                            {mealLabel} ongoing
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Time Out */}
                      <td className="py-3.5 px-4">
                        {timeOut ? (
                          <span
                            className="flex items-center gap-1 text-xs font-semibold"
                            style={{ color: `rgb(var(--primary-700))` }}
                          >
                            {timeOut}
                            {isOvernight && (
                              <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                                +1d
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-orange-500 font-medium">
                            <CircleDot className="w-3 h-3 animate-pulse" />
                            Ongoing
                          </span>
                        )}
                      </td>

                      {/* OT */}
                      <td className="py-3.5 px-4">
                        {otIn ? (
                          <span className="text-xs font-medium text-indigo-700 whitespace-nowrap">
                            {otIn}
                            {otOut ? ` – ${otOut}` : (
                              <span className="text-indigo-400"> ongoing</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4">
                        {record.location_status === 'flagged' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <MapPin className="w-3 h-3" />
                            Flagged
                          </span>
                        ) : record.location_status === 'verified' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle className="w-3 h-3" />
                            Verified
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {record.location_status ?? '—'}
                          </span>
                        )}
                      </td>

                      {/* Attendance Status */}
                      <td className="py-3.5 px-4">
                        <AttendanceStatusBadge status={attStatus} />
                      </td>
                    </tr>
                  );
                })}

                {/* Skeleton rows while loading more */}
                {loadingMore && Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={`sk-${i}`} />)}
              </>
            )}
          </tbody>
        </table>

        {/* Sentinel for IntersectionObserver */}
        {hasMore && <div ref={sentinelRef} className="h-4" />}

        {/* Table Footer */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{
            borderTop: `1px solid rgb(var(--primary-50))`,
            backgroundColor: `rgb(var(--primary-50) / 0.4)`,
          }}
        >
          <p className="text-xs" style={{ color: `rgb(var(--primary-600))` }}>
            Showing{' '}
            <span className="font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
              {Math.min(visibleCount, records.length)}
            </span>{' '}
            of{' '}
            <span className="font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
              {records.length}
            </span>{' '}
            {records.length === 1 ? 'record' : 'records'}
          </p>
          <p className="text-xs italic" style={{ color: `rgb(var(--primary-500))` }}>
            Click any row to view student details.
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Early Attendance Panel ───────────────────────────────────────────────────

const EarlyAttendancePanel = ({
  requests,
  loading,
  actionLoading,
  onApprove,
  onReject,
  onViewAttachment,
}) => {
  if (!loading && requests.length === 0) {
    return null;
  }

  return (
    <div
      className="bg-white rounded-2xl shadow-sm overflow-hidden"
      style={{ border: '1px solid #fde68a' }}
    >
      {/* Panel Header */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid #fef3c7', backgroundColor: '#fffbeb' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#fef3c7' }}
          >
            <AlertTriangle className="w-4 h-4" style={{ color: '#d97706' }} />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight" style={{ color: '#92400e' }}>
              Early Attendance Requests
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>
              Students waiting for approval
            </p>
          </div>
        </div>
        {!loading && (
          <span
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }}
          >
            {requests.length} Pending
          </span>
        )}
      </div>

      {/* Panel Body */}
      <div className="p-5 space-y-4">
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 rounded w-48" style={{ backgroundColor: '#fef3c7' }} />
            <div className="h-4 rounded w-64" style={{ backgroundColor: '#fef3c7' }} />
            <div className="h-4 rounded w-36" style={{ backgroundColor: '#fef3c7' }} />
          </div>
        ) : (
          requests.map((request) => {
            const attendanceId = request.attendance_id ?? request.id ?? null;

            const approving =
              actionLoading?.attendanceId === attendanceId &&
              actionLoading?.action === 'approve';
            const rejecting =
              actionLoading?.attendanceId === attendanceId &&
              actionLoading?.action === 'reject';
            const isProcessing = approving || rejecting;

            const timeIn = formatTime(request.time_in);
            const scheduleStart = formatTime(request.start_time);
            const reasonText = request.early_reason?.trim() || 'No reason provided';
            const attachmentUrl = request.early_attachment_url || null;
            const attachmentName = request.early_attachment_name?.trim() || 'Attachment';
            const hasAttachment = !!attachmentUrl;

            // Minutes-early badge: how far ahead of the scheduled start the
            // student timed in. Only meaningful when both values are present
            // and the time-in genuinely precedes the scheduled start.
            const timeInMins = parseTimeToMinutes(request.time_in);
            const scheduleMins = parseTimeToMinutes(request.start_time);
            const minutesEarly =
              timeInMins !== null && scheduleMins !== null ? scheduleMins - timeInMins : null;
            const showMinutesEarly = minutesEarly !== null && minutesEarly > 0;

            return (
              <div
                key={attendanceId ?? `${request.student_id ?? 'unknown'}-${request.time_in ?? ''}`}
                className="rounded-xl p-4"
                style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">

                  {/* Left: Student Info */}
                  <div className="lg:w-44 shrink-0">
                    <p className="text-sm font-bold leading-tight" style={{ color: '#92400e' }}>
                      {resolveFullName(request)}
                    </p>
                    {request.course && (
                      <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>
                        {request.course}
                      </p>
                    )}
                  </div>

                  {/* Middle: Request Details */}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#b45309' }}>
                          Time In
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold" style={{ color: '#92400e' }}>
                            {timeIn ?? '—'}
                          </p>
                          {showMinutesEarly && (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
                              style={{
                                backgroundColor: '#fde68a',
                                color: '#92400e',
                                border: '1px solid #fbbf24',
                              }}
                            >
                              {minutesEarly} {minutesEarly === 1 ? 'min' : 'mins'} early
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#b45309' }}>
                          Schedule
                        </p>
                        <p className="text-sm font-bold" style={{ color: '#92400e' }}>
                          {scheduleStart ?? '—'}
                        </p>
                      </div>
                    </div>

                    {/* Reason Box */}
                    <div
                      className="rounded-lg px-3 py-2"
                      style={{ backgroundColor: '#fef9c3', border: '1px solid #fde68a' }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#a16207' }}>
                        Reason
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color: '#78350f' }}>
                        {reasonText}
                      </p>
                    </div>

                    {/* Attachment Section */}
                    <div
                      className="rounded-lg px-3 py-2 flex items-center justify-between gap-2"
                      style={{ backgroundColor: '#fef9c3', border: '1px solid #fde68a' }}
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#a16207' }}>
                          Attachment
                        </p>
                        {hasAttachment ? (
                          <p className="text-xs truncate" style={{ color: '#78350f' }} title={attachmentName}>
                            {attachmentName}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400">No attachment</p>
                        )}
                      </div>

                      {hasAttachment && (
                        <a
                          href={attachmentUrl}
                          onClick={(e) => {
                            e.preventDefault();
                            onViewAttachment(attachmentUrl, attachmentName);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors duration-150"
                          style={{ backgroundColor: '#d97706', color: '#fff' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b45309')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#d97706')}
                        >
                          <Paperclip className="w-3.5 h-3.5 shrink-0" />
                          View Attachment
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Right: Action Buttons */}
                  <div className="flex lg:flex-col gap-2 shrink-0">
                    <button
                      onClick={() => onApprove(attendanceId)}
                      disabled={isProcessing || !attendanceId}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#16a34a', color: '#fff' }}
                      onMouseEnter={(e) => {
                        if (!isProcessing) e.currentTarget.style.backgroundColor = '#15803d';
                      }}
                      onMouseLeave={(e) => {
                        if (!isProcessing) e.currentTarget.style.backgroundColor = '#16a34a';
                      }}
                    >
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      {approving ? 'Approving…' : 'Approve'}
                    </button>

                    <button
                      onClick={() => onReject(attendanceId)}
                      disabled={isProcessing || !attendanceId}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#dc2626', color: '#fff' }}
                      onMouseEnter={(e) => {
                        if (!isProcessing) e.currentTarget.style.backgroundColor = '#b91c1c';
                      }}
                      onMouseLeave={(e) => {
                        if (!isProcessing) e.currentTarget.style.backgroundColor = '#dc2626';
                      }}
                    >
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      {rejecting ? 'Rejecting…' : 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const CoordinatorAttendance = () => {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Early attendance state
  const [pendingEarlyRequests, setPendingEarlyRequests] = useState([]);
  const [earlyLoading, setEarlyLoading] = useState(false);
  const [earlyActionLoading, setEarlyActionLoading] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const [attachmentModal, setAttachmentModal] = useState({
    open: false,
    url: null,
    name: null,
  });

  const openAttachmentModal = (url, name) => {
    setAttachmentModal({ open: true, url, name });
  };

  const closeAttachmentModal = () => {
    setAttachmentModal({ open: false, url: null, name: null });
  };

  // Auto-clear success message after 3 s
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // Auto-clear action error after 4 s
  useEffect(() => {
    if (!actionError) return;
    const timer = setTimeout(() => setActionError(''), 4000);
    return () => clearTimeout(timer);
  }, [actionError]);

  // ─── Attendance loader ────────────────────────────────────────────────────

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getCoordinatorAttendance();
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Attendance API error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Early attendance loader ──────────────────────────────────────────────

  const fetchPendingEarlyRequests = useCallback(async () => {
    setEarlyLoading(true);
    try {
      const res = await getPendingEarlyAttendance();
      const list = Array.isArray(res) ? res : res?.data;
      setPendingEarlyRequests(
        (Array.isArray(list) ? list : []).filter((req) => req.early_status === 'pending')
      );
    } catch (err) {
      console.error('Failed to load early attendance requests', err);
      setPendingEarlyRequests([]);
    } finally {
      setEarlyLoading(false);
    }
  }, []);

  // ─── Initial load ─────────────────────────────────────────────────────────

  useEffect(() => {
    loadAttendance();
    fetchPendingEarlyRequests();
  }, [loadAttendance, fetchPendingEarlyRequests]);

  // ─── Academic year change listener ────────────────────────────────────────

  useEffect(() => {
    const handleAcademicYearChanged = () => {
      loadAttendance();
      fetchPendingEarlyRequests();
    };
    window.addEventListener('academicYearChanged', handleAcademicYearChanged);
    return () => window.removeEventListener('academicYearChanged', handleAcademicYearChanged);
  }, [loadAttendance, fetchPendingEarlyRequests]);

  // ─── Approve / Reject handlers ────────────────────────────────────────────

  const handleApproveEarly = async (attendanceId) => {
    if (!attendanceId) return;
    setEarlyActionLoading({ attendanceId, action: 'approve' });
    try {
      await approveEarlyAttendance(attendanceId);
      await Promise.all([loadAttendance(), fetchPendingEarlyRequests()]);
      setSuccessMessage('Early attendance approved successfully.');
    } catch (err) {
      console.error('Approve failed', err);
      setActionError('Failed to approve early attendance request.');
    } finally {
      setEarlyActionLoading(null);
    }
  };

  const handleRejectEarly = async (attendanceId) => {
    if (!attendanceId) return;
    setEarlyActionLoading({ attendanceId, action: 'reject' });
    try {
      await rejectEarlyAttendance(attendanceId);
      await Promise.all([loadAttendance(), fetchPendingEarlyRequests()]);
      setSuccessMessage('Early attendance rejected successfully.');
    } catch (err) {
      console.error('Reject failed', err);
      setActionError('Failed to reject early attendance request.');
    } finally {
      setEarlyActionLoading(null);
    }
  };

  // ─── Derived state ────────────────────────────────────────────────────────

  const filteredRecords = useMemo(() => {
    if (!selectedDate) return records;
    return records.filter((r) => normalizeDate(r.attendance_date) === selectedDate);
  }, [records, selectedDate]);

  const students = useMemo(() => groupByStudent(filteredRecords), [filteredRecords]);

  const stats = useMemo(
    () => ({
      totalStudents: students.length,
      flagged: filteredRecords.filter((r) => r.location_status === 'flagged').length,
      // Exclude flagged records — they already count in Flagged, not Missing Time-Out
      missingOut: filteredRecords.filter(
        (r) =>
          r.location_status !== 'flagged' &&
          isMissingTimeOut(r.time_out)
      ).length,
    }),
    [students, filteredRecords]
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const name = s.full_name.toLowerCase();
      const course = (s.course ?? '').toLowerCase();
      return name.includes(q) || course.includes(q);
    });
  }, [students, searchQuery]);

  const tableRecords = useMemo(() => {
    if (!searchQuery.trim()) return filteredRecords;
    const q = searchQuery.trim().toLowerCase();
    return filteredRecords.filter((r) => {
      const name = resolveFullName(r).toLowerCase();
      const course = (r.course ?? '').toLowerCase();
      return name.includes(q) || course.includes(q);
    });
  }, [filteredRecords, searchQuery]);

  const hasFilter = searchQuery.trim() !== '' || !!selectedDate;
  const isToday = !!selectedDate && selectedDate === todayString();
  const showTable = !!selectedDate;
  const showCards = !selectedDate;

  const handleRowClick = (record) => {
    navigate(`/coordinator/attendance/${record.student_id}`, {
      state: { highlightAttendanceId: record.attendance_id ?? record.id ?? null },
    });
  };

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), white)` }}
    >
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: `rgb(var(--primary-800))` }}
            >
              Attendance Monitoring
            </h1>
            <p className="mt-1 text-sm" style={{ color: `rgb(var(--primary-500))` }}>
              Review student time-in, time-out, and location records
            </p>
          </div>
          <div
            className="hidden lg:flex items-center gap-2 text-xs font-medium bg-white rounded-lg px-3 py-2 shadow-sm"
            style={{
              color: `rgb(var(--primary-400))`,
              border: `1px solid rgb(var(--primary-100))`,
            }}
          >
            <Users className="w-3.5 h-3.5" />
            {loading ? '—' : students.length} student{students.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Success toast */}
        {successMessage && (
          <div
            className="rounded-2xl px-5 py-3.5 flex items-center gap-3 shadow-sm"
            style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}
          >
            <CheckCircle className="w-4 h-4 shrink-0" style={{ color: '#16a34a' }} />
            <div>
              <p className="text-xs font-bold leading-tight" style={{ color: '#15803d' }}>
                Success
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#16a34a' }}>
                {successMessage}
              </p>
            </div>
          </div>
        )}

        {/* Error toast */}
        {actionError && (
          <div
            className="rounded-2xl px-5 py-3.5 flex items-center gap-3 shadow-sm"
            style={{ backgroundColor: '#fff1f2', border: '1px solid #fecaca' }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#dc2626' }} />
            <div>
              <p className="text-xs font-bold leading-tight" style={{ color: '#991b1b' }}>
                Action Failed
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#dc2626' }}>
                {actionError}
              </p>
            </div>
          </div>
        )}

        {/* Early Attendance Requests Panel */}
        {!error && (earlyLoading || pendingEarlyRequests.length > 0) && (
          <EarlyAttendancePanel
            requests={pendingEarlyRequests}
            loading={earlyLoading}
            actionLoading={earlyActionLoading}
            onApprove={handleApproveEarly}
            onReject={handleRejectEarly}
            onViewAttachment={openAttachmentModal}
          />
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            title="Total Students"
            value={stats.totalStudents}
            icon={Users}
            accent="text-gray-800"
            loading={loading}
          />
          <SummaryCard
            title="Flagged Attendance"
            value={stats.flagged}
            icon={MapPin}
            accent="text-amber-600"
            loading={loading}
          />
          <SummaryCard
            title="Missing Time-Out"
            value={stats.missingOut}
            icon={AlertTriangle}
            accent="text-orange-500"
            loading={loading}
          />
        </div>

        {/* Toolbar */}
        <div
          className="bg-white rounded-2xl shadow-sm px-6 py-4"
          style={{ border: `1px solid rgb(var(--primary-50))` }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold" style={{ color: `rgb(var(--primary-800))` }}>
                Student Records
              </h2>
              <span
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                style={
                  showTable
                    ? {
                        backgroundColor: `rgb(var(--primary-100))`,
                        color: `rgb(var(--primary-700))`,
                        border: `1px solid rgb(var(--primary-200))`,
                      }
                    : {
                        backgroundColor: `rgb(var(--primary-50))`,
                        color: `rgb(var(--primary-500))`,
                        border: `1px solid rgb(var(--primary-100))`,
                      }
                }
              >
                {showTable ? (
                  <>
                    <Calendar className="w-3 h-3" />
                    Date view
                  </>
                ) : (
                  <>
                    <Users className="w-3 h-3" />
                    All students
                  </>
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CalendarPopover
                selectedDate={selectedDate}
                onSelect={setSelectedDate}
                onClear={() => setSelectedDate('')}
              />

              {isToday ? (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg"
                  style={{
                    backgroundColor: `rgb(var(--primary-50))`,
                    color: `rgb(var(--primary-600))`,
                    border: `1px solid rgb(var(--primary-200))`,
                  }}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Today
                </span>
              ) : (
                <button
                  onClick={() => setSelectedDate(todayString())}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors"
                  style={{ backgroundColor: `rgb(var(--primary-600))`, color: 'white' }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`)
                  }
                >
                  <Clock className="w-3.5 h-3.5" />
                  Today
                </button>
              )}

              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: `rgb(var(--primary-400))` }}
                />
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
                  onFocus={(e) => {
                    e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`;
                    e.target.style.borderColor = `rgb(var(--primary-300))`;
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = 'none';
                    e.target.style.borderColor = `rgb(var(--primary-200))`;
                  }}
                />
              </div>
            </div>
          </div>

          {hasFilter && !loading && (
            <p className="text-xs mt-2" style={{ color: `rgb(var(--primary-500))` }}>
              Showing{' '}
              <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>
                {showTable ? tableRecords.length : filteredStudents.length}
              </span>{' '}
              {showTable ? 'record' : 'student'}
              {(showTable ? tableRecords.length : filteredStudents.length) !== 1 ? 's' : ''}
              {!showTable && (
                <>
                  {' '}of{' '}
                  <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>
                    {students.length}
                  </span>{' '}
                  student{students.length !== 1 ? 's' : ''}
                </>
              )}
              {selectedDate ? (
                <>
                  {' '}for{' '}
                  <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </>
              ) : null}
            </p>
          )}
        </div>

        {/* ── CARD MODE (no date selected) ── */}
        {showCards && (
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
        )}

        {/* ── TABLE MODE (date selected) ── */}
        {showTable && !loading && !error && (
          <AttendanceTable records={tableRecords} onRowClick={handleRowClick} />
        )}

        {/* Table loading skeleton */}
        {showTable && loading && (
          <div
            className="bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse"
            style={{ border: `1px solid rgb(var(--primary-50))` }}
          >
            <div
              className="px-6 py-4"
              style={{ borderBottom: `1px solid rgb(var(--primary-100))` }}
            >
              <div
                className="h-5 rounded w-40"
                style={{ backgroundColor: `rgb(var(--primary-100))` }}
              />
            </div>
            <table className="w-full">
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Error in table mode */}
        {showTable && error && (
          <div className="col-span-full py-20 flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-300" />
            </div>
            <p className="text-base font-semibold text-red-700">Failed to load attendance records</p>
            <p className="text-sm text-red-400">Please refresh the page or try again later.</p>
          </div>
        )}

        {/* Attachment Preview Modal */}
        {attachmentModal.open && (
          <div
            className="fixed inset-0 bg-black/70 z-9999 flex items-center justify-center p-4"
            onClick={closeAttachmentModal}
          >
            <div
              className="bg-white rounded-2xl p-6 max-w-4xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-gray-700 truncate pr-4">
                  {attachmentModal.name}
                </p>
                <button
                  onClick={closeAttachmentModal}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {isImageFile(attachmentModal.url) ? (
                <img
                  src={attachmentModal.url}
                  alt={attachmentModal.name}
                  className="w-full max-h-[80vh] object-contain rounded-lg"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Paperclip className="w-10 h-10 text-gray-300" />
                  <p className="text-sm text-gray-500">This file cannot be previewed.</p>
                  <a
                    href={attachmentModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: '#d97706' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b45309')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#d97706')}
                  >
                    <Paperclip className="w-4 h-4" />
                    Open File
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CoordinatorAttendance;