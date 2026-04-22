import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, MapPin, AlertTriangle, Eye, Filter,
  CheckCircle, Clock, X, Navigation,
  ChevronDown, TrendingUp,
} from 'lucide-react';
import { getCoordinatorAttendance } from '../../api/attendance';
import Avatar from '../../components/ui/Avatar';

const BASE_URL = import.meta.env.VITE_BASE_URL;

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCATION_CONFIG = {
  verified: {
    label: 'Verified',
    pill: '',
    pillHover: '',
    usePrimary: true,
    icon: CheckCircle,
    dot: null,
    optionIcon: CheckCircle,
    optionColor: null,
    optionBg: '',
    checkColor: null,
    rowHighlight: '',
  },
  flagged: {
    label: 'Flagged',
    pill: 'bg-amber-50 text-amber-700 border border-amber-200',
    pillHover: 'hover:bg-amber-100 hover:border-amber-300',
    usePrimary: false,
    icon: AlertTriangle,
    dot: 'bg-amber-400',
    optionIcon: AlertTriangle,
    optionColor: 'text-amber-600',
    optionBg: 'hover:bg-amber-50',
    checkColor: 'text-amber-600',
    rowHighlight: 'bg-amber-50/40 border-l-4 border-l-amber-400',
  },
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Records' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'complete', label: 'Complete Records' },
  { value: 'missing_timeout', label: 'Missing Time-Out' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const resolveFullName = (r) => {
  if (r.student_name && r.student_name.trim()) return r.student_name.trim();
  const f = (r.f_name ?? '').trim();
  const l = (r.l_name ?? '').trim();
  return [f, l].filter(Boolean).join(' ') || 'Unknown Student';
};

const isMissingTimeOut = (t) => !t || t === '00:00:00' || t === '0000-00-00 00:00:00';

const formatTime = (timeStr) => {
  if (!timeStr) return '—';
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
  } catch { return timeStr; }
};

const computeHours = (timeIn, timeOut) => {
  if (!timeIn || !timeOut) return null;
  try {
    const toMins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const diff = toMins(timeOut) - toMins(timeIn);
    if (diff <= 0) return null;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  } catch { return null; }
};

const formatDate = (dateStr, opts = {}) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', ...opts });
};

// ─── LocationStatusBadge (read-only, used in modal) ──────────────────────────

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

// ─── LocationStatusDropdown (editable, used in table) ────────────────────────

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
        onBlur={e => { e.target.style.boxShadow = 'none'; }}
      >
        <option value="verified">Verified</option>
        <option value="flagged">Flagged</option>
      </select>

      {/* Left icon */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
        {isFlagged
          ? <AlertTriangle className="w-3 h-3 text-amber-600" />
          : <CheckCircle className="w-3 h-3" style={{ color: `rgb(var(--primary-600))` }} />
        }
      </div>

      {/* Right chevron */}
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
        style={{ color: isFlagged ? 'rgb(180 83 9)' : `rgb(var(--primary-500))` }}
      />
    </div>
  );
};

// ─── MapPlaceholder ───────────────────────────────────────────────────────────

const MapPlaceholder = ({ latitude, longitude }) => {
  const hasCoords = latitude != null && longitude != null;
  const mapsUrl = hasCoords ? `https://maps.google.com/?q=${latitude},${longitude}` : null;

  return (
    <div
      className="w-full h-44 rounded-xl overflow-hidden relative"
      style={{
        border: `1px solid rgb(var(--primary-200))`,
        background: `linear-gradient(to bottom right, rgb(var(--primary-50)), rgb(var(--primary-100)))`,
      }}
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
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
                style={{ backgroundColor: `rgb(var(--primary-600))` }}
              >
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div className="w-2 h-2 rounded-full mt-0.5" style={{ backgroundColor: `rgb(var(--primary-600) / 0.4)` }} />
            </div>
          </div>


          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open location in Google Maps"
            className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 bg-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md transition-all duration-150 group"
            style={{
              color: `rgb(var(--primary-700))`,
              border: `1px solid rgb(var(--primary-100))`
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`;
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}
          >
            <Navigation className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            Open in Maps
          </a>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div
            className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center"
            style={{ border: `1px solid rgb(var(--primary-200))` }}
          >
            <MapPin className="w-5 h-5" style={{ color: `rgb(var(--primary-300))` }} />
          </div>
          <p className="text-xs italic font-medium" style={{ color: `rgb(var(--primary-400))` }}>
            No location data recorded
          </p>
        </div>
      )}
    </div>
  );
};

// ─── DetailsModal (read-only) ─────────────────────────────────────────────────

const DetailsModal = ({ record, onClose }) => {
  const hours = computeHours(record.time_in, record.time_out);
  const isFlagged = record.location_status === 'flagged';

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const DetailRow = ({ label, value }) => (
    <div className="flex items-start gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide w-28 pt-0.5 shrink-0" style={{ color: `rgb(var(--primary-500))` }}>
        {label}
      </span>
      <span className="text-sm font-medium" style={{ color: `rgb(var(--primary-800))` }}>{value ?? '—'}</span>
    </div>
  );

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
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: `rgb(var(--primary-400))` }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`; e.currentTarget.style.color = `rgb(var(--primary-600))`; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = `rgb(var(--primary-400))`; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">

          {/* Time Record */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4" style={{ color: `rgb(var(--primary-500))` }} />
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: `rgb(var(--primary-800))` }}>Time Record</h3>
            </div>
            <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: `rgb(var(--primary-50) / 0.5)`, border: `1px solid rgb(var(--primary-100))` }}>
              <DetailRow label="Date" value={formatDate(record.attendance_date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
              <DetailRow label="Time In" value={formatTime(record.time_in)} />
              <DetailRow
                label="Time Out"
                value={
                  record.time_out && !isMissingTimeOut(record.time_out) ? (
                    formatTime(record.time_out)
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-semibold bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />Not yet recorded
                    </span>
                  )
                }
              />
              <DetailRow
                label="Total Hours"
                value={
                  hours ? (
                    <span className="inline-flex items-center gap-1 font-bold" style={{ color: `rgb(var(--primary-700))` }}>
                      <TrendingUp className="w-3.5 h-3.5" />{hours}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs italic">Cannot compute</span>
                  )
                }
              />
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
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${record.distance_meters > 100 ? 'bg-amber-50 text-amber-700 border border-amber-100' : ''}`}
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
    {[24, 16, 16, 12, 24, 16].map((w, i) => (
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
    <td colSpan={6} className="py-20 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: `rgb(var(--primary-50))` }}>
          <Calendar className="w-8 h-8" style={{ color: `rgb(var(--primary-300))` }} />
        </div>
        <p className="text-base font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
          {hasFilter ? 'No matching records' : 'No attendance records yet'}
        </p>
        <p className="text-sm max-w-xs" style={{ color: `rgb(var(--primary-500))` }}>
          {hasFilter ? 'Try adjusting your search or filter.' : 'Attendance records will appear once you start logging.'}
        </p>
      </div>
    </td>
  </tr>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const StudentAttendance = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingIds, setUpdatingIds] = useState(new Set());

  useEffect(() => {
    getCoordinatorAttendance()
      .then((data) => {
        const studentRecords = (Array.isArray(data) ? data : [])
          .filter((r) => String(r.student_id) === String(studentId))
          .map(({ coordinator_note: _note, ...rest }) => rest);
        studentRecords.sort((a, b) => new Date(b.attendance_date) - new Date(a.attendance_date));
        setAllRecords(studentRecords);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [studentId]);

  // ─── Status update handler ──────────────────────────────────────────────────

  const handleStatusChange = useCallback(async (attendanceId, newStatus) => {
    setUpdatingIds((prev) => new Set(prev).add(attendanceId));
    try {
      const response = await fetch(`/api/attendance/${attendanceId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_status: newStatus }),
      });
      if (!response.ok) throw new Error('Failed to update status');

      setAllRecords((prev) =>
        prev.map((r) =>
          r.attendance_id === attendanceId ? { ...r, location_status: newStatus } : r
        )
      );
    } catch (err) {
      console.error('Status update failed:', err);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(attendanceId);
        return next;
      });
    }
  }, []);

  // ─── Derived state ──────────────────────────────────────────────────────────

  const student = useMemo(() => {
    if (allRecords.length === 0) return null;
    const r = allRecords[0];
    return { full_name: resolveFullName(r), course: r.course ?? '', company: r.company ?? '', photo: r.photo ?? '' };
  }, [allRecords]);

  const stats = useMemo(() => ({
    total: allRecords.length,
    verified: allRecords.filter((r) => r.location_status === 'verified').length,
    flagged: allRecords.filter((r) => r.location_status === 'flagged').length,
    missingOut: allRecords.filter((r) => isMissingTimeOut(r.time_out)).length,
  }), [allRecords]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRecords.filter((r) => {
      const matchesSearch = !q || formatDate(r.attendance_date).toLowerCase().includes(q);
      const matchesDate = !dateFilter || r.attendance_date?.startsWith(dateFilter);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'flagged' && r.location_status === 'flagged') ||
        (statusFilter === 'complete' && r.time_in && !isMissingTimeOut(r.time_out)) ||
        (statusFilter === 'missing_timeout' && isMissingTimeOut(r.time_out));
      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [allRecords, search, dateFilter, statusFilter]);

  const hasFilter = search.trim() !== '' || dateFilter !== '' || statusFilter !== 'all';

  const clearFilters = useCallback(() => { setSearch(''); setDateFilter(''); setStatusFilter('all'); }, []);

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
                  <Avatar name={student.full_name} src={student.photo ? `${BASE_URL}${student.photo}` : ''} size="lg" />
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
                    <span className="text-lg font-bold text-orange-500">{stats.missingOut}</span>
                    <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-wide">No T-Out</span>
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
                      id="date-filter" type="date" value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="pl-9 pr-3 py-2 text-sm rounded-lg transition cursor-pointer outline-none"
                      style={{ border: `1px solid rgb(var(--primary-200))`, backgroundColor: `rgb(var(--primary-50) / 0.4)`, color: `rgb(var(--primary-800))` }}
                      onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                      onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
                    />
                  </div>
                  {/* Status filter */}
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `rgb(var(--primary-400))` }} />
                    <select
                      id="status-filter" value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="pl-9 pr-8 py-2 text-sm rounded-lg outline-none appearance-none cursor-pointer transition"
                      style={{ border: `1px solid rgb(var(--primary-200))`, backgroundColor: `rgb(var(--primary-50) / 0.4)`, color: `rgb(var(--primary-800))` }}
                      onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                      onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
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
                      — filtered by{' '}
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
              <table className="w-full min-w-175">
                <thead>
                  <tr style={{ backgroundColor: `rgb(var(--primary-50) / 0.6)` }}>
                    {['Date', 'Time In', 'Time Out', 'Computed Hours', 'Location Status', 'Action'].map((col) => (
                      <th key={col} className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: `rgb(var(--primary-600))` }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} delay={i * 60} />)
                  ) : error ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
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
                      const hours = computeHours(rec.time_in, rec.time_out);
                      const missingOut = isMissingTimeOut(rec.time_out);
                      const config = LOCATION_CONFIG[rec.location_status] ?? LOCATION_CONFIG.verified;
                      const isUpdating = updatingIds.has(rec.attendance_id);

                      return (
                        <tr
                          key={rec.attendance_id}
                          className={`transition-colors duration-150 group ${config.rowHighlight}`}
                          style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}
                          onMouseEnter={e => { if (!config.rowHighlight) e.currentTarget.style.backgroundColor = `rgb(var(--primary-50) / 0.6)`; }}
                          onMouseLeave={e => { if (!config.rowHighlight) e.currentTarget.style.backgroundColor = ''; }}
                        >
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="text-sm font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
                              {formatDate(rec.attendance_date)}
                            </span>
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="text-sm font-medium" style={{ color: `rgb(var(--primary-700))` }}>{formatTime(rec.time_in)}</span>
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            {missingOut ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3" />Not recorded
                              </span>
                            ) : (
                              <span className="text-sm font-medium" style={{ color: `rgb(var(--primary-700))` }}>{formatTime(rec.time_out)}</span>
                            )}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            {hours ? (
                              <span className="text-sm font-semibold tabular-nums" style={{ color: `rgb(var(--primary-700))` }}>{hours}</span>
                            ) : (
                              <span className="text-xs text-gray-400 italic">—</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className={`transition-opacity duration-150 ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
                              <LocationStatusDropdown
                                status={rec.location_status}
                                onChange={(newStatus) => handleStatusChange(rec.attendance_id, newStatus)}
                                disabled={isUpdating}
                              />
                            </div>
                          </td>
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
                    <CheckCircle className="w-3 h-3" style={{ color: `rgb(var(--primary-500))` }} />Verified
                  </span>
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />Flagged
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-orange-500" />Missing T-Out
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

      {selected && (
        <DetailsModal
          record={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
};

export default StudentAttendance;