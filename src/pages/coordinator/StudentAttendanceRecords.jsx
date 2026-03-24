import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, MapPin, AlertTriangle, Eye, Filter,
  CheckCircle, Clock, X, StickyNote, Save, Navigation,
  ChevronDown, RefreshCw, TrendingUp,
} from 'lucide-react';
import { getCoordinatorAttendance, updateAttendanceLocationStatus } from '../../api/attendance';
import Avatar from '../../components/ui/Avatar';

const BASE_URL = import.meta.env.VITE_BASE_URL;

// ─── Constants ────────────────────────────────────────────────────────────────
// "verified" uses CSS vars; "discrepancy" is semantic amber — kept as Tailwind

const LOCATION_CONFIG = {
  verified: {
    label      : 'Verified',
    // pill/pillHover applied via inline style in the component
    pill       : '',
    pillHover  : '',
    usePrimary : true,
    icon       : CheckCircle,
    dot        : null,          // rendered inline
    optionIcon : CheckCircle,
    optionColor: null,          // rendered inline
    optionBg   : '',            // rendered inline
    checkColor : null,          // rendered inline
    rowHighlight: '',
  },
  discrepancy: {
    label      : 'Discrepancy',
    pill       : 'bg-amber-50 text-amber-700 border border-amber-200',
    pillHover  : 'hover:bg-amber-100 hover:border-amber-300',
    usePrimary : false,
    icon       : AlertTriangle,
    dot        : 'bg-amber-400',
    optionIcon : AlertTriangle,
    optionColor: 'text-amber-600',
    optionBg   : 'hover:bg-amber-50',
    checkColor : 'text-amber-600',
    rowHighlight: 'bg-amber-50/40 border-l-4 border-l-amber-400',
  },
};

const STATUS_OPTIONS = ['verified', 'discrepancy'];

const FILTER_OPTIONS = [
  { value: 'all',             label: 'All Records'      },
  { value: 'discrepancy',     label: 'With Discrepancy' },
  { value: 'complete',        label: 'Complete Records' },
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
    const hour   = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
  } catch { return timeStr; }
};

const computeHours = (timeIn, timeOut) => {
  if (!timeIn || !timeOut) return null;
  try {
    const toMins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const diff = toMins(timeOut) - toMins(timeIn);
    if (diff <= 0) return null;
    const hrs  = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  } catch { return null; }
};

const formatDate = (dateStr, opts = {}) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', ...opts });
};

// ─── Toast ────────────────────────────────────────────────────────────────────

const Toast = ({ message, type = 'success', onDismiss }) => {
  useEffect(() => { const t = setTimeout(onDismiss, 2500); return () => clearTimeout(t); }, [onDismiss]);

  // success uses primary var; warning is amber (semantic)
  const Icon = type === 'success' ? CheckCircle : AlertTriangle;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-100 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold ${type !== 'success' ? 'bg-amber-500 text-white' : 'text-white'}`}
      style={type === 'success' ? { backgroundColor: `rgb(var(--primary-600))`, animation: 'slideUp 0.25s ease-out' } : { animation: 'slideUp 0.25s ease-out' }}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {message}
      <button onClick={onDismiss} aria-label="Dismiss notification" className="ml-1 opacity-70 hover:opacity-100 transition-opacity">
        <X className="w-3.5 h-3.5" />
      </button>
      <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
};

// ─── LocationStatusDropdown ───────────────────────────────────────────────────

const LocationStatusDropdown = ({ status, onSelect, dropdownId, openId, setOpenId, size = 'sm', updating = false }) => {
  const config = LOCATION_CONFIG[status] ?? LOCATION_CONFIG.verified;
  const Icon   = updating ? RefreshCw : config.icon;
  const isOpen = openId === dropdownId;
  const ref    = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpenId(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [isOpen, setOpenId]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e) => { if (e.key === 'Escape') setOpenId(null); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, setOpenId]);

  const toggle       = (e) => { e.stopPropagation(); if (!updating) setOpenId(isOpen ? null : dropdownId); };
  const handleSelect = (e, newStatus) => { e.stopPropagation(); onSelect(newStatus); setOpenId(null); };

  const badgePadding = size === 'md' ? 'px-3 py-1.5' : 'px-2.5 py-1';
  const badgeText    = size === 'md' ? 'text-sm'     : 'text-xs';
  const iconSize     = size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3';

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        disabled={updating}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Location status: ${config.label}. Click to change.`}
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap select-none transition-all duration-150 focus:outline-none ${badgePadding} ${badgeText} ${updating ? 'opacity-70 cursor-wait' : 'cursor-pointer'} ${!config.usePrimary ? `${config.pill} ${config.pillHover}` : ''}`}
        style={config.usePrimary ? {
          backgroundColor: `rgb(var(--primary-100))`,
          color:           `rgb(var(--primary-700))`,
          border:          `1px solid rgb(var(--primary-200))`,
          ...(isOpen ? {} : {}),
        } : {}}
        onMouseEnter={e => { if (config.usePrimary && !updating) { e.currentTarget.style.backgroundColor = `rgb(var(--primary-200))`; e.currentTarget.style.borderColor = `rgb(var(--primary-300))`; } }}
        onMouseLeave={e => { if (config.usePrimary && !updating) { e.currentTarget.style.backgroundColor = `rgb(var(--primary-100))`; e.currentTarget.style.borderColor = `rgb(var(--primary-200))`; } }}
      >
        <Icon className={`${iconSize} ${updating ? 'animate-spin' : ''}`} />
        {config.label}
        {!updating && (
          <ChevronDown className={`${iconSize} ml-0.5 opacity-60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Dropdown panel */}
      <div
        className={`absolute left-0 top-[calc(100%+6px)] z-50 w-44 bg-white rounded-lg shadow-xl overflow-hidden transition-all duration-150 origin-top-left ${isOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'}`}
        style={{ border: `1px solid rgb(var(--primary-100))` }}
        role="listbox"
        aria-label="Select location status"
      >
        <div
          className="absolute -top-1.5 left-4 w-3 h-3 bg-white rotate-45"
          style={{ borderLeft: `1px solid rgb(var(--primary-100))`, borderTop: `1px solid rgb(var(--primary-100))` }}
        />
        <div className="relative p-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider px-3 pt-1.5 pb-1" style={{ color: `rgb(var(--primary-400))` }}>
            Set Status
          </p>
          {STATUS_OPTIONS.map((opt) => {
            const cfg = LOCATION_CONFIG[opt];
            const OptionIcon = cfg.optionIcon;
            const isSelected = status === opt;
            return (
              <button
                key={opt}
                role="option"
                aria-selected={isSelected}
                type="button"
                onClick={(e) => handleSelect(e, opt)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-100 text-left ${!cfg.usePrimary ? cfg.optionBg : ''}`}
                style={cfg.usePrimary && isSelected ? { backgroundColor: `rgb(var(--primary-50) / 0.8)` } : {}}
                onMouseEnter={e => { if (cfg.usePrimary) e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`; }}
                onMouseLeave={e => { if (cfg.usePrimary) e.currentTarget.style.backgroundColor = isSelected ? `rgb(var(--primary-50) / 0.8)` : ''; }}
              >
                <OptionIcon
                  className={`w-3.5 h-3.5 shrink-0 ${!cfg.usePrimary ? cfg.optionColor : ''}`}
                  style={cfg.usePrimary ? { color: `rgb(var(--primary-600))` } : {}}
                />
                <span
                  className={`flex-1 ${!cfg.usePrimary ? cfg.optionColor : ''}`}
                  style={cfg.usePrimary ? { color: `rgb(var(--primary-600))` } : {}}
                >
                  {cfg.label}
                </span>
                {isSelected && (
                  <CheckCircle
                    className={`w-3.5 h-3.5 shrink-0 ${!cfg.usePrimary ? cfg.checkColor : ''}`}
                    style={cfg.usePrimary ? { color: `rgb(var(--primary-600))` } : {}}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
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
      style={{
        border:     `1px solid rgb(var(--primary-200))`,
        background: `linear-gradient(to bottom right, rgb(var(--primary-50)), rgb(var(--primary-100)))`,
      }}
    >
      {/* Grid overlay */}
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

// ─── DetailsModal ─────────────────────────────────────────────────────────────

const DetailsModal = ({ record, onClose, onSave, onStatusChange, updatingId }) => {
  const [note,   setNote]   = useState(record.coordinator_note ?? '');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [modalOpenId, setModalOpenId] = useState(null);

  const hours      = computeHours(record.time_in, record.time_out);
  const isUpdating = updatingId === record.attendance_id;
  const isDiscrepancy = record.location_status === 'discrepancy';

  useEffect(() => { setNote(record.coordinator_note ?? ''); }, [record.attendance_id]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(record.attendance_id, note);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true" aria-labelledby="modal-title"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        style={{ border: `1px solid rgb(var(--primary-100))`, animation: 'modalIn 0.2s ease-out' }}
      >
        <style>{`@keyframes modalIn { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>

        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 shrink-0 ${isDiscrepancy ? 'bg-linear-to-r from-amber-50 to-white' : ''}`}
          style={!isDiscrepancy ? {
            borderBottom: `1px solid rgb(var(--primary-100))`,
            background:   `linear-gradient(to right, rgb(var(--primary-50)), white)`,
          } : { borderBottom: '1px solid #fde68a' }}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm ${isDiscrepancy ? 'bg-linear-to-br from-amber-400 to-amber-600' : ''}`}
              style={!isDiscrepancy ? { background: `linear-gradient(to bottom right, rgb(var(--primary-400)), rgb(var(--primary-600)))` } : {}}
            >
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 id="modal-title" className="text-base font-bold" style={{ color: `rgb(var(--primary-800))` }}>
                {resolveFullName(record)}
              </h2>
              <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>
                Attendance Record · {formatDate(record.attendance_date)}
                {isDiscrepancy && (
                  <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-semibold">
                    <AlertTriangle className="w-3 h-3" />Discrepancy flagged
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

        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">

          {/* Left panel */}
          <div
            className="flex-1 overflow-y-auto p-6 space-y-5 border-b lg:border-b-0 lg:border-r"
            style={{ borderColor: `rgb(var(--primary-100))` }}
          >
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
                      color:           `rgb(var(--primary-700))`,
                      border:          `1px solid rgb(var(--primary-100))`,
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
          </div>

          {/* Right panel */}
          <div
            className="w-full lg:w-72 xl:w-80 shrink-0 flex flex-col overflow-y-auto p-6 space-y-5"
            style={{ backgroundColor: `rgb(var(--primary-50) / 0.3)` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <StickyNote className="w-4 h-4" style={{ color: `rgb(var(--primary-500))` }} />
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: `rgb(var(--primary-800))` }}>Review</h3>
            </div>

            <div className="bg-white rounded-xl p-4 space-y-3" style={{ border: `1px solid rgb(var(--primary-100))` }}>
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: `rgb(var(--primary-500))` }}>Location Status</p>
                <LocationStatusDropdown
                  status={record.location_status}
                  onSelect={(newStatus) => onStatusChange(record.attendance_id, newStatus)}
                  dropdownId={`modal-${record.attendance_id}`}
                  openId={modalOpenId}
                  setOpenId={setModalOpenId}
                  size="md"
                  updating={isUpdating}
                />
              </div>
              {record.location_status === 'discrepancy' && (
                <div className="flex items-start gap-2 mt-1 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    The recorded location does not match the expected company address. Please review and add a note if needed.
                  </p>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col">
              <label htmlFor="coordinator-note" className="block text-xs font-semibold mb-1.5" style={{ color: `rgb(var(--primary-700))` }}>
                Coordinator Notes
              </label>
              <textarea
                id="coordinator-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add notes or remarks about this attendance record…"
                rows={8}
                className="w-full flex-1 text-sm bg-white rounded-lg px-3 py-2.5 resize-none outline-none transition leading-relaxed"
                style={{
                  color:       `rgb(var(--primary-800))`,
                  border:      `1px solid rgb(var(--primary-200))`,
                  '::placeholder': { color: `rgb(var(--primary-300))` },
                }}
                onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                onBlur={e =>  { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
              />
              <p className="text-xs mt-1 text-right" style={{ color: `rgb(var(--primary-400))` }} aria-live="polite">
                {note.length} characters
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-lg active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 shadow-sm"
                style={{ backgroundColor: `rgb(var(--primary-600))` }}
                onMouseEnter={e => { if (!saving) e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`; }}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}
              >
                {saving ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                ) : saved ? (
                  <><CheckCircle className="w-4 h-4" />Saved!</>
                ) : (
                  <><Save className="w-4 h-4" />Save Notes</>
                )}
              </button>
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
    </div>
  );
};

// ─── Skeleton / Empty States ──────────────────────────────────────────────────

const SkeletonRow = ({ delay = 0 }) => (
  <tr style={{ borderBottom: `1px solid rgb(var(--primary-50))`, animationDelay: `${delay}ms` }}>
    {[24, 16, 16, 12, 24, 32, 16].map((w, i) => (
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
          {hasFilter ? 'Try adjusting your search or filter.' : 'Attendance records will appear once the student starts logging.'}
        </p>
      </div>
    </td>
  </tr>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const StudentAttendance = () => {
  const { studentId } = useParams();
  const navigate      = useNavigate();

  const [allRecords,   setAllRecords]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(false);
  const [selected,     setSelected]     = useState(null);
  const [search,       setSearch]       = useState('');
  const [dateFilter,   setDateFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tableOpenId,  setTableOpenId]  = useState(null);
  const [updatingId,   setUpdatingId]   = useState(null);
  const [toast,        setToast]        = useState(null);

  useEffect(() => {
    getCoordinatorAttendance()
      .then((data) => {
        const studentRecords = (Array.isArray(data) ? data : [])
          .filter((r) => String(r.student_id) === String(studentId));
        studentRecords.sort((a, b) => new Date(b.attendance_date) - new Date(a.attendance_date));
        setAllRecords(studentRecords);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [studentId]);

  const student = useMemo(() => {
    if (allRecords.length === 0) return null;
    const r = allRecords[0];
    return { full_name: resolveFullName(r), course: r.course ?? '', company: r.company ?? '', photo: r.photo ?? '' };
  }, [allRecords]);

  const stats = useMemo(() => ({
    total:       allRecords.length,
    verified:    allRecords.filter((r) => r.location_status === 'verified').length,
    discrepancy: allRecords.filter((r) => r.location_status === 'discrepancy').length,
    missingOut:  allRecords.filter((r) => isMissingTimeOut(r.time_out)).length,
  }), [allRecords]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRecords.filter((r) => {
      const matchesSearch = !q || formatDate(r.attendance_date).toLowerCase().includes(q);
      const matchesDate   = !dateFilter || r.attendance_date?.startsWith(dateFilter);
      const matchesStatus =
        statusFilter === 'all'             ||
        (statusFilter === 'discrepancy'     && r.location_status === 'discrepancy') ||
        (statusFilter === 'complete'        && r.time_in && !isMissingTimeOut(r.time_out)) ||
        (statusFilter === 'missing_timeout' && isMissingTimeOut(r.time_out));
      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [allRecords, search, dateFilter, statusFilter]);

  const hasFilter = search.trim() !== '' || dateFilter !== '' || statusFilter !== 'all';

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);

  const handleStatusChange = useCallback(async (id, newStatus) => {
    setUpdatingId(id);
    try {
      setAllRecords((prev) => prev.map((r) => r.attendance_id === id ? { ...r, location_status: newStatus } : r));
      setSelected((prev) => prev?.attendance_id === id ? { ...prev, location_status: newStatus } : prev);
      await updateAttendanceLocationStatus(id, newStatus);
      const label = LOCATION_CONFIG[newStatus]?.label ?? newStatus;
      showToast(`Status updated to ${label}`, newStatus === 'discrepancy' ? 'warning' : 'success');
    } catch (err) {
      console.error('Failed to update location status:', err);
      showToast('Failed to update status. Please try again.', 'warning');
    } finally {
      setUpdatingId(null);
    }
  }, [showToast]);

  const handleSaveNote = useCallback(async (id, note) => {
    setAllRecords((prev) => prev.map((r) => r.attendance_id === id ? { ...r, coordinator_note: note } : r));
    setSelected((prev) => prev?.attendance_id === id ? { ...prev, coordinator_note: note } : prev);
  }, []);

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
                {/* Mini stats — verified uses primary; discrepancy/missing are semantic */}
                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  <div className="flex flex-col items-center rounded-lg px-4 py-2" style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}>
                    <span className="text-lg font-bold" style={{ color: `rgb(var(--primary-600))` }}>{stats.verified}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--primary-500))` }}>Verified</span>
                  </div>
                  <div className="flex flex-col items-center bg-amber-50 border border-amber-100 rounded-lg px-4 py-2">
                    <span className="text-lg font-bold text-amber-600">{stats.discrepancy}</span>
                    <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Discrepancy</span>
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
                      onBlur={e =>  { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
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
                      onBlur={e =>  { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
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
                    {['Date', 'Time In', 'Time Out', 'Computed Hours', 'Location Status', 'Notes', 'Action'].map((col) => (
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
                      const hours      = computeHours(rec.time_in, rec.time_out);
                      const missingOut = isMissingTimeOut(rec.time_out);
                      const config     = LOCATION_CONFIG[rec.location_status] ?? LOCATION_CONFIG.verified;
                      const isUpdating = updatingId === rec.attendance_id;

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
                            <LocationStatusDropdown
                              status={rec.location_status}
                              onSelect={(newStatus) => handleStatusChange(rec.attendance_id, newStatus)}
                              dropdownId={`table-${rec.attendance_id}`}
                              openId={tableOpenId}
                              setOpenId={setTableOpenId}
                              size="sm"
                              updating={isUpdating}
                            />
                          </td>
                          <td className="py-4 px-4 max-w-45">
                            {rec.coordinator_note ? (
                              <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: `rgb(var(--primary-600))` }}>
                                {rec.coordinator_note}
                              </p>
                            ) : (
                              <span className="text-xs italic" style={{ color: `rgb(var(--primary-300))` }}>No notes</span>
                            )}
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
                    <AlertTriangle className="w-3 h-3 text-amber-500" />Discrepancy
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-orange-500" />Missing T-Out
                  </span>
                  {stats.discrepancy > 0 && (
                    <span className="flex items-center gap-1 text-amber-600 font-medium">
                      <span className="w-1 h-3 inline-block bg-amber-400 rounded" />
                      Discrepancy rows have an amber left border
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
          onSave={handleSaveNote}
          onStatusChange={handleStatusChange}
          updatingId={updatingId}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
};

export default StudentAttendance;