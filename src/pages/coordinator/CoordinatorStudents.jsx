import { useEffect, useState, useMemo } from 'react';
import {
  Users, Search, Eye, CheckCircle, Clock, AlertCircle,
  FileText, BookOpen, TrendingUp, Filter, Building2, X, Loader2,
  Plus, Edit2, ChevronDown, Mail, GraduationCap,
} from 'lucide-react';
import { getCoordinatorStudents, assignCompany, getStudentProgress } from '../../api/students';
import { getCompanies } from '../../api/companies';
import apiClient from '../../api/axios';
import Avatar from '../../components/ui/Avatar';


// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Students' },
  { value: 'completed', label: 'Completed' },
  { value: 'ongoing', label: 'On-Going' },
];

const REQUIRED_HOURS_OPTIONS = [120, 240, 300, 360, 480, 600];

const EMPTY_FORM = {
  f_name: '',
  l_name: '',
  email: '',
  course_id: '',
  ojt_hours_required: '',
};

// ─── API helpers ──────────────────────────────────────────────────────────────

const studentsApi = {
  getCourses: async () => (await apiClient.get('/courses')).data,
  createStudent: async (payload) => (await apiClient.post('/student', payload)).data,
  updateStudent: async (id, payload) => (await apiClient.put(`/student/${id}`, payload)).data,
};

// ─── Utilities ────────────────────────────────────────────────────────────────

const isCompleted = (student) => student.hours_completed >= student.ojt_hours_required;

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ completed }) =>
  completed ? (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border"
      style={{
        backgroundColor: `rgb(var(--primary-100))`,
        color: `rgb(var(--primary-700))`,
        borderColor: `rgb(var(--primary-200))`,
      }}
    >
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
  <div
    className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow duration-200"
    style={{ border: `1px solid rgb(var(--primary-50))` }}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: `rgb(var(--primary-500))` }}>
          {title}
        </p>
        {usePrimary ? (
          <p className="text-3xl font-bold" style={{ color: `rgb(var(--primary-800))` }}>{value}</p>
        ) : (
          <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
        )}
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

// ─── Assign Company Modal ─────────────────────────────────────────────────────

const AssignCompanyModal = ({ student, companies, loadingCompanies, selectedCompanyId, onSelectCompany, onSubmit, onClose, submitting }) => {
  const hasCompany = Boolean(student?.company);
  return (
    <>
      <div className="fixed inset-0 z-9998 bg-black/40 backdrop-blur-sm transition-opacity duration-200" onClick={onClose} />
      <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-xl"
          style={{ border: `1px solid rgb(var(--primary-100))`, animation: 'modalIn 0.2s ease-out forwards' }}
        >
          <div
            className="flex items-center justify-between px-6 pt-5 pb-4"
            style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `rgb(var(--primary-50))` }}>
                <Building2 className="w-4 h-4" style={{ color: `rgb(var(--primary-600))` }} />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ color: `rgb(var(--primary-800))` }}>
                  {hasCompany ? 'Change Company' : 'Assign Company'}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: `rgb(var(--primary-500))` }}>
                  {student?.f_name} {student?.l_name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-150"
              style={{ color: `rgb(var(--primary-400))` }}
              onMouseEnter={e => { e.currentTarget.style.color = `rgb(var(--primary-700))`; e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`; }}
              onMouseLeave={e => { e.currentTarget.style.color = `rgb(var(--primary-400))`; e.currentTarget.style.backgroundColor = ''; }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {hasCompany && (
              <div
                className="flex items-start gap-2.5 p-3 rounded-lg"
                style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}
              >
                <Building2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: `rgb(var(--primary-500))` }} />
                <p className="text-xs" style={{ color: `rgb(var(--primary-700))` }}>
                  <span className="font-semibold">Current company: </span>{student.company}
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
                Select Company
              </label>
              {loadingCompanies ? (
                <div
                  className="flex items-center gap-2 py-2.5 px-3 rounded-lg"
                  style={{ border: `1px solid rgb(var(--primary-200))`, backgroundColor: `rgb(var(--primary-50))` }}
                >
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: `rgb(var(--primary-500))` }} />
                  <span className="text-sm" style={{ color: `rgb(var(--primary-500))` }}>Loading companies…</span>
                </div>
              ) : (
                <select
                  value={selectedCompanyId ?? ''}
                  onChange={(e) => onSelectCompany(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg outline-none transition appearance-none cursor-pointer"
                  style={{
                    border: `1px solid rgb(var(--primary-200))`,
                    backgroundColor: `rgb(var(--primary-50))`,
                    color: `rgb(var(--primary-800))`,
                  }}
                  onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                  onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
                >
                  <option value="" disabled>— Choose a company —</option>
                  {companies
                    .filter((c) => c.is_active === 1)
                    .map((c) => (
                      <option key={c.company_id} value={c.company_id}>
                        {c.company_name}
                      </option>
                    ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 pb-5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150"
              style={{ color: `rgb(var(--primary-700))`, backgroundColor: `rgb(var(--primary-50))` }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-100))`}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={!selectedCompanyId || submitting || loadingCompanies}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-150 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: `rgb(var(--primary-600))` }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`; }}
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {hasCompany ? 'Update Company' : 'Assign Company'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Student Modal (Add / Edit) ───────────────────────────────────────────────

const ThemedInput = ({ label, id, error, ...props }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--primary-600))` }}>
      {label}
    </label>
    <input
      id={id}
      className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all duration-150"
      style={{
        border: error ? '1px solid #fca5a5' : `1px solid rgb(var(--primary-200))`,
        backgroundColor: 'white',
        color: `rgb(var(--primary-800))`,
      }}
      onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-200))`; e.target.style.borderColor = `rgb(var(--primary-400))`; }}
      onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = error ? '#fca5a5' : `rgb(var(--primary-200))`; }}
      {...props}
    />
    {error && (
      <p className="text-xs text-red-500 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />{error}
      </p>
    )}
  </div>
);

const ThemedSelect = ({ label, id, error, children, ...props }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--primary-600))` }}>
      {label}
    </label>
    <div className="relative">
      <select
        id={id}
        className="w-full px-3.5 py-2.5 pr-9 rounded-lg text-sm outline-none appearance-none cursor-pointer transition-all duration-150"
        style={{
          border: error ? '1px solid #fca5a5' : `1px solid rgb(var(--primary-200))`,
          backgroundColor: 'white',
          color: `rgb(var(--primary-800))`,
        }}
        onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-200))`; e.target.style.borderColor = `rgb(var(--primary-400))`; }}
        onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = error ? '#fca5a5' : `rgb(var(--primary-200))`; }}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `rgb(var(--primary-400))` }} />
    </div>
    {error && (
      <p className="text-xs text-red-500 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />{error}
      </p>
    )}
  </div>
);

const StudentModal = ({ mode, student, courses, onClose, onSave }) => {
  const isEdit = mode === 'edit';

  const [form, setForm] = useState(
    isEdit
      ? {
        f_name: student.f_name ?? '',
        l_name: student.l_name ?? '',
        email: student.email ?? '',
        course_id: student.course_id ?? '',
        ojt_hours_required: student.ojt_hours_required ?? '',
      }
      : { ...EMPTY_FORM }
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.f_name.trim()) e.f_name = 'First name is required';
    if (!form.l_name.trim()) e.l_name = 'Last name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email address';
    if (!form.course_id) e.course_id = 'Course is required';
    if (!form.ojt_hours_required) e.ojt_hours_required = 'Required hours is required';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    setApiError('');
    try {
      await onSave(form);
    } catch (err) {
      setApiError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-9998 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]"
          style={{ border: `1px solid rgb(var(--primary-100))`, animation: 'modalIn 0.2s ease-out forwards' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0"
            style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `rgb(var(--primary-50))` }}>
                {isEdit
                  ? <Edit2 className="w-5 h-5" style={{ color: `rgb(var(--primary-600))` }} />
                  : <Plus className="w-5 h-5" style={{ color: `rgb(var(--primary-600))` }} />
                }
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ color: `rgb(var(--primary-800))` }}>
                  {isEdit ? 'Edit Student' : 'Add New Student'}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: `rgb(var(--primary-500))` }}>
                  {isEdit ? 'Update student information' : 'Create a new student account'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-150"
              style={{ color: `rgb(var(--primary-400))` }}
              onMouseEnter={e => { e.currentTarget.style.color = `rgb(var(--primary-700))`; e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`; }}
              onMouseLeave={e => { e.currentTarget.style.color = `rgb(var(--primary-400))`; e.currentTarget.style.backgroundColor = ''; }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {apiError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-600">{apiError}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <ThemedInput label="First Name" id="f_name" placeholder="First name" value={form.f_name} onChange={set('f_name')} error={errors.f_name} />
              <ThemedInput label="Last Name" id="l_name" placeholder="Last name" value={form.l_name} onChange={set('l_name')} error={errors.l_name} />
            </div>
            <ThemedInput label="Email Address" id="email" type="email" placeholder="student@email.com" value={form.email} onChange={set('email')} error={errors.email} />
            <ThemedSelect label="Course" id="course_id" value={form.course_id} onChange={set('course_id')} error={errors.course_id}>
              <option value="">Select a course…</option>
              {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
            </ThemedSelect>
            <ThemedSelect label="Required OJT Hours" id="ojt_hours_required" value={form.ojt_hours_required} onChange={set('ojt_hours_required')} error={errors.ojt_hours_required}>
              <option value="">Select required hours…</option>
              {REQUIRED_HOURS_OPTIONS.map((h) => <option key={h} value={h}>{h} hours</option>)}
            </ThemedSelect>
            {!isEdit && (
              <div
                className="flex items-start gap-2.5 p-3 rounded-lg"
                style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}
              >
                <Mail className="w-4 h-4 mt-0.5 shrink-0" style={{ color: `rgb(var(--primary-500))` }} />
                <p className="text-xs leading-relaxed" style={{ color: `rgb(var(--primary-600))` }}>
                  Login credentials will be automatically generated and sent to the student's email.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-3 px-6 py-4 shrink-0 rounded-b-2xl"
            style={{ borderTop: `1px solid rgb(var(--primary-50))`, backgroundColor: `rgb(var(--primary-50))` }}
          >
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150"
              style={{ color: `rgb(var(--primary-700))`, backgroundColor: 'white', border: `1px solid rgb(var(--primary-200))` }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-100))`}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-150 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: `rgb(var(--primary-600))` }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`; }}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Student'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const CoordinatorStudents = () => {
  // ── Existing state ──
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressData, setProgressData] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);

  // ── New state for student management ──
  const [studentModal, setStudentModal] = useState(null); // null | { mode: 'add' } | { mode: 'edit', student }
  const [courses, setCourses] = useState([]);

  // ── Fetch ──
  useEffect(() => {
    getCoordinatorStudents()
      .then((data) => setStudents(data ?? []))
      .finally(() => setLoading(false));

    studentsApi.getCourses()
      .then((data) => setCourses(data ?? []))
      .catch((err) => console.error('Failed to fetch courses:', err));
  }, []);

  // ── Derived state ──
  const stats = useMemo(() => {
    const total = students.length;
    const completed = students.filter(isCompleted).length;
    const ongoing = total - completed;
    const withPending = students.filter((s) => s.submitted_logs > 0 || s.submitted_narratives > 0).length;
    return { total, completed, ongoing, withPending };
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const fullName = `${s.f_name} ${s.l_name}`.toLowerCase();
      const matchesSearch = !q || fullName.includes(q) || s.company?.toLowerCase().includes(q) || s.course?.toLowerCase().includes(q);
      const matchesFilter = filter === 'all' || (filter === 'completed' && isCompleted(s)) || (filter === 'ongoing' && !isCompleted(s));
      return matchesSearch && matchesFilter;
    });
  }, [students, search, filter]);

  const hasFilter = search.trim() !== '' || filter !== 'all';

  // ── Helpers ──
  const showToast = (message) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 3000);
  };

  // ── Company assignment handlers ──
  const openAssignModal = async (student) => {
    setSelectedStudent(student);
    setSelectedCompanyId('');
    setShowModal(true);
    setLoadingCompanies(true);
    try {
      const data = await getCompanies();
      setCompanies(data ?? []);
    } catch (err) {
      console.error('Failed to fetch companies:', err);
      setCompanies([]);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const closeAssignModal = () => { setShowModal(false); setSelectedStudent(null); setSelectedCompanyId(''); };

  const handleAssignSubmit = async () => {
    if (!selectedCompanyId || !selectedStudent) return;
    setSubmitting(true);
    try {
      await assignCompany(selectedStudent.student_id, selectedCompanyId);
      const assignedCompany = companies.find((c) => String(c.company_id) === String(selectedCompanyId));
      setStudents((prev) => prev.map((s) =>
        s.student_id === selectedStudent.student_id
          ? { ...s, company: assignedCompany?.company_name ?? s.company }
          : s
      ));
      closeAssignModal();
      showToast(`Company assigned to ${selectedStudent.f_name} ${selectedStudent.l_name}`);
    } catch (err) {
      console.error('Assign company error:', err);

      const message =
        err.response?.data?.message ||
        "Failed to assign company";

      showToast(message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Progress handlers ──
  const handleViewProgress = async (studentId) => {
    try {
      setProgressLoading(true);
      setShowProgressModal(true);
      const data = await getStudentProgress(studentId);
      setProgressData(data);
    } catch (err) {
      console.error('Failed to fetch student progress:', err);
    } finally {
      setProgressLoading(false);
    }
  };

  // ── Student add / edit handlers ──
  const handleAddStudent = async (form) => {
    await studentsApi.createStudent({
      f_name: form.f_name,
      l_name: form.l_name,
      email: form.email,
      course_id: form.course_id,
      ojt_hours_required: form.ojt_hours_required,
    });

    const updatedStudents = await getCoordinatorStudents();
    setStudents(updatedStudents ?? []);

    setStudentModal(null);
    showToast(`Student ${form.f_name} ${form.l_name} created`);
  };

  const handleEditStudent = async (form) => {
    await studentsApi.updateStudent(studentModal.student.student_id, {
      f_name: form.f_name,
      l_name: form.l_name,
      email: form.email,
      course_id: form.course_id,
      ojt_hours_required: form.ojt_hours_required,
    });

    const updatedStudents = await getCoordinatorStudents();
    setStudents(updatedStudents ?? []);

    setStudentModal(null);
    showToast(`${form.f_name} ${form.l_name} updated successfully`);
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), white)` }}
    >
      <div className="max-w-350 mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: `rgb(var(--primary-800))` }}>
              My Students
            </h1>
            <p className="mt-1 text-sm" style={{ color: `rgb(var(--primary-500))` }}>
              Monitor and manage assigned OJT students
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="hidden lg:flex items-center gap-2 text-xs font-medium bg-white rounded-lg px-3 py-2 shadow-sm"
              style={{ color: `rgb(var(--primary-400))`, border: `1px solid rgb(var(--primary-100))` }}
            >
              <TrendingUp className="w-3.5 h-3.5" />{stats.total} students assigned
            </div>
            <button
              onClick={() => setStudentModal({ mode: 'add' })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-all duration-150 active:scale-95"
              style={{ backgroundColor: `rgb(var(--primary-600))` }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}
            >
              <Plus className="w-4 h-4" />
              Add Student
            </button>
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Total Students" value={loading ? '—' : stats.total} icon={Users} usePrimary />
          <SummaryCard title="Completed" value={loading ? '—' : stats.completed} icon={CheckCircle} usePrimary
            subtext={!loading && stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}% of total` : null} />
          <SummaryCard title="On-Going" value={loading ? '—' : stats.ongoing} icon={Clock} colorClass="text-amber-600" />
          <SummaryCard title="Pending Submissions" value={loading ? '—' : stats.withPending} icon={AlertCircle} colorClass="text-orange-600" subtext="Students with pending items" />
        </div>

        {/* ── Table Card ── */}
        <div
          className="bg-white rounded-2xl shadow-md overflow-hidden"
          style={{ border: `1px solid rgb(var(--primary-50))` }}
        >
          {/* Toolbar */}
          <div className="px-6 pt-5 pb-4" style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <h2 className="text-lg font-bold" style={{ color: `rgb(var(--primary-800))` }}>Student List</h2>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `rgb(var(--primary-400))` }} />
                  <input
                    type="text"
                    placeholder="Search by name, course, company…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 text-sm rounded-lg w-72 transition outline-none"
                    style={{ border: `1px solid rgb(var(--primary-200))`, backgroundColor: `rgb(var(--primary-50))`, color: `rgb(var(--primary-800))` }}
                    onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                    onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `rgb(var(--primary-400))` }} />
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-9 pr-8 py-2 text-sm rounded-lg outline-none appearance-none cursor-pointer transition"
                    style={{ border: `1px solid rgb(var(--primary-200))`, backgroundColor: `rgb(var(--primary-50))`, color: `rgb(var(--primary-800))` }}
                    onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                    onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
                  >
                    {FILTER_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            {hasFilter && !loading && (
              <p className="text-xs mt-2" style={{ color: `rgb(var(--primary-500))` }}>
                Showing{' '}
                <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>{filtered.length}</span>
                {' '}of {students.length} students
              </p>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: `rgb(var(--primary-50))` }}>
                  {['Student', 'Course', 'Company', 'OJT Hours', 'Daily Logs', 'Narratives', 'Status', 'Actions'].map((col) => (
                    <th
                      key={col}
                      className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                      style={{ color: `rgb(var(--primary-600))` }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : filtered.length === 0 ? (
                  <EmptyState hasFilter={hasFilter} />
                ) : (
                  filtered.map((student) => {
                    const done = isCompleted(student);
                    const hasCompany = Boolean(student.company);
                    return (
                      <tr
                        key={student.student_id}
                        className="transition-colors duration-150"
                        style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                      >
                        {/* Student */}
                        <td className="py-3.5 px-4 cursor-default">
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={`${student.f_name} ${student.l_name}`}
                              src={
                                student.photo && student.photo.startsWith("http")
                                  ? student.photo
                                  : ""
                              }
                              size="sm"
                            />
                            <span className="text-sm font-semibold whitespace-nowrap" style={{ color: `rgb(var(--primary-800))` }}>
                              {student.f_name} {student.l_name}
                            </span>
                          </div>
                        </td>
                        {/* Course */}
                        <td className="py-3.5 px-4 cursor-default">
                          <div className="flex items-center gap-1.5 text-sm whitespace-nowrap" style={{ color: `rgb(var(--primary-700))` }}>
                            <GraduationCap className="w-3.5 h-3.5 shrink-0" style={{ color: `rgb(var(--primary-400))` }} />
                            {student.course ?? '—'}
                          </div>
                        </td>
                        {/* Company */}
                        <td className="py-3.5 px-4 cursor-default">
                          <span className="text-sm max-w-40 truncate block" style={{ color: `rgb(var(--primary-700))` }} title={student.company}>
                            {student.company ?? '—'}
                          </span>
                        </td>
                        {/* OJT Hours */}
                        <td className="py-3.5 px-4 cursor-default">
                          <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                            <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: `rgb(var(--primary-400))` }} />
                            <span className="font-semibold" style={{ color: `rgb(var(--primary-800))` }}>{student.hours_completed}</span>
                            <span style={{ color: `rgb(var(--primary-400))` }}>/</span>
                            <span style={{ color: `rgb(var(--primary-600))` }}>{student.ojt_hours_required} hrs</span>
                          </div>
                        </td>
                        {/* Daily Logs */}
                        <td className="py-3.5 px-4 cursor-default">
                          <PendingChip count={student.submitted_logs} icon={FileText} color="bg-orange-50 text-orange-600" />
                        </td>
                        {/* Narratives */}
                        <td className="py-3.5 px-4 cursor-default">
                          <PendingChip count={student.submitted_narratives} icon={BookOpen} color="bg-rose-50 text-rose-600" />
                        </td>
                        {/* Status */}
                        <td className="py-3.5 px-4 cursor-default">
                          <StatusBadge completed={done} />
                        </td>
                        {/* Actions */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            {/* View Progress */}
                            <button
                              onClick={() => handleViewProgress(student.student_id)}
                              title="View Progress"
                              className="p-2 rounded-lg transition-colors"
                              style={{ color: `rgb(var(--primary-600))` }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {/* Edit Student */}
                            <button
                              onClick={() => setStudentModal({ mode: 'edit', student })}
                              title="Edit Student"
                              className="p-2 rounded-lg transition-colors"
                              style={{ color: `rgb(var(--primary-600))` }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {/* Assign / Change Company — kept semantic per original */}
                            <button
                              onClick={() => openAssignModal(student)}
                              disabled={loading}
                              title={hasCompany ? 'Change Company' : 'Assign Company'}
                              className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${hasCompany ? 'text-indigo-600 hover:bg-indigo-50' : 'text-blue-600 hover:bg-blue-50'}`}
                            >
                              <Building2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          {!loading && filtered.length > 0 && (
            <div
              className="px-6 py-3 flex items-center justify-between"
              style={{ borderTop: `1px solid rgb(var(--primary-50))`, backgroundColor: `rgb(var(--primary-50))` }}
            >
              <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>
                {filtered.length} student{filtered.length !== 1 ? 's' : ''} shown
              </p>
              <div className="flex items-center gap-4 text-xs" style={{ color: `rgb(var(--primary-500))` }}>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: `rgb(var(--primary-500))` }} />
                  Completed
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  On-Going
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Assign Company Modal ── */}
      {showModal && selectedStudent && (
        <AssignCompanyModal
          student={selectedStudent}
          companies={companies}
          loadingCompanies={loadingCompanies}
          selectedCompanyId={selectedCompanyId}
          onSelectCompany={setSelectedCompanyId}
          onSubmit={handleAssignSubmit}
          onClose={closeAssignModal}
          submitting={submitting}
        />
      )}

      {/* ── Student Add / Edit Modal ── */}
      {studentModal?.mode === 'add' && (
        <StudentModal
          mode="add"
          courses={courses}
          onClose={() => setStudentModal(null)}
          onSave={handleAddStudent}
        />
      )}
      {studentModal?.mode === 'edit' && (
        <StudentModal
          mode="edit"
          student={studentModal.student}
          courses={courses}
          onClose={() => setStudentModal(null)}
          onSave={handleEditStudent}
        />
      )}

      {/* ── Progress Modal ── */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-9998 p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl relative overflow-hidden">
            <div
              className="h-2 w-full"
              style={{ background: `linear-gradient(to right, rgb(var(--primary-700)), rgb(var(--primary-600)), rgb(var(--primary-500)))` }}
            />
            <button
              onClick={() => setShowProgressModal(false)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 z-10"
              style={{ backgroundColor: `rgb(var(--primary-50))`, color: `rgb(var(--primary-500))` }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-100))`; e.currentTarget.style.color = `rgb(var(--primary-700))`; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`; e.currentTarget.style.color = `rgb(var(--primary-500))`; }}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-8 overflow-y-auto max-h-[85vh]">
              {progressLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div
                    className="w-12 h-12 rounded-full animate-spin"
                    style={{ border: `4px solid rgb(var(--primary-100))`, borderTopColor: `rgb(var(--primary-600))` }}
                  />
                  <p className="text-sm tracking-wide" style={{ color: `rgb(var(--primary-500))` }}>Loading progress...</p>
                </div>
              ) : progressData ? (
                <>
                  <div className="flex items-start gap-4 mb-6">
                    <Avatar
                      name={`${progressData.student?.f_name} ${progressData.student?.l_name}`}
                      src={progressData.student?.photo}
                      size="lg"
                    />
                    <div>
                      <h2 className="text-2xl font-bold leading-tight" style={{ color: `rgb(var(--primary-800))` }}>
                        {progressData.student?.f_name} {progressData.student?.l_name}
                      </h2>
                      <p className="text-sm mt-0.5" style={{ color: `rgb(var(--primary-500))` }}>OJT Progress Overview</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { label: 'Course', value: progressData.student?.course ?? '—' },
                      { label: 'Company', value: progressData.student?.company ?? '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl px-5 py-4" style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: `rgb(var(--primary-400))` }}>{label}</p>
                        <p className="text-sm font-semibold truncate" style={{ color: `rgb(var(--primary-800))` }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  <div
                    className="rounded-xl px-5 py-5 mb-4"
                    style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), rgb(var(--primary-100)))`, border: `1px solid rgb(var(--primary-100))` }}
                  >
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
                      <div
                        className="h-2.5 rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min((progressData.hoursCompleted / progressData.student?.ojt_hours_required) * 100, 100)}%`,
                          background: `linear-gradient(to right, rgb(var(--primary-500)), rgb(var(--primary-400)))`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Days Attended', value: progressData.attendanceDays ?? 0 },
                      { label: 'Records', value: progressData.attendanceRecords ?? 0 },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white rounded-xl px-4 py-4 shadow-sm text-center" style={{ border: `1px solid rgb(var(--primary-100))` }}>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: `rgb(var(--primary-400))` }}>{label}</p>
                        <p className="text-2xl font-bold" style={{ color: `rgb(var(--primary-800))` }}>{value}</p>
                      </div>
                    ))}
                    <div className="bg-white rounded-xl px-4 py-4 shadow-sm text-center" style={{ border: `1px solid rgb(var(--primary-100))` }}>
                      <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: `rgb(var(--primary-400))` }}>Last Attendance</p>
                      <p className="text-sm font-semibold mt-1" style={{ color: `rgb(var(--primary-800))` }}>
                        {(() => {
                          const d = progressData?.lastAttendance ? new Date(progressData.lastAttendance) : null;
                          return d && !isNaN(d) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                        })()}
                      </p>
                    </div>
                  </div>

                  {progressData.recentAttendance?.some((rec) => rec?.date) && (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: `1px solid rgb(var(--primary-100))` }}>
                      <div className="px-5 py-3" style={{ borderBottom: `1px solid rgb(var(--primary-50))`, backgroundColor: `rgb(var(--primary-50))` }}>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: `rgb(var(--primary-600))` }}>Recent Attendance</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr style={{ backgroundColor: `rgb(var(--primary-50))` }}>
                              {['Date', 'Time In', 'Time Out', 'Hours'].map((col) => (
                                <th key={col} className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: `rgb(var(--primary-500))` }}>
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {progressData.recentAttendance.filter((rec) => rec?.date).map((rec, idx) => (
                              <tr
                                key={idx}
                                className="transition-colors duration-150"
                                style={{ borderTop: `1px solid rgb(var(--primary-50))` }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                              >
                                <td className="py-2.5 px-4 text-sm font-medium whitespace-nowrap cursor-default select-none" style={{ color: `rgb(var(--primary-800))` }}>
                                  {(() => {
                                    const date = rec?.date ? new Date(rec.date) : null;
                                    return date && !isNaN(date) ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                                  })()}
                                </td>
                                <td className="py-2.5 px-4 text-sm whitespace-nowrap cursor-default select-none" style={{ color: `rgb(var(--primary-700))` }}>{rec.time_in ?? '—'}</td>
                                <td className="py-2.5 px-4 text-sm whitespace-nowrap cursor-default select-none" style={{ color: `rgb(var(--primary-700))` }}>{rec.time_out ?? '—'}</td>
                                <td className="py-2.5 px-4 whitespace-nowrap cursor-default select-none">
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold"
                                    style={{ backgroundColor: `rgb(var(--primary-50))`, color: `rgb(var(--primary-700))`, border: `1px solid rgb(var(--primary-100))` }}
                                  >
                                    {rec.hours ?? '—'} hrs
                                  </span>
                                </td>
                              </tr>
                            ))}
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