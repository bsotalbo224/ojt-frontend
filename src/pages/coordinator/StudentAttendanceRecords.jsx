import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, MapPin, AlertTriangle, Eye, Filter,
  CheckCircle, Clock, X, Navigation,
  ChevronDown, TrendingUp, LogIn, LogOut, Coffee, UtensilsCrossed, Moon, Sunrise,
} from 'lucide-react';
import { getCoordinatorAttendance } from '../../api/attendance';
import Avatar from '../../components/ui/Avatar';

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCATION_CONFIG = {
  verified: {
    label: 'Verified',
    pill: '',
    pillHover: '',
    usePrimary: true,
    icon: CheckCircle,
    dot: null,
    rowHighlight: '',
  },
  flagged: {
    label: 'Flagged',
    pill: 'bg-amber-50 text-amber-700 border border-amber-200',
    pillHover: 'hover:bg-amber-100 hover:border-amber-300',
    usePrimary: false,
    icon: AlertTriangle,
    dot: 'bg-amber-400',
    rowHighlight: 'bg-amber-50/40 border-l-4 border-l-amber-400',
  },
};

const FILTER_OPTIONS = [
  { value: 'all',        label: 'All Records'           },
  { value: 'flagged',    label: 'Flagged'               },
  { value: 'complete',   label: 'Complete Records'      },
  { value: 'incomplete', label: 'Incomplete Attendance' },
];

// ─── Workflow config ──────────────────────────────────────────────────────────

const WORKFLOW_CONFIG = {
  work: {
    label: 'Work Hours',
    icon: LogIn,
    inKey: 'time_in',
    outKey: 'time_out',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    progressColor: 'text-emerald-600',
    progressBg: 'bg-emerald-50',
    progressBorder: 'border-emerald-100',
  },
  lunch: {
    label: 'Lunch Break',
    icon: Coffee,
    inKey: 'lunch_break_start',
    outKey: 'lunch_break_end',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    progressColor: 'text-amber-600',
    progressBg: 'bg-amber-50',
    progressBorder: 'border-amber-100',
  },
  ot: {
    label: 'Overtime',
    icon: Moon,
    inKey: 'ot_time_in',
    outKey: 'ot_time_out',
    color: 'text-indigo-500',
    bg: 'bg-indigo-50',
    border: 'border-indigo-100',
    progressColor: 'text-indigo-600',
    progressBg: 'bg-indigo-50',
    progressBorder: 'border-indigo-100',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const resolveFullName = (r) => {
  if (r.student_name?.trim()) return r.student_name.trim();
  const f = (r.f_name ?? '').trim();
  const l = (r.l_name ?? '').trim();
  return [f, l].filter(Boolean).join(' ') || 'Unknown Student';
};

const isBlankTime = (t) => !t || t === '00:00:00' || t === '0000-00-00 00:00:00';

const formatTime = (timeStr) => {
  if (!timeStr || isBlankTime(timeStr)) return null;
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
  } catch { return null; }
};

const formatSession = (timeIn, timeOut) => {
  const hasIn  = !isBlankTime(timeIn);
  const hasOut = !isBlankTime(timeOut);
  if (!hasIn) return null;
  if (!hasOut) return 'in_progress';
  return { range: `${formatTime(timeIn)} – ${formatTime(timeOut)}` };
};

const computeSessionMinutes = (timeIn, timeOut) => {
  if (isBlankTime(timeIn) || isBlankTime(timeOut)) return 0;
  try {
    const toMins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const diff = toMins(timeOut) - toMins(timeIn);
    return diff > 0 ? diff : 0;
  } catch { return 0; }
};

const minutesToDisplay = (mins) => {
  if (!mins) return null;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
};

/**
 * Regular hours = time_in → time_out
 * Minus lunch break duration (or auto-deduct 1 hr if >= 5 hrs work and no lunch)
 * Plus overtime
 */
const computeTotalHours = (r) => {
  const workMins  = computeSessionMinutes(r.time_in, r.time_out);
  const lunchMins = computeSessionMinutes(r.lunch_break_start, r.lunch_break_end);
  const otMins    = computeSessionMinutes(r.ot_time_in, r.ot_time_out);

  let deductMins = 0;
  if (lunchMins > 0) {
    deductMins = lunchMins;
  } else if (workMins / 60 >= 5) {
    deductMins = 60; // auto-deduct 1 hr
  }

  const total = Math.max(0, workMins - deductMins) + otMins;
  return minutesToDisplay(total);
};

/**
 * Incomplete = any started-but-not-finished step.
 */
const isIncompleteAttendance = (r) =>
  (!isBlankTime(r.time_in)           && isBlankTime(r.time_out))          ||
  (!isBlankTime(r.lunch_break_start) && isBlankTime(r.lunch_break_end))   ||
  (!isBlankTime(r.ot_time_in)        && isBlankTime(r.ot_time_out));

const formatDate = (dateStr, opts = {}) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', ...opts });
};

// ─── WorkflowStatus indicator (table cell) ────────────────────────────────────

const WorkflowStatus = ({ timeIn, timeOut, workflowKey }) => {
  const cfg     = WORKFLOW_CONFIG[workflowKey];
  const session = formatSession(timeIn, timeOut);

  if (session === null) return <span className="text-xs text-gray-300 italic select-none">—</span>;

  if (session === 'in_progress') return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.progressBg} ${cfg.progressColor} ${cfg.progressBorder}`}>
      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${cfg.progressColor.replace('text-', 'bg-')}`} />
      In progress
    </span>
  );

  return (
    <span className="text-xs font-semibold tabular-nums" style={{ color: `rgb(var(--primary-700))` }}>
      {session.range}
    </span>
  );
};

// ─── WorkflowDetail (modal row) ───────────────────────────────────────────────

const WorkflowDetail = ({ label, workflowKey, timeIn, timeOut }) => {
  const cfg     = WORKFLOW_CONFIG[workflowKey];
  const Icon    = cfg.icon;
  const session = formatSession(timeIn, timeOut);
  const mins    = computeSessionMinutes(timeIn, timeOut);

  const statusNode = (() => {
    if (session === null) return <span className="text-xs text-gray-400 italic">Not recorded</span>;
    if (session === 'in_progress') return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.progressBg} ${cfg.progressColor} ${cfg.progressBorder}`}>
        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${cfg.progressColor.replace('text-', 'bg-')}`} />
        In progress
      </span>
    );
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold" style={{ color: `rgb(var(--primary-800))` }}>{session.range}</span>
        {mins > 0 && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `rgb(var(--primary-50))`, color: `rgb(var(--primary-600))`, border: `1px solid rgb(var(--primary-100))` }}
          >
            {minutesToDisplay(mins)}
          </span>
        )}
      </div>
    );
  })();

  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg} ${cfg.border} border`}>
        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: `rgb(var(--primary-500))` }}>{label}</p>
        {statusNode}
      </div>
    </div>
  );
};

// ─── LocationStatusBadge ──────────────────────────────────────────────────────

const LocationStatusBadge = ({ status }) => {
  const config = LOCATION_CONFIG[status] ?? LOCATION_CONFIG.verified;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap select-none ${!config.usePrimary ? config.pill : ''}`}
      style={config.usePrimary ? {
        backgroundColor: `rgb(var(--primary-100))`,
        color: `rgb(var(--primary-700))`,
        border: `1px solid rgb(var(--primary-200))`,
      } : {}}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

// ─── LocationStatusDropdown ───────────────────────────────────────────────────

const LocationStatusDropdown = ({ status, onChange, disabled }) => {
  const isFlagged = status === 'flagged';
  return (
    <div className="relative inline-block">
      <select
        value={status}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="appearance-none pl-7 pr-7 py-1.5 text-xs font-semibold rounded-full cursor-pointer outline-none transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
        style={isFlagged ? {
          backgroundColor: 'rgb(255 251 235)',
          color: 'rgb(180 83 9)',
          border: '1px solid rgb(253 230 138)',
        } : {
          backgroundColor: `rgb(var(--primary-100))`,
          color: `rgb(var(--primary-700))`,
          border: `1px solid rgb(var(--primary-200))`,
        }}
        onFocus={e => { e.target.style.boxShadow = isFlagged ? '0 0 0 2px rgb(253 230 138)' : `0 0 0 2px rgb(var(--primary-300))`; }}
        onBlur={e  => { e.target.style.boxShadow = 'none'; }}
      >
        <option value="verified">Verified</option>
        <option value="flagged">Flagged</option>
      </select>
      <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
        {isFlagged
          ? <AlertTriangle className="w-3 h-3 text-amber-600" />
          : <CheckCircle   className="w-3 h-3" style={{ color: `rgb(var(--primary-600))` }} />}
      </div>
      <ChevronDown
        className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
        style={{ color: isFlagged ? 'rgb(180 83 9)' : `rgb(var(--primary-500))` }}
      />
    </div>
  );
};

// ─── MapPlaceholder ───────────────────────────────────────────────────────────

const MapPlaceholder = ({ latitude, longitude }) => {
  const hasCoords = latitude != null && longitude != null;
  const mapsUrl   = hasCoords ? `https://maps.google.com/?q=${latitude},${longitude}` : null;

  return (
    <div
      className="w-full h-44 rounded-xl overflow-hidden relative"
      style={{ border: `1px solid rgb(var(--primary-200))`, background: `linear-gradient(to bottom right, rgb(var(--primary-50)), rgb(var(--primary-100)))` }}
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(to right, rgb(var(--primary-300)) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--primary-300)) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />
      {hasCoords ? (
        <>
          <div
            className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-sm flex items-center gap-1.5"
            style={{ border: `1px solid rgb(var(--primary-100))` }}
          >
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: `rgb(var(--primary-500))` }} />
            <span className="text-xs font-mono font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
              {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
            </span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white" style={{ backgroundColor: `rgb(var(--primary-600))` }}>
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div className="w-2 h-2 rounded-full mt-0.5" style={{ backgroundColor: `rgb(var(--primary-600) / 0.4)` }} />
            </div>
          </div>
          <a
            href={mapsUrl} target="_blank" rel="noopener noreferrer" aria-label="Open location in Google Maps"
            className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 bg-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md transition-all duration-150 group"
            style={{ color: `rgb(var(--primary-700))`, border: `1px solid rgb(var(--primary-100))` }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; }}
          >
            <Navigation className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            Open in Maps
          </a>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center" style={{ border: `1px solid rgb(var(--primary-200))` }}>
            <MapPin className="w-5 h-5" style={{ color: `rgb(var(--primary-300))` }} />
          </div>
          <p className="text-xs italic font-medium" style={{ color: `rgb(var(--primary-400))` }}>No location data recorded</p>
        </div>
      )}
    </div>
  );
};

// ─── DetailsModal ─────────────────────────────────────────────────────────────

const DetailsModal = ({ record, onClose }) => {
  const totalHours = computeTotalHours(record);
  const isFlagged  = record.location_status === 'flagged';

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true" aria-labelledby="modal-title"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        style={{ border: `1px solid rgb(var(--primary-100))`, animation: 'modalIn 0.2s ease-out' }}
      >
        <style>{`@keyframes modalIn { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>

        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 shrink-0 ${isFlagged ? 'bg-linear-to-r from-amber-50 to-white' : ''}`}
          style={!isFlagged ? {
            borderBottom: `1px solid rgb(var(--primary-100))`,
            background: `linear-gradient(to right, rgb(var(--primary-50)), white)`,
          } : { borderBottom: '1px solid #fde68a' }}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm ${isFlagged ? 'bg-linear-to-br from-amber-400 to-amber-600' : ''}`}
              style={!isFlagged ? { background: `linear-gradient(to bottom right, rgb(var(--primary-400)), rgb(var(--primary-600)))` } : {}}
            >
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 id="modal-title" className="text-base font-bold" style={{ color: `rgb(var(--primary-800))` }}>
                {resolveFullName(record)}
              </h2>
              <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>
                Attendance Record · {formatDate(record.attendance_date)}
                {isFlagged && (
                  <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-semibold">
                    <AlertTriangle className="w-3 h-3" />Flagged
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose} aria-label="Close modal"
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: `rgb(var(--primary-400))` }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`; e.currentTarget.style.color = `rgb(var(--primary-600))`; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = `rgb(var(--primary-400))`; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">

          {/* Daily Work Record */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4" style={{ color: `rgb(var(--primary-500))` }} />
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: `rgb(var(--primary-800))` }}>Daily Work Record</h3>
            </div>
            <div
              className="rounded-xl p-4 space-y-0"
              style={{ backgroundColor: `rgb(var(--primary-50) / 0.5)`, border: `1px solid rgb(var(--primary-100))` }}
            >
              {/* Date row */}
              <div className="flex items-start gap-2 py-3" style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-gray-50 border border-gray-100">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: `rgb(var(--primary-500))` }}>Date</p>
                  <p className="text-sm font-medium" style={{ color: `rgb(var(--primary-800))` }}>
                    {formatDate(record.attendance_date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>

              <WorkflowDetail label="Work Schedule"  workflowKey="work"  timeIn={record.time_in}           timeOut={record.time_out}          />
              <WorkflowDetail label="Lunch Break"    workflowKey="lunch" timeIn={record.lunch_break_start} timeOut={record.lunch_break_end}   />
              <WorkflowDetail label="Overtime"       workflowKey="ot"    timeIn={record.ot_time_in}        timeOut={record.ot_time_out}       />

              {/* Total Hours */}
              {totalHours && (
                <div className="flex items-center justify-between pt-3 mt-1">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--primary-500))` }}>Total Hours</span>
                  <span className="inline-flex items-center gap-1 font-bold text-sm" style={{ color: `rgb(var(--primary-700))` }}>
                    <TrendingUp className="w-3.5 h-3.5" />{totalHours}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Location Data */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4" style={{ color: `rgb(var(--primary-500))` }} />
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: `rgb(var(--primary-800))` }}>Location Data</h3>
            </div>
            <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: `rgb(var(--primary-50) / 0.5)`, border: `1px solid rgb(var(--primary-100))` }}>
              <div className="grid grid-cols-2 gap-3">
                {[{ label: 'Latitude', value: record.latitude }, { label: 'Longitude', value: record.longitude }].map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-lg px-3 py-2" style={{ border: `1px solid rgb(var(--primary-100))` }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: `rgb(var(--primary-400))` }}>{label}</p>
                    <p className="text-sm font-mono font-semibold" style={{ color: `rgb(var(--primary-800))` }}>{value ?? '—'}</p>
                  </div>
                ))}
              </div>
              {record.distance_meters != null && (
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${record.distance_meters > 100 ? 'bg-amber-50 text-amber-700 border border-amber-100' : ''}`}
                  style={record.distance_meters <= 100 ? {
                    backgroundColor: `rgb(var(--primary-50))`,
                    color: `rgb(var(--primary-700))`,
                    border: `1px solid rgb(var(--primary-100))`,
                  } : {}}
                >
                  <Navigation className="w-3.5 h-3.5 shrink-0" />
                  {record.distance_meters <= 100
                    ? `Within range · ${record.distance_meters}m from site`
                    : `${record.distance_meters}m from company site · Outside radius`}
                </div>
              )}
              <div className="pt-1">
                <MapPlaceholder latitude={record.latitude} longitude={record.longitude} />
              </div>
            </div>
          </section>

          {/* Location Status */}
          <section>
            <div className="bg-white rounded-xl p-4" style={{ border: `1px solid rgb(var(--primary-100))` }}>
              <p className="text-xs font-medium mb-2" style={{ color: `rgb(var(--primary-500))` }}>Location Status</p>
              <LocationStatusBadge status={record.location_status} />
              {record.location_status === 'flagged' && (
                <div className="flex items-start gap-2 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    The recorded location does not match the expected company address.
                  </p>
                </div>
              )}
            </div>
          </section>

          <div className="pt-1">
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg active:scale-[0.98] transition-all duration-150 bg-white"
              style={{ color: `rgb(var(--primary-700))`, border: `1px solid rgb(var(--primary-200))` }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Skeleton / Empty States ──────────────────────────────────────────────────

const SkeletonRow = ({ delay = 0 }) => (
  <tr style={{ borderBottom: `1px solid rgb(var(--primary-50))`, animationDelay: `${delay}ms` }}>
    {[20, 28, 24, 20, 16, 16, 12].map((w, i) => (
      <td key={i} className="py-4 px-4">
        <div
          className="h-4 rounded animate-pulse"
          style={{ width: `${w * 4}px`, background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100)))` }}
        />
      </td>
    ))}
  </tr>
);

const EmptyTableState = ({ hasFilter }) => (
  <tr>
    <td colSpan={7} className="py-20 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: `rgb(var(--primary-50))` }}>
          <Calendar className="w-8 h-8" style={{ color: `rgb(var(--primary-300))` }} />
        </div>
        <p className="text-base font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
          {hasFilter ? 'No matching records' : 'No attendance records yet'}
        </p>
        <p className="text-sm max-w-xs" style={{ color: `rgb(var(--primary-500))` }}>
          {hasFilter ? 'Try adjusting your search or filter.' : 'Work attendance records will appear once the student starts logging.'}
        </p>
      </div>
    </td>
  </tr>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const StudentAttendance = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [allRecords,   setAllRecords]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(false);
  const [selected,     setSelected]     = useState(null);
  const [search,       setSearch]       = useState('');
  const [dateFilter,   setDateFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingIds,  setUpdatingIds]  = useState(new Set());

  useEffect(() => {
    getCoordinatorAttendance()
      .then((data) => {
        const records = (Array.isArray(data) ? data : [])
          .filter((r) => String(r.student_id) === String(studentId))
          .map(({ coordinator_note: _note, ...rest }) => rest);
        records.sort((a, b) => new Date(b.attendance_date) - new Date(a.attendance_date));
        setAllRecords(records);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [studentId]);

  const handleStatusChange = useCallback(async (attendanceId, newStatus) => {
    setUpdatingIds((prev) => new Set(prev).add(attendanceId));
    try {
      const res = await fetch(`/api/attendance/${attendanceId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      setAllRecords((prev) =>
        prev.map((r) => r.attendance_id === attendanceId ? { ...r, location_status: newStatus } : r)
      );
    } catch (err) {
      console.error('Status update failed:', err);
    } finally {
      setUpdatingIds((prev) => { const n = new Set(prev); n.delete(attendanceId); return n; });
    }
  }, []);

  const student = useMemo(() => {
    if (!allRecords.length) return null;
    const r = allRecords[0];
    return { full_name: resolveFullName(r), course: r.course ?? '', company: r.company ?? '', photo: r.photo ?? '' };
  }, [allRecords]);

  const stats = useMemo(() => ({
    total:                allRecords.length,
    verified:             allRecords.filter((r) => r.location_status === 'verified').length,
    flagged:              allRecords.filter((r) => r.location_status === 'flagged').length,
    incompleteAttendance: allRecords.filter(isIncompleteAttendance).length,
  }), [allRecords]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRecords.filter((r) => {
      const matchesSearch  = !q || formatDate(r.attendance_date).toLowerCase().includes(q);
      const matchesDate    = !dateFilter || r.attendance_date?.startsWith(dateFilter);
      const matchesStatus  =
        statusFilter === 'all' ||
        (statusFilter === 'flagged'    && r.location_status === 'flagged') ||
        (statusFilter === 'complete'   && !isIncompleteAttendance(r))      ||
        (statusFilter === 'incomplete' && isIncompleteAttendance(r));
      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [allRecords, search, dateFilter, statusFilter]);

  const hasFilter  = search.trim() !== '' || dateFilter !== '' || statusFilter !== 'all';
  const clearFilters = useCallback(() => { setSearch(''); setDateFilter(''); setStatusFilter('all'); }, []);

  // Table column headers
  const TABLE_HEADERS = [
    { label: 'Date'            },
    { label: 'Work Hours',   Icon: LogIn,          iconClass: 'text-emerald-500' },
    { label: 'Lunch Break',  Icon: Coffee,          iconClass: 'text-amber-500'  },
    { label: 'Overtime',     Icon: Moon,            iconClass: 'text-indigo-500' },
    { label: 'Total Hours'   },
    { label: 'Location Status' },
    { label: 'Action'          },
  ];

  return (
    <>
      <div
        className="min-h-screen p-4 sm:p-6"
        style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), white)` }}
      >
        <div className="max-w-6xl mx-auto space-y-5">

          {/* Back Button */}
          <button
            onClick={() => navigate('/coordinator/attendance')}
            className="flex items-center gap-1.5 text-sm font-semibold transition-colors group"
            style={{ color: `rgb(var(--primary-600))` }}
            onMouseEnter={e => e.currentTarget.style.color = `rgb(var(--primary-800))`}
            onMouseLeave={e => e.currentTarget.style.color = `rgb(var(--primary-600))`}
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Attendance
          </button>

          {/* Student Info Card */}
          {!loading && student && (
            <div className="bg-white rounded-2xl shadow-sm px-6 py-5" style={{ border: `1px solid rgb(var(--primary-50))` }}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="shrink-0">
                  <Avatar name={student.full_name} src={student.photo || ''} size="lg" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-bold" style={{ color: `rgb(var(--primary-800))` }}>{student.full_name}</h1>
                  {(student.course || student.company) && (
                    <p className="text-sm mt-0.5" style={{ color: `rgb(var(--primary-500))` }}>
                      {[student.course, student.company].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  <div className="flex flex-col items-center rounded-lg px-4 py-2" style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}>
                    <span className="text-lg font-bold" style={{ color: `rgb(var(--primary-600))` }}>{stats.verified}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--primary-500))` }}>Verified</span>
                  </div>
                  <div className="flex flex-col items-center bg-amber-50 border border-amber-100 rounded-lg px-4 py-2">
                    <span className="text-lg font-bold text-amber-600">{stats.flagged}</span>
                    <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Flagged</span>
                  </div>
                  <div className="flex flex-col items-center bg-orange-50 border border-orange-100 rounded-lg px-4 py-2">
                    <span className="text-lg font-bold text-orange-500">{stats.incompleteAttendance}</span>
                    <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-wide">Incomplete</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Attendance Table Card */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid rgb(var(--primary-50))` }}>

            {/* Filter Bar */}
            <div className="px-6 pt-5 pb-4" style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" style={{ color: `rgb(var(--primary-500))` }} />
                  <h2 className="text-base font-bold" style={{ color: `rgb(var(--primary-800))` }}>Attendance Records</h2>
                  {!loading && (
                    <span className="text-xs font-medium ml-1" style={{ color: `rgb(var(--primary-400))` }}>
                      {stats.total} record{stats.total !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
                  {/* Date filter */}
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `rgb(var(--primary-400))` }} />
                    <input
                      type="date" value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="pl-9 pr-3 py-2 text-sm rounded-lg transition cursor-pointer outline-none"
                      style={{ border: `1px solid rgb(var(--primary-200))`, backgroundColor: `rgb(var(--primary-50) / 0.4)`, color: `rgb(var(--primary-800))` }}
                      onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                      onBlur={e  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
                    />
                  </div>
                  {/* Status filter */}
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `rgb(var(--primary-400))` }} />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="pl-9 pr-8 py-2 text-sm rounded-lg outline-none appearance-none cursor-pointer transition"
                      style={{ border: `1px solid rgb(var(--primary-200))`, backgroundColor: `rgb(var(--primary-50) / 0.4)`, color: `rgb(var(--primary-800))` }}
                      onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                      onBlur={e  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
                    >
                      {FILTER_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: `rgb(var(--primary-400))` }} />
                  </div>
                  {/* Clear filters */}
                  {hasFilter && (
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                      style={{ color: `rgb(var(--primary-500))`, border: `1px solid rgb(var(--primary-200))`, backgroundColor: `rgb(var(--primary-50))` }}
                      onMouseEnter={e => { e.currentTarget.style.color = `rgb(var(--primary-700))`; e.currentTarget.style.borderColor = `rgb(var(--primary-300))`; e.currentTarget.style.backgroundColor = `rgb(var(--primary-100))`; }}
                      onMouseLeave={e => { e.currentTarget.style.color = `rgb(var(--primary-500))`; e.currentTarget.style.borderColor = `rgb(var(--primary-200))`; e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`; }}
                    >
                      <X className="w-3 h-3" />Clear filters
                    </button>
                  )}
                </div>
              </div>

              {hasFilter && !loading && (
                <p className="text-xs mt-2.5 flex items-center gap-1.5" aria-live="polite" style={{ color: `rgb(var(--primary-500))` }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `rgb(var(--primary-400))` }} />
                  Showing{' '}
                  <span className="font-bold mx-0.5" style={{ color: `rgb(var(--primary-700))` }}>{filtered.length}</span>
                  {' '}of {allRecords.length} records
                  {filtered.length !== allRecords.length && statusFilter !== 'all' && (
                    <span style={{ color: `rgb(var(--primary-400))` }}>
                      {' '}— filtered by{' '}
                      <span className="font-medium" style={{ color: `rgb(var(--primary-600))` }}>
                        {FILTER_OPTIONS.find(o => o.value === statusFilter)?.label}
                      </span>
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-225">
                <thead>
                  <tr style={{ backgroundColor: `rgb(var(--primary-50) / 0.6)` }}>
                    {TABLE_HEADERS.map(({ label, Icon, iconClass }) => (
                      <th key={label} className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: `rgb(var(--primary-600))` }}>
                        <span className="inline-flex items-center gap-1.5">
                          {Icon && <Icon className={`w-3.5 h-3.5 ${iconClass}`} />}
                          {label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} delay={i * 60} />)
                  ) : error ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-red-300" />
                          </div>
                          <p className="text-sm font-semibold text-red-600">Failed to load records</p>
                          <p className="text-xs text-red-400">Please refresh the page and try again.</p>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <EmptyTableState hasFilter={hasFilter} />
                  ) : (
                    filtered.map((rec) => {
                      const total      = computeTotalHours(rec);
                      const incomplete = isIncompleteAttendance(rec);
                      const config     = LOCATION_CONFIG[rec.location_status] ?? LOCATION_CONFIG.verified;
                      const isUpdating = updatingIds.has(rec.attendance_id);

                      return (
                        <tr
                          key={rec.attendance_id}
                          className={`transition-colors duration-150 group ${config.rowHighlight}`}
                          style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}
                          onMouseEnter={e => { if (!config.rowHighlight) e.currentTarget.style.backgroundColor = `rgb(var(--primary-50) / 0.6)`; }}
                          onMouseLeave={e => { if (!config.rowHighlight) e.currentTarget.style.backgroundColor = ''; }}
                        >
                          {/* Date */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="text-sm font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
                              {formatDate(rec.attendance_date)}
                            </span>
                            {incomplete && (
                              <div className="mt-0.5">
                                <span className="text-[10px] font-medium text-orange-500 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full">
                                  Incomplete
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Work Hours */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <WorkflowStatus timeIn={rec.time_in} timeOut={rec.time_out} workflowKey="work" />
                          </td>

                          {/* Lunch Break */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <WorkflowStatus timeIn={rec.lunch_break_start} timeOut={rec.lunch_break_end} workflowKey="lunch" />
                          </td>

                          {/* Overtime */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <WorkflowStatus timeIn={rec.ot_time_in} timeOut={rec.ot_time_out} workflowKey="ot" />
                          </td>

                          {/* Total Hours */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            {total ? (
                              <span className="text-sm font-semibold tabular-nums" style={{ color: `rgb(var(--primary-700))` }}>{total}</span>
                            ) : (
                              <span className="text-xs text-gray-400 italic">—</span>
                            )}
                          </td>

                          {/* Location Status */}
                          <td className="py-4 px-4">
                            <div className={`transition-opacity duration-150 ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
                              <LocationStatusDropdown
                                status={rec.location_status}
                                onChange={(s) => handleStatusChange(rec.attendance_id, s)}
                                disabled={isUpdating}
                              />
                            </div>
                          </td>

                          {/* Action */}
                          <td className="py-4 px-4">
                            <button
                              onClick={() => setSelected(rec)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg active:scale-95 transition-all duration-150 shadow-sm group-hover:shadow-md whitespace-nowrap focus:outline-none"
                              style={{ backgroundColor: `rgb(var(--primary-600))` }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}
                            >
                              <Eye className="w-3.5 h-3.5" />View
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            {!loading && !error && filtered.length > 0 && (
              <div
                className="px-6 py-3 flex items-center justify-between flex-wrap gap-2"
                style={{ borderTop: `1px solid rgb(var(--primary-50))`, backgroundColor: `rgb(var(--primary-50) / 0.3)` }}
              >
                <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>
                  {filtered.length} record{filtered.length !== 1 ? 's' : ''} shown
                </p>
                <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: `rgb(var(--primary-500))` }}>
                  <span className="flex items-center gap-1.5">
                    <LogIn className="w-3 h-3 text-emerald-500" />Work Hours
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Coffee className="w-3 h-3 text-amber-500" />Lunch Break
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Moon className="w-3 h-3 text-indigo-500" />Overtime
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3" style={{ color: `rgb(var(--primary-500))` }} />Verified
                  </span>
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />Flagged
                  </span>
                  {stats.flagged > 0 && (
                    <span className="flex items-center gap-1 text-amber-600 font-medium">
                      <span className="w-1 h-3 inline-block bg-amber-400 rounded" />
                      Flagged rows have an amber left border
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selected && <DetailsModal record={selected} onClose={() => setSelected(null)} />}
    </>
  );
};

export default StudentAttendance;