import { useEffect, useState, useMemo } from 'react';
import {
  Users, Search, Eye, CheckCircle, Clock, AlertCircle,
  FileText, BookOpen, TrendingUp, Filter, Building2, X, Loader2,
  Plus, Edit2, ChevronDown, GraduationCap,
  LogIn, LogOut, Coffee, Moon, CalendarClock,
} from 'lucide-react';
import { getCoordinatorStudents, assignCompany, getStudentProgress } from '../../api/students';
import { getCompanies } from '../../api/companies';
import apiClient from '../../api/axios';
import Avatar from '../../components/ui/Avatar';

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: 'all',       label: 'All Students' },
  { value: 'completed', label: 'Completed'    },
  { value: 'ongoing',   label: 'On-Going'     },
];

const EMPTY_FORM = { f_name: '', l_name: '', email: '', course_id: '', ojt_hours_required: '' };

const DEFAULT_START = '08:30';
const DEFAULT_END   = '17:00';

// ─── API helpers ──────────────────────────────────────────────────────────────

const studentsApi = {
  getCourses:       async ()            => (await apiClient.get('/courses')).data,
  getRequiredHours: async ()            => (await apiClient.get('/required-hours')).data,
  createStudent:    async (payload)     => (await apiClient.post('/student', payload)).data,
  updateStudent:    async (id, payload) => (await apiClient.put(`/student/${id}`, payload)).data,
};

// ─── Utilities ────────────────────────────────────────────────────────────────

const isCompleted = (s) => s.hours_completed >= s.ojt_hours_required;

/** "08:30:00" or "08:30" → "8:30 AM" */
const formatTime12h = (t) => {
  if (!t) return null;
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return null;
  return `${h % 12 || 12}:${mStr} ${h >= 12 ? 'PM' : 'AM'}`;
};

/** "08:30:00" → "08:30" (for <input type="time">) */
const toTimeInput = (t) => {
  if (!t) return '';
  const parts = t.split(':');
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : t;
};

/** "08:30" → "08:30:00" */
const toTimeStorage = (t) => (t && t.length === 5 ? `${t}:00` : t);

const toMins = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return isNaN(h) || isNaN(m) ? null : h * 60 + m;
};

const diffHours = (start, end) => {
  const s = toMins(start), e = toMins(end);
  if (s == null || e == null || e <= s) return 0;
  return parseFloat(((e - s) / 60).toFixed(2));
};

/**
 * Regular = time_in → time_out minus lunch.
 * Auto-deduct 1 hr if work ≥ 5 hrs and no lunch logged.
 * OT added separately.
 */
const computeTotalHours = (rec) => {
  const workHrs  = diffHours(rec.time_in, rec.time_out);
  const lunchHrs = diffHours(rec.lunch_break_start, rec.lunch_break_end);
  const otHrs    = diffHours(rec.ot_time_in, rec.ot_time_out);
  let deduct = lunchHrs > 0 ? lunchHrs : workHrs >= 5 ? 1 : 0;
  const total = Math.max(0, workHrs - deduct) + otHrs;
  return total > 0 ? parseFloat(total.toFixed(2)) : '—';
};

const getAttendanceStatus = (rec) => {
  if (!rec.time_in)
    return { label: 'No Record',  bg: '#f3f4f6', border: '#e5e7eb', text: '#9ca3af' };
  if (rec.lunch_break_start && !rec.lunch_break_end)
    return { label: 'On Break',   bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' };
  if (rec.ot_time_in && !rec.ot_time_out)
    return { label: 'OT Active',  bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' };
  if (!rec.time_out)
    return { label: 'Working',    bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' };
  return       { label: 'Completed', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ completed }) => completed ? (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border"
    style={{ backgroundColor: `rgb(var(--primary-100))`, color: `rgb(var(--primary-700))`, borderColor: `rgb(var(--primary-200))` }}>
    <CheckCircle className="w-3 h-3" /> Completed
  </span>
) : (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
    <Clock className="w-3 h-3" /> On-Going
  </span>
);

const PendingChip = ({ count, icon: Icon, color }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${count > 0 ? color : 'bg-gray-50 text-gray-400'}`}>
    <Icon className="w-3 h-3" />{count}
  </span>
);

const SummaryCard = ({ title, value, icon: Icon, colorClass, subtext, usePrimary }) => (
  <div className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow duration-200" style={{ border: `1px solid rgb(var(--primary-50))` }}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: `rgb(var(--primary-500))` }}>{title}</p>
        {usePrimary
          ? <p className="text-3xl font-bold" style={{ color: `rgb(var(--primary-800))` }}>{value}</p>
          : <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>}
        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
      </div>
      <div className="p-3 rounded-lg" style={{ backgroundColor: `rgb(var(--primary-50))` }}>
        <Icon className="w-5 h-5" style={{ color: `rgb(var(--primary-600))` }} />
      </div>
    </div>
  </div>
);

const EmptyState = ({ hasFilter }) => (
  <tr>
    <td colSpan={9} className="py-16 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: `rgb(var(--primary-50))` }}>
          <Users className="w-8 h-8" style={{ color: `rgb(var(--primary-300))` }} />
        </div>
        <p className="text-base font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
          {hasFilter ? 'No matching students found' : 'No students assigned'}
        </p>
        <p className="text-sm max-w-xs" style={{ color: `rgb(var(--primary-500))` }}>
          {hasFilter ? 'Try adjusting your search or filter criteria.' : 'Students assigned to you will appear here.'}
        </p>
      </div>
    </td>
  </tr>
);

const SkeletonRow = () => (
  <tr style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}>
    {Array.from({ length: 9 }).map((_, i) => (
      <td key={i} className="py-4 px-4">
        <div className="h-4 rounded animate-pulse" style={{ backgroundColor: `rgb(var(--primary-50))` }} />
      </td>
    ))}
  </tr>
);

const Toast = ({ message, visible }) => (
  <div
    className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 text-white text-sm font-medium rounded-xl shadow-xl transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
    style={{ backgroundColor: `rgb(var(--primary-700))` }}
  >
    <CheckCircle className="w-4 h-4 shrink-0" style={{ color: `rgb(var(--primary-300))` }} />
    {message}
  </div>
);

// ─── WorkflowCell — table cell for a start/end pair ──────────────────────────

const WorkflowCell = ({ start, end, inProgressLabel = 'In progress' }) => {
  if (!start && !end) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ backgroundColor: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb' }}>—</span>
  );
  if (start && !end) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ backgroundColor: '#fefce8', color: '#a16207', border: '1px solid #fef08a' }}>
      {inProgressLabel}
    </span>
  );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
      {formatTime12h(start)} → {formatTime12h(end)}
    </span>
  );
};

// ─── ScheduleBadge — compact schedule display ────────────────────────────────

const ScheduleBadge = ({ startTime, endTime }) => {
  const s = formatTime12h(startTime || DEFAULT_START + ':00');
  const e = formatTime12h(endTime   || DEFAULT_END   + ':00');
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))`, color: `rgb(var(--primary-700))` }}>
      <CalendarClock className="w-3 h-3 shrink-0" />
      {s} – {e}
    </span>
  );
};

// ─── ThemedInput / ThemedSelect ───────────────────────────────────────────────

const ThemedInput = ({ label, id, error, ...props }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--primary-600))` }}>{label}</label>
    <input id={id}
      className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all duration-150"
      style={{ border: error ? '1px solid #fca5a5' : `1px solid rgb(var(--primary-200))`, backgroundColor: 'white', color: `rgb(var(--primary-800))` }}
      onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-200))`; e.target.style.borderColor = `rgb(var(--primary-400))`; }}
      onBlur={e  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = error ? '#fca5a5' : `rgb(var(--primary-200))`; }}
      {...props}
    />
    {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
  </div>
);

const ThemedSelect = ({ label, id, error, children, ...props }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--primary-600))` }}>{label}</label>
    <div className="relative">
      <select id={id}
        className="w-full px-3.5 py-2.5 pr-9 rounded-lg text-sm outline-none appearance-none cursor-pointer transition-all duration-150"
        style={{ border: error ? '1px solid #fca5a5' : `1px solid rgb(var(--primary-200))`, backgroundColor: 'white', color: `rgb(var(--primary-800))` }}
        onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-200))`; e.target.style.borderColor = `rgb(var(--primary-400))`; }}
        onBlur={e  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = error ? '#fca5a5' : `rgb(var(--primary-200))`; }}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `rgb(var(--primary-400))` }} />
    </div>
    {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
  </div>
);

// ─── Assign Company Modal ─────────────────────────────────────────────────────

const AssignCompanyModal = ({
  student, companies, loadingCompanies,
  selectedCompanyId, onSelectCompany,
  startTime, endTime, onStartTime, onEndTime,
  onSubmit, onClose, submitting,
}) => {
  const hasCompany = Boolean(student?.company);

  const inputStyle = {
    border: `1px solid rgb(var(--primary-200))`,
    backgroundColor: `rgb(var(--primary-50))`,
    color: `rgb(var(--primary-800))`,
  };

  return (
    <>
      <div className="fixed inset-0 z-9998 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-xl"
          style={{ border: `1px solid rgb(var(--primary-100))`, animation: 'modalIn 0.2s ease-out forwards' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `rgb(var(--primary-50))` }}>
                <Building2 className="w-4 h-4" style={{ color: `rgb(var(--primary-600))` }} />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ color: `rgb(var(--primary-800))` }}>
                  {hasCompany ? 'Change Company & Schedule' : 'Assign Company & Schedule'}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: `rgb(var(--primary-500))` }}>
                  {student?.f_name} {student?.l_name}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-150"
              style={{ color: `rgb(var(--primary-400))` }}
              onMouseEnter={e => { e.currentTarget.style.color = `rgb(var(--primary-700))`; e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`; }}
              onMouseLeave={e => { e.currentTarget.style.color = `rgb(var(--primary-400))`; e.currentTarget.style.backgroundColor = ''; }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Current company banner */}
            {hasCompany && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg"
                style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}>
                <Building2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: `rgb(var(--primary-500))` }} />
                <p className="text-xs" style={{ color: `rgb(var(--primary-700))` }}>
                  <span className="font-semibold">Current company: </span>{student.company}
                  {(student.start_time || student.end_time) && (
                    <span className="ml-2 opacity-70">
                      · {formatTime12h(student.start_time) ?? DEFAULT_START} – {formatTime12h(student.end_time) ?? DEFAULT_END}
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Company select */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold" style={{ color: `rgb(var(--primary-800))` }}>Select Company</label>
              {loadingCompanies ? (
                <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg"
                  style={{ border: `1px solid rgb(var(--primary-200))`, backgroundColor: `rgb(var(--primary-50))` }}>
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: `rgb(var(--primary-500))` }} />
                  <span className="text-sm" style={{ color: `rgb(var(--primary-500))` }}>Loading companies…</span>
                </div>
              ) : (
                <select value={selectedCompanyId ?? ''} onChange={(e) => onSelectCompany(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg outline-none transition appearance-none cursor-pointer"
                  style={inputStyle}
                  onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                  onBlur={e  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}>
                  <option value="" disabled>— Choose a company —</option>
                  {companies.filter((c) => c.is_active === 1).map((c) => (
                    <option key={c.company_id} value={c.company_id}>{c.company_name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Work Schedule */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarClock className="w-3.5 h-3.5" style={{ color: `rgb(var(--primary-500))` }} />
                <label className="text-sm font-semibold" style={{ color: `rgb(var(--primary-800))` }}>Work Schedule</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--primary-600))` }}>Start Time</label>
                  <input type="time" value={startTime} onChange={(e) => onStartTime(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-all duration-150"
                    style={inputStyle}
                    onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-200))`; e.target.style.borderColor = `rgb(var(--primary-400))`; }}
                    onBlur={e  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--primary-600))` }}>End Time</label>
                  <input type="time" value={endTime} onChange={(e) => onEndTime(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-all duration-150"
                    style={inputStyle}
                    onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-200))`; e.target.style.borderColor = `rgb(var(--primary-400))`; }}
                    onBlur={e  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
                  />
                </div>
              </div>
              {/* Flexible schedule note */}
              <p className="text-[11px] mt-2 flex items-start gap-1" style={{ color: `rgb(var(--primary-400))` }}>
                <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                Schedule is informational only — students may render hours outside this range, including overtime, night shifts, and weekend duty.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 pb-5">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150"
              style={{ color: `rgb(var(--primary-700))`, backgroundColor: `rgb(var(--primary-50))` }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-100))`}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}>
              Cancel
            </button>
            <button onClick={onSubmit} disabled={!selectedCompanyId || submitting || loadingCompanies}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-150 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: `rgb(var(--primary-600))` }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`; }}>
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {hasCompany ? 'Update Assignment' : 'Assign Company'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Student Modal (Add / Edit) ───────────────────────────────────────────────

const StudentModal = ({ mode, student, courses, requiredHoursOptions, onClose, onSave }) => {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(
    isEdit
      ? { f_name: student.f_name ?? '', l_name: student.l_name ?? '', email: student.email ?? '',
          course_id: student.course_id != null ? String(student.course_id) : '',
          ojt_hours_required: student.ojt_hours_required != null ? String(student.ojt_hours_required) : '' }
      : { ...EMPTY_FORM }
  );
  const [errors,   setErrors]   = useState({});
  const [saving,   setSaving]   = useState(false);
  const [apiError, setApiError] = useState('');

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  useEffect(() => {
    if (!form.course_id || !courses.length) return;
    const m = courses.find((c) => String(c.course_id) === String(form.course_id));
    if (m?.required_hours && !form.ojt_hours_required)
      setForm((f) => ({ ...f, ojt_hours_required: String(m.required_hours) }));
  }, [form.course_id, courses]); // eslint-disable-line

  const handleCourseChange = (e) => {
    const id = e.target.value;
    const m  = courses.find((c) => String(c.course_id) === String(id));
    setForm((f) => ({ ...f, course_id: id, ojt_hours_required: m?.required_hours ? String(m.required_hours) : '' }));
  };

  const selectedCourseDefault = (() => {
    if (!form.course_id || !courses.length) return null;
    const m = courses.find((c) => String(c.course_id) === String(form.course_id));
    return m?.required_hours != null ? String(m.required_hours) : null;
  })();

  const validate = () => {
    const e = {};
    if (!form.f_name.trim())  e.f_name  = 'First name is required';
    if (!form.l_name.trim())  e.l_name  = 'Last name is required';
    if (!form.email.trim())   e.email   = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email address';
    if (!form.course_id)      e.course_id = 'Course is required';
    if (!form.ojt_hours_required) e.ojt_hours_required = 'Required hours is required';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiError('');
    try { await onSave(form); }
    catch (err) { setApiError(err?.message ?? 'Something went wrong. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-9998 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        style={{ border: `1px solid rgb(var(--primary-100))`, animation: 'modalIn 0.2s ease-out forwards' }}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0" style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `rgb(var(--primary-100))` }}>
              {isEdit ? <Edit2 className="w-5 h-5" style={{ color: `rgb(var(--primary-600))` }} /> : <Plus className="w-5 h-5" style={{ color: `rgb(var(--primary-600))` }} />}
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: `rgb(var(--primary-900))` }}>{isEdit ? 'Edit Student' : 'Add New Student'}</h2>
              <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>{isEdit ? 'Update student information' : 'Create a new student account'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ color: `rgb(var(--primary-500))` }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {apiError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-600">{apiError}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <ThemedInput label="First Name" id="f_name" placeholder="First Name" value={form.f_name} onChange={set('f_name')} error={errors.f_name} />
            <ThemedInput label="Last Name"  id="l_name" placeholder="Last Name"  value={form.l_name} onChange={set('l_name')} error={errors.l_name} />
          </div>
          <ThemedInput label="Email Address" id="email" type="email" placeholder="Email" value={form.email} onChange={set('email')} error={errors.email} />
          <ThemedSelect label="Course" id="course_id" value={form.course_id} onChange={handleCourseChange} error={errors.course_id}>
            <option value="">Select a course…</option>
            {courses.map((c) => <option key={c.course_id} value={String(c.course_id)}>{c.course_name}</option>)}
          </ThemedSelect>
          <ThemedSelect label="Required OJT Hours" id="ojt_hours_required" value={form.ojt_hours_required}
            onChange={(e) => setForm((f) => ({ ...f, ojt_hours_required: e.target.value }))} error={errors.ojt_hours_required}>
            {requiredHoursOptions.length === 0
              ? <option value="" disabled>No options available</option>
              : <>
                  <option value="">Select required hours…</option>
                  {selectedCourseDefault && <option value={selectedCourseDefault}>Use Course Default ({selectedCourseDefault} hrs)</option>}
                  {requiredHoursOptions.filter((o) => String(o.hours) !== selectedCourseDefault).map((o) => (
                    <option key={o.id} value={String(o.hours)}>{o.hours} hours</option>
                  ))}
                </>
            }
          </ThemedSelect>
          {!isEdit && (
            <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}>
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: `rgb(var(--primary-500))` }} />
              <p className="text-xs leading-relaxed" style={{ color: `rgb(var(--primary-600))` }}>
                Login credentials will be automatically generated and sent to the student's email.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 shrink-0 rounded-b-2xl" style={{ borderTop: `1px solid rgb(var(--primary-50))`, backgroundColor: `rgb(var(--primary-50), 0.3)` }}>
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{ border: `1px solid rgb(var(--primary-200))`, color: `rgb(var(--primary-700))` }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: `rgb(var(--primary-600))` }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`; }}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Student'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const CoordinatorStudents = () => {
  const [students,          setStudents]          = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [search,            setSearch]            = useState('');
  const [filter,            setFilter]            = useState('all');
  const [showModal,         setShowModal]         = useState(false);
  const [selectedStudent,   setSelectedStudent]   = useState(null);
  const [companies,         setCompanies]         = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [scheduleStart,     setScheduleStart]     = useState(DEFAULT_START);
  const [scheduleEnd,       setScheduleEnd]       = useState(DEFAULT_END);
  const [loadingCompanies,  setLoadingCompanies]  = useState(false);
  const [submitting,        setSubmitting]        = useState(false);
  const [toast,             setToast]             = useState({ visible: false, message: '' });
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressData,      setProgressData]      = useState(null);
  const [progressLoading,   setProgressLoading]   = useState(false);
  const [studentModal,      setStudentModal]      = useState(null);
  const [courses,           setCourses]           = useState([]);
  const [requiredHoursOptions, setRequiredHoursOptions] = useState([]);

  useEffect(() => {
    getCoordinatorStudents().then((d) => setStudents(d ?? [])).finally(() => setLoading(false));
    studentsApi.getCourses().then((d) => setCourses(d ?? [])).catch(console.error);
    studentsApi.getRequiredHours().then((d) => setRequiredHoursOptions(Array.isArray(d) ? d : [])).catch(console.error);
  }, []);

  const stats = useMemo(() => {
    const total = students.length, completed = students.filter(isCompleted).length;
    return { total, completed, ongoing: total - completed, withPending: students.filter((s) => s.submitted_logs > 0 || s.submitted_narratives > 0).length };
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const name = `${s.f_name} ${s.l_name}`.toLowerCase();
      const ok = !q || name.includes(q) || s.company?.toLowerCase().includes(q) || s.course?.toLowerCase().includes(q);
      const okF = filter === 'all' || (filter === 'completed' && isCompleted(s)) || (filter === 'ongoing' && !isCompleted(s));
      return ok && okF;
    });
  }, [students, search, filter]);

  const hasFilter = search.trim() !== '' || filter !== 'all';

  const showToast = (msg) => {
    setToast({ visible: true, message: msg });
    setTimeout(() => setToast({ visible: false, message: '' }), 3000);
  };

  const openAssignModal = async (student) => {
    setSelectedStudent(student);
    setSelectedCompanyId('');
    setScheduleStart(toTimeInput(student.start_time) || DEFAULT_START);
    setScheduleEnd(toTimeInput(student.end_time)     || DEFAULT_END);
    setShowModal(true);
    setLoadingCompanies(true);
    try { setCompanies((await getCompanies()) ?? []); }
    catch { setCompanies([]); }
    finally { setLoadingCompanies(false); }
  };

  const closeAssignModal = () => {
    setShowModal(false); setSelectedStudent(null); setSelectedCompanyId('');
    setScheduleStart(DEFAULT_START); setScheduleEnd(DEFAULT_END);
  };

  const handleAssignSubmit = async () => {
    if (!selectedCompanyId || !selectedStudent) return;
    setSubmitting(true);
    try {
      await assignCompany(selectedStudent.student_id, {
        company_id: selectedCompanyId,
        start_time: toTimeStorage(scheduleStart),
        end_time:   toTimeStorage(scheduleEnd),
      });
      const co = companies.find((c) => String(c.company_id) === String(selectedCompanyId));
      setStudents((prev) => prev.map((s) =>
        s.student_id === selectedStudent.student_id
          ? { ...s, company: co?.company_name ?? s.company, start_time: toTimeStorage(scheduleStart), end_time: toTimeStorage(scheduleEnd) }
          : s
      ));
      closeAssignModal();
      showToast(`Company assigned to ${selectedStudent.f_name} ${selectedStudent.l_name}`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to assign company');
    } finally { setSubmitting(false); }
  };

  const handleViewProgress = async (studentId) => {
    setProgressLoading(true); setShowProgressModal(true);
    try { setProgressData(await getStudentProgress(studentId)); }
    catch { console.error('Failed to fetch progress'); }
    finally { setProgressLoading(false); }
  };

  const handleAddStudent = async (form) => {
    await studentsApi.createStudent(form);
    setStudents((await getCoordinatorStudents()) ?? []);
    setStudentModal(null);
    showToast(`Student ${form.f_name} ${form.l_name} created`);
  };

  const handleEditStudent = async (form) => {
    await studentsApi.updateStudent(studentModal.student.student_id, form);
    setStudents((await getCoordinatorStudents()) ?? []);
    setStudentModal(null);
    showToast(`${form.f_name} ${form.l_name} updated successfully`);
  };

  return (
    <div className="min-h-screen p-6" style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), white)` }}>
      <div className="max-w-350 mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: `rgb(var(--primary-800))` }}>My Students</h1>
            <p className="mt-1 text-sm" style={{ color: `rgb(var(--primary-500))` }}>Monitor and manage assigned OJT students</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 text-xs font-medium bg-white rounded-lg px-3 py-2 shadow-sm"
              style={{ color: `rgb(var(--primary-400))`, border: `1px solid rgb(var(--primary-100))` }}>
              <TrendingUp className="w-3.5 h-3.5" />{stats.total} students assigned
            </div>
            <button onClick={() => setStudentModal({ mode: 'add' })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-all duration-150 active:scale-95"
              style={{ backgroundColor: `rgb(var(--primary-600))` }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}>
              <Plus className="w-4 h-4" />Add Student
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Total Students"      value={loading ? '—' : stats.total}      icon={Users}        usePrimary />
          <SummaryCard title="Completed"           value={loading ? '—' : stats.completed}  icon={CheckCircle}  usePrimary
            subtext={!loading && stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}% of total` : null} />
          <SummaryCard title="On-Going"            value={loading ? '—' : stats.ongoing}    icon={Clock}        colorClass="text-amber-600" />
          <SummaryCard title="Pending Submissions" value={loading ? '—' : stats.withPending} icon={AlertCircle} colorClass="text-orange-600" subtext="Students with pending items" />
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden" style={{ border: `1px solid rgb(var(--primary-50))` }}>
          {/* Toolbar */}
          <div className="px-6 pt-5 pb-4" style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <h2 className="text-lg font-bold" style={{ color: `rgb(var(--primary-800))` }}>Student List</h2>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `rgb(var(--primary-400))` }} />
                  <input type="text" placeholder="Search by name, course, company…" value={search} onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 text-sm rounded-lg w-72 transition outline-none"
                    style={{ border: `1px solid rgb(var(--primary-200))`, backgroundColor: `rgb(var(--primary-50))`, color: `rgb(var(--primary-800))` }}
                    onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                    onBlur={e  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }} />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `rgb(var(--primary-400))` }} />
                  <select value={filter} onChange={(e) => setFilter(e.target.value)}
                    className="pl-9 pr-8 py-2 text-sm rounded-lg outline-none appearance-none cursor-pointer transition"
                    style={{ border: `1px solid rgb(var(--primary-200))`, backgroundColor: `rgb(var(--primary-50))`, color: `rgb(var(--primary-800))` }}
                    onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                    onBlur={e  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}>
                    {FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            {hasFilter && !loading && (
              <p className="text-xs mt-2" style={{ color: `rgb(var(--primary-500))` }}>
                Showing <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>{filtered.length}</span> of {students.length} students
              </p>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: `rgb(var(--primary-50))` }}>
                  {['Student', 'Course', 'Company / Schedule', 'OJT Hours', 'Daily Logs', 'Narratives', 'Status', 'Actions'].map((col) => (
                    <th key={col} className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: `rgb(var(--primary-600))` }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                  : filtered.length === 0 ? <EmptyState hasFilter={hasFilter} />
                  : filtered.map((student) => {
                    const done = isCompleted(student);
                    return (
                      <tr key={student.student_id} className="transition-colors duration-150" style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                        {/* Student */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={`${student.f_name} ${student.l_name}`} src={student.photo?.startsWith('http') ? student.photo : ''} size="sm" />
                            <span className="text-sm font-semibold whitespace-nowrap" style={{ color: `rgb(var(--primary-800))` }}>{student.f_name} {student.l_name}</span>
                          </div>
                        </td>
                        {/* Course */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-sm whitespace-nowrap" style={{ color: `rgb(var(--primary-700))` }}>
                            <GraduationCap className="w-3.5 h-3.5 shrink-0" style={{ color: `rgb(var(--primary-400))` }} />{student.course ?? '—'}
                          </div>
                        </td>
                        {/* Company + Schedule */}
                        <td className="py-3.5 px-4">
                          <p className="text-sm max-w-44 truncate font-medium" style={{ color: `rgb(var(--primary-700))` }} title={student.company}>
                            {student.company ?? '—'}
                          </p>
                          {student.company && (
                            <ScheduleBadge startTime={student.start_time} endTime={student.end_time} />
                          )}
                        </td>
                        {/* OJT Hours */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                            <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: `rgb(var(--primary-400))` }} />
                            <span className="font-semibold" style={{ color: `rgb(var(--primary-800))` }}>{student.hours_completed}</span>
                            <span style={{ color: `rgb(var(--primary-400))` }}>/</span>
                            <span style={{ color: `rgb(var(--primary-600))` }}>{student.ojt_hours_required} hrs</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4"><PendingChip count={student.submitted_logs}       icon={FileText} color="bg-orange-50 text-orange-600" /></td>
                        <td className="py-3.5 px-4"><PendingChip count={student.submitted_narratives} icon={BookOpen}  color="bg-rose-50 text-rose-600" /></td>
                        <td className="py-3.5 px-4"><StatusBadge completed={done} /></td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleViewProgress(student.student_id)} title="View Progress" className="p-2 rounded-lg transition-colors" style={{ color: `rgb(var(--primary-600))` }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => setStudentModal({ mode: 'edit', student })} title="Edit Student" className="p-2 rounded-lg transition-colors" style={{ color: `rgb(var(--primary-600))` }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => openAssignModal(student)} disabled={loading}
                              title={student.company ? 'Change Company & Schedule' : 'Assign Company & Schedule'}
                              className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${student.company ? 'text-indigo-600 hover:bg-indigo-50' : 'text-blue-600 hover:bg-blue-50'}`}>
                              <Building2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 && (
            <div className="px-6 py-3 flex items-center justify-between" style={{ borderTop: `1px solid rgb(var(--primary-50))`, backgroundColor: `rgb(var(--primary-50))` }}>
              <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>{filtered.length} student{filtered.length !== 1 ? 's' : ''} shown</p>
              <div className="flex items-center gap-4 text-xs" style={{ color: `rgb(var(--primary-500))` }}>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: `rgb(var(--primary-500))` }} />Completed</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />On-Going</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign Company Modal */}
      {showModal && selectedStudent && (
        <AssignCompanyModal
          student={selectedStudent}
          companies={companies}
          loadingCompanies={loadingCompanies}
          selectedCompanyId={selectedCompanyId}
          onSelectCompany={setSelectedCompanyId}
          startTime={scheduleStart}
          endTime={scheduleEnd}
          onStartTime={setScheduleStart}
          onEndTime={setScheduleEnd}
          onSubmit={handleAssignSubmit}
          onClose={closeAssignModal}
          submitting={submitting}
        />
      )}

      {/* Student Add / Edit Modal */}
      {studentModal?.mode === 'add' && (
        <StudentModal mode="add" courses={courses} requiredHoursOptions={requiredHoursOptions} onClose={() => setStudentModal(null)} onSave={handleAddStudent} />
      )}
      {studentModal?.mode === 'edit' && (
        <StudentModal mode="edit" student={studentModal.student} courses={courses} requiredHoursOptions={requiredHoursOptions} onClose={() => setStudentModal(null)} onSave={handleEditStudent} />
      )}

      {/* Progress Modal */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-9998 p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="h-2 w-full" style={{ background: `linear-gradient(to right, rgb(var(--primary-700)), rgb(var(--primary-600)), rgb(var(--primary-500)))` }} />
            <button onClick={() => setShowProgressModal(false)}
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
                  {/* Student header */}
                  <div className="flex items-start gap-4 mb-6">
                    <Avatar name={`${progressData.student?.f_name} ${progressData.student?.l_name}`} src={progressData.student?.photo} size="lg" />
                    <div className="flex-1 min-w-0">
                      <h2 className="text-2xl font-bold leading-tight" style={{ color: `rgb(var(--primary-800))` }}>
                        {progressData.student?.f_name} {progressData.student?.l_name}
                      </h2>
                      <p className="text-sm mt-0.5" style={{ color: `rgb(var(--primary-500))` }}>OJT Progress Overview</p>
                      {/* Schedule display in modal */}
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

                  {/* Hours progress */}
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
                        {Math.min(Math.round((progressData.hoursCompleted / progressData.student?.ojt_hours_required) * 100), 100)}%
                      </span>
                    </div>
                    <div className="w-full rounded-full h-2.5 overflow-hidden" style={{ backgroundColor: `rgb(var(--primary-100))` }}>
                      <div className="h-2.5 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min((progressData.hoursCompleted / progressData.student?.ojt_hours_required) * 100, 100)}%`, background: `linear-gradient(to right, rgb(var(--primary-500)), rgb(var(--primary-400)))` }} />
                    </div>
                  </div>

                  {/* Stat tiles */}
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

                  {/* Recent Attendance — workflow-based */}
                  {progressData.recentAttendance?.some((r) => r?.date) && (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: `1px solid rgb(var(--primary-100))` }}>
                      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid rgb(var(--primary-50))`, backgroundColor: `rgb(var(--primary-50))` }}>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: `rgb(var(--primary-600))` }}>Recent Attendance</p>
                        <div className="flex items-center gap-3">
                          {[{ dot: '#e5e7eb', label: 'No record', text: '#9ca3af' }, { dot: '#fde68a', label: 'In progress', text: '#a16207' }, { dot: '#bbf7d0', label: 'Completed', text: '#15803d' }].map(({ dot, label, text }) => (
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
                                { label: 'Date',        icon: null    },
                                { label: 'Schedule',    icon: CalendarClock },
                                { label: 'Work Hours',  icon: LogIn   },
                                { label: 'Lunch Break', icon: Coffee  },
                                { label: 'Time Out',    icon: LogOut  },
                                { label: 'Overtime',    icon: Moon    },
                                { label: 'Total',       icon: null    },
                                { label: 'Status',      icon: null    },
                              ].map(({ label, icon: Icon }) => (
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
                              const total  = computeTotalHours(rec);
                              const status = getAttendanceStatus(rec);
                              const schedStart = formatTime12h(rec.start_time || progressData.student?.start_time);
                              const schedEnd   = formatTime12h(rec.end_time   || progressData.student?.end_time);
                              return (
                                <tr key={idx} className="transition-colors duration-150" style={{ borderTop: `1px solid rgb(var(--primary-50))` }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                                  {/* Date */}
                                  <td className="py-3 px-4 text-sm font-medium whitespace-nowrap" style={{ color: `rgb(var(--primary-800))` }}>
                                    {(() => { const d = rec?.date ? new Date(rec.date) : null; return d && !isNaN(d) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; })()}
                                  </td>
                                  {/* Schedule */}
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    {schedStart && schedEnd ? (
                                      <span className="text-xs font-medium" style={{ color: `rgb(var(--primary-500))` }}>{schedStart} – {schedEnd}</span>
                                    ) : (
                                      <span className="text-xs text-gray-400">—</span>
                                    )}
                                  </td>
                                  {/* Work Hours */}
                                  <td className="py-3 px-4"><WorkflowCell start={rec.time_in} end={rec.time_out} inProgressLabel="Working" /></td>
                                  {/* Lunch Break */}
                                  <td className="py-3 px-4"><WorkflowCell start={rec.lunch_break_start} end={rec.lunch_break_end} inProgressLabel="On break" /></td>
                                  {/* Time Out */}
                                  <td className="py-3 px-4">
                                    {rec.time_out
                                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap" style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>{formatTime12h(rec.time_out)}</span>
                                      : <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb' }}>—</span>}
                                  </td>
                                  {/* Overtime */}
                                  <td className="py-3 px-4"><WorkflowCell start={rec.ot_time_in} end={rec.ot_time_out} inProgressLabel="OT Active" /></td>
                                  {/* Total */}
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold"
                                      style={total === '—'
                                        ? { backgroundColor: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb' }
                                        : { backgroundColor: `rgb(var(--primary-50))`, color: `rgb(var(--primary-700))`, border: `1px solid rgb(var(--primary-100))` }}>
                                      {total === '—' ? '—' : `${total} hrs`}
                                    </span>
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
      )}

      <Toast message={toast.message} visible={toast.visible} />

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default CoordinatorStudents;