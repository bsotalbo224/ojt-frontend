import { useEffect, useState } from 'react';
import {
  GraduationCap, Plus, Search, Edit2, Power,
  X, Loader2, AlertCircle, ChevronDown, Mail, Clock,
  BookOpen, Users, CheckCircle, Filter, Archive,
} from 'lucide-react';
import apiClient from "../../api/axios";
import AdminArchivedStudents from "../admin/AdminArchiveStudents";

// ─── API helpers ──────────────────────────────────────────────────────────────

const api = {
  getStudents: async () => {
    const res = await apiClient.get("/student");
    return res.data;
  },

  getCourses: async () => {
    const res = await apiClient.get("/courses");
    return res.data;
  },

  getRequiredHours: async () => {
    const res = await apiClient.get("/required-hours");
    return res.data;
  },

  createStudent: async (payload) => {
    const res = await apiClient.post("/student", payload);
    return res.data;
  },

  updateStudent: async (id, payload) => {
    const res = await apiClient.put(`/student/${id}`, payload);
    return res.data;
  },

  toggleStatus: async (id, is_active) => {
    const res = await apiClient.patch(`/student/${id}/status`, { is_active });
    return res.data;
  },
};

const EMPTY_FORM = {
  f_name: '',
  l_name: '',
  email: '',
  course_id: '',
  ojt_hours_required: '',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const AvatarCircle = ({ name }) => {
  const initials =
    name
      ?.split(' ')
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join('') ?? '?';
  return (
    <div className="w-9 h-9 rounded-full bg-linear-to-br from-green-400 to-green-600 flex items-center justify-center shrink-0 shadow-sm">
      <span className="text-white text-sm font-bold">{initials}</span>
    </div>
  );
};

const StatusBadge = ({ active }) =>
  active ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
      <CheckCircle className="w-3 h-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
      <AlertCircle className="w-3 h-3" /> Inactive
    </span>
  );

const InputField = ({ label, id, error, className = '', ...props }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <label htmlFor={id} className="text-xs font-semibold text-green-700 uppercase tracking-wide">
      {label}
    </label>
    <input
      id={id}
      className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-green-900 placeholder-green-300 bg-white transition-all duration-150 outline-none
        ${error
          ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
          : 'border-green-200 focus:border-green-400 focus:ring-2 focus:ring-green-100'
        }`}
      {...props}
    />
    {error && (
      <p className="text-xs text-red-500 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {error}
      </p>
    )}
  </div>
);

const SelectField = ({ label, id, error, children, className = '', ...props }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <label htmlFor={id} className="text-xs font-semibold text-green-700 uppercase tracking-wide">
      {label}
    </label>
    <div className="relative">
      <select
        id={id}
        className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-green-900 bg-white appearance-none transition-all duration-150 outline-none pr-9
          ${error
            ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
            : 'border-green-200 focus:border-green-400 focus:ring-2 focus:ring-green-100'
          }`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none" />
    </div>
    {error && (
      <p className="text-xs text-red-500 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {error}
      </p>
    )}
  </div>
);

// ─── Confirm Toggle Modal ─────────────────────────────────────────────────────

const ConfirmModal = ({ student, onConfirm, onCancel, loading }) => {
  const isDeactivating = student?.is_active;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeUp_0.2s_ease]">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${isDeactivating ? 'bg-red-50' : 'bg-green-50'}`}>
          {isDeactivating
            ? <Power className="w-7 h-7 text-red-500" />
            : <Power className="w-7 h-7 text-green-500" />}
        </div>
        <h3 className="text-lg font-bold text-green-900 text-center mb-1">
          {isDeactivating ? 'Deactivate Student' : 'Activate Student'}
        </h3>
        <p className="text-sm text-green-600 text-center mb-6">
          Are you sure you want to {isDeactivating ? 'deactivate' : 'activate'}{' '}
          <span className="font-semibold text-green-800">
            {student?.f_name} {student?.l_name}
          </span>
          ?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-all flex items-center justify-center gap-2
              ${isDeactivating
                ? 'bg-red-500 hover:bg-red-600 disabled:bg-red-300'
                : 'bg-green-600 hover:bg-green-700 disabled:bg-green-300'
              }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isDeactivating ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

const StudentModal = ({ mode, student, courses, requiredHoursOptions, onClose, onSave }) => {
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

  useEffect(() => {
    if (!form.course_id || courses.length === 0) return;
    const matched = courses.find((c) => String(c.course_id) === String(form.course_id));
    if (matched?.required_hours && !form.ojt_hours_required) {
      setForm((f) => ({ ...f, ojt_hours_required: matched.required_hours }));
    }
  }, [form.course_id, courses]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCourseDefault = (() => {
    if (!form.course_id || courses.length === 0) return null;
    const matched = courses.find((c) => String(c.course_id) === String(form.course_id));
    return matched?.required_hours ?? null;
  })();

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-[fadeUp_0.2s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-green-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              {isEdit ? <Edit2 className="w-5 h-5 text-green-600" /> : <Plus className="w-5 h-5 text-green-600" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-green-900">
                {isEdit ? 'Edit Student' : 'Add New Student'}
              </h2>
              <p className="text-xs text-green-500">
                {isEdit ? 'Update student information' : 'Create a new student account'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-green-50 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-green-500" />
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
            <InputField label="First Name" id="f_name" placeholder="First Name" value={form.f_name} onChange={set('f_name')} error={errors.f_name} />
            <InputField label="Last Name" id="l_name" placeholder="Last Name" value={form.l_name} onChange={set('l_name')} error={errors.l_name} />
          </div>
          <InputField label="Email Address" id="email" type="email" placeholder="Email" value={form.email} onChange={set('email')} error={errors.email} />
          <SelectField label="Course" id="course" value={form.course_id} onChange={set('course_id')} error={errors.course_id}>
            <option value="">Select a course…</option>
            {courses.map((c) => (
              <option key={c.course_id} value={c.course_id}>{c.course_name}</option>
            ))}
          </SelectField>
          <SelectField label="Required OJT Hours" id="ojt_hours_required" value={form.ojt_hours_required} onChange={set('ojt_hours_required')} error={errors.ojt_hours_required}>
            {requiredHoursOptions.length === 0 ? (
              <option value="" disabled>No options available</option>
            ) : (
              <>
                <option value="">Select required hours…</option>
                {selectedCourseDefault && (
                  <option value={selectedCourseDefault}>
                    Use Course Default ({selectedCourseDefault} hrs)
                  </option>
                )}
                {requiredHoursOptions
                  .filter((opt) => String(opt.hours) !== String(selectedCourseDefault))
                  .map((opt) => (
                    <option key={opt.id} value={opt.hours}>
                      {opt.hours} hours
                    </option>
                  ))}
              </>
            )}
          </SelectField>
          <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
            <AlertCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
            <p className="text-xs text-green-600 leading-relaxed">
              Login credentials will be automatically generated and sent to the student's email.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-green-50 bg-green-50/30 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-sm font-semibold transition-all flex items-center gap-2 shadow-sm"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Student'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = ({ filtered }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-3">
    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
      <GraduationCap className="w-8 h-8 text-green-300" />
    </div>
    <p className="text-base font-semibold text-green-800">
      {filtered ? 'No students match your search' : 'No students yet'}
    </p>
    <p className="text-sm text-green-400">
      {filtered ? 'Try a different name, email, or course.' : 'Add your first student using the button above.'}
    </p>
  </div>
);

// ─── Tab Navigation ───────────────────────────────────────────────────────────

const TAB_ACTIVE = 'active';
const TAB_ARCHIVED = 'archived';

const TabNav = ({ activeTab, onChange, isAdmin }) => {
  const tabs = [
    { id: TAB_ACTIVE, label: 'Active Students', icon: GraduationCap },
    ...(isAdmin ? [{ id: TAB_ARCHIVED, label: 'Archived Students', icon: Archive }] : []),
  ];

  return (
    <div className="flex flex-col gap-1.5 mb-6">
      <div className="inline-flex items-center bg-green-100/70 rounded-xl p-1 gap-1 self-start border border-green-200/60 shadow-inner shadow-green-200/30">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`
                inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                transition-all duration-200 whitespace-nowrap select-none
                ${isActive
                  ? 'bg-white text-green-800 shadow-sm shadow-green-200/60 border border-green-100'
                  : 'text-green-600 hover:text-green-800 hover:bg-white/50'
                }
              `}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-green-600' : 'text-green-400'}`} />
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === TAB_ACTIVE && isAdmin && (
        <p className="text-xs text-green-400 flex items-center gap-1.5 pl-1">
          <Archive className="w-3 h-3 shrink-0" />
          Students inactive for 180 days are automatically moved to the archive.
        </p>
      )}
    </div>
  );
};

// ─── Success Toast ────────────────────────────────────────────────────────────

const SuccessToast = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div
      className="
        mb-5 flex items-center justify-between gap-3
        px-4 py-3 rounded-xl
        bg-green-50 border border-green-200
        shadow-sm shadow-green-100
        animate-[fadeUp_0.25s_ease]
      "
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-4 h-4 text-green-600" />
        </span>
        <p className="text-sm font-medium text-green-800">{message}</p>
      </div>

      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-green-400 hover:text-green-600 hover:bg-green-100 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const AdminStudents = ({ isAdmin = true }) => {
  // ── Tab state ──
  const [activeTab, setActiveTab] = useState(TAB_ACTIVE);

  // ── Student / course state ──
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [modal, setModal] = useState(null);
  const [confirmStudent, setConfirmStudent] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [courses, setCourses] = useState([]);

  // ── Required hours state ──
  const [requiredHoursOptions, setRequiredHoursOptions] = useState([]);

  // ── Success notification state ──
  const [successMessage, setSuccessMessage] = useState('');

  // ── Fetch ──
  const fetchStudents = async () => {
    setLoading(true);
    try {
      setError('');
      const data = await api.getStudents();
      setStudents(data);
    } catch {
      setError('Failed to load students. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const data = await api.getCourses();
      setCourses(data);
    } catch {
      console.error('Failed to load courses');
    }
  };

  const fetchRequiredHours = async () => {
    try {
      const res = await apiClient.get("/required-hours");
      const data = res.data?.data ?? res.data ?? [];
      setRequiredHoursOptions(data);
    } catch (err) {
      console.error("Failed to load required hours:", err);
      setRequiredHoursOptions([]);
    }
  };

  // ── Mount: load all data once ──
  useEffect(() => {
    fetchStudents();
    fetchCourses();
    fetchRequiredHours();
  }, []);

  // ── Academic year change: re-fetch students only ──
  useEffect(() => {
    const handleAcademicYearChanged = () => {
      fetchStudents();
    };
    window.addEventListener("academicYearChanged", handleAcademicYearChanged);
    return () => {
      window.removeEventListener("academicYearChanged", handleAcademicYearChanged);
    };
  }, []);

  // ── Auto-dismiss success message after 3 s ──
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // ── Derived ──
  const filtered = students.filter((s) => {
    const name = `${s.f_name} ${s.l_name}`.toLowerCase();
    const term = search.toLowerCase();

    const matchSearch =
      !search ||
      name.includes(term) ||
      s.email?.toLowerCase().includes(term) ||
      s.course_code?.toLowerCase().includes(term) ||
      s.course_name?.toLowerCase().includes(term);

    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && s.is_active) ||
      (filterStatus === 'inactive' && !s.is_active);

    return matchSearch && matchStatus;
  });

  const totalActive = students.filter((s) => s.is_active).length;
  const totalInactive = students.filter((s) => !s.is_active).length;

  // ── Handlers ──
  const handleAdd = async (form) => {
    await api.createStudent({
      f_name: form.f_name,
      l_name: form.l_name,
      email: form.email,
      course_id: form.course_id,
      ojt_hours_required: form.ojt_hours_required,
    });

    const updatedStudents = await api.getStudents();
    setStudents(updatedStudents);

    setModal(null);
    setSuccessMessage(`Student ${form.f_name} ${form.l_name} added successfully`);
  };

  const handleEdit = async (form) => {
    await api.updateStudent(modal.student.student_id, {
      f_name: form.f_name,
      l_name: form.l_name,
      email: form.email,
      course_id: form.course_id,
      ojt_hours_required: form.ojt_hours_required,
    });

    const updatedStudents = await api.getStudents();
    setStudents(updatedStudents);

    setModal(null);
  };

  const handleToggleStatus = async () => {
    if (!confirmStudent) return;
    setStatusLoading(true);
    try {
      const updated = await api.toggleStatus(confirmStudent.student_id, !confirmStudent.is_active);
      setStudents((prev) =>
        prev.map((s) => (s.student_id === updated.student_id ? updated : s))
      );
      setConfirmStudent(null);
    } catch {
      // keep confirm open
    } finally {
      setStatusLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="min-h-screen bg-linear-to-br from-green-50 to-white p-6">
        <div className="max-w-7xl mx-auto">

          {/* ── Page Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-green-800">Students Management</h1>
              <p className="text-green-600 mt-1">Manage student accounts and OJT records</p>
            </div>

            {activeTab === TAB_ACTIVE && (
              <button
                onClick={() => setModal({ mode: 'add' })}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-semibold text-sm rounded-xl shadow-md transition-all duration-150 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add Student
              </button>
            )}
          </div>

          {/* ── Tab Navigation ── */}
          <TabNav activeTab={activeTab} onChange={setActiveTab} isAdmin={isAdmin} />

          {/* ── Success Toast — shown above tab content ── */}
          <SuccessToast
            message={successMessage}
            onClose={() => setSuccessMessage('')}
          />

          {/* ══════════════════════════════════════════════════════════════════
              TAB: ACTIVE STUDENTS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === TAB_ACTIVE && (
            <>
              {/* ── Stat Cards ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Total Students', value: students.length, icon: Users, color: 'text-green-600 bg-green-100' },
                  { label: 'Active', value: totalActive, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-100' },
                  { label: 'Inactive', value: totalInactive, icon: AlertCircle, color: 'text-gray-600 bg-gray-100' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div
                    key={label}
                    className="bg-white rounded-xl shadow-sm border border-green-50 px-5 py-4 flex items-center gap-4"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-green-500 font-medium">{label}</p>
                      {loading
                        ? <div className="h-6 w-10 bg-green-100 rounded animate-pulse mt-1" />
                        : <p className="text-2xl font-bold text-green-800">{value}</p>
                      }
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Table Card ── */}
              <div className="bg-white rounded-2xl shadow-md border border-green-50 overflow-hidden">

                {/* Toolbar */}
                <div className="px-6 pt-5 pb-4 border-b border-green-50 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                  <h2 className="text-lg font-bold text-green-800 shrink-0">All Students</h2>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                      <input
                        type="text"
                        placeholder="Search name, email, course…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 rounded-lg border border-green-200 text-sm text-green-800 placeholder-green-300 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 w-full sm:w-64 transition-all"
                      />
                    </div>
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="pl-9 pr-8 py-2 rounded-lg border border-green-200 text-sm text-green-800 bg-white focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 appearance-none transition-all"
                      >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Table body */}
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-24 gap-3">
                      <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                      <p className="text-sm text-green-500">Loading students…</p>
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <AlertCircle className="w-10 h-10 text-red-400" />
                      <p className="text-sm text-red-500">{error}</p>
                      <button
                        onClick={fetchStudents}
                        className="text-sm text-green-600 font-semibold underline underline-offset-2"
                      >
                        Try again
                      </button>
                    </div>
                  ) : filtered.length === 0 ? (
                    <EmptyState filtered={!!search || filterStatus !== 'all'} />
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-green-50/60">
                          {['Name', 'Email', 'Course', 'Required Hours', 'Status', 'Actions'].map((col) => (
                            <th
                              key={col}
                              className="text-left py-3 px-4 text-xs font-semibold text-green-600 uppercase tracking-wider whitespace-nowrap"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((student) => (
                          <tr
                            key={student.student_id}
                            className="border-b border-green-50 hover:bg-green-50/40 transition-colors duration-150 group"
                          >
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <AvatarCircle name={`${student.f_name} ${student.l_name}`} />
                                <span className="text-sm font-semibold text-green-900 whitespace-nowrap">
                                  {student.f_name} {student.l_name}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 text-sm text-green-600">
                                <Mail className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                <span className="truncate max-w-48">{student.email}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 text-sm text-green-700">
                                <BookOpen className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                <span className="truncate max-w-44">
                                  {student.course_code ? `${student.course_code}` : student.course_name ?? '—'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 text-sm text-green-700 whitespace-nowrap">
                                <Clock className="w-3.5 h-3.5 text-green-400" />
                                {student.ojt_hours_required ? `${student.ojt_hours_required} hrs` : '—'}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <StatusBadge active={student.is_active} />
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setModal({ mode: 'edit', student })}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setConfirmStudent(student)}
                                  className={`p-2 rounded-lg transition-colors ${student.is_active
                                    ? 'text-gray-600 hover:bg-gray-100'
                                    : 'text-green-600 hover:bg-green-50'
                                    }`}
                                  title={student.is_active ? 'Disable' : 'Enable'}
                                >
                                  <Power className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Footer */}
                {!loading && !error && filtered.length > 0 && (
                  <div className="px-6 py-3 border-t border-green-50 bg-green-50/30 flex items-center justify-between">
                    <p className="text-xs text-green-500">
                      Showing {filtered.length} of {students.length} student{students.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-green-500">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Active
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Inactive
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: ARCHIVED STUDENTS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === TAB_ARCHIVED && isAdmin && (
            <div className="-mx-6 -mb-6">
              <AdminArchivedStudents />
            </div>
          )}

        </div>
      </div>

      {/* ── Modals ── */}
      {modal?.mode === 'add' && (
        <StudentModal
          mode="add"
          courses={courses}
          requiredHoursOptions={requiredHoursOptions}
          onClose={() => setModal(null)}
          onSave={handleAdd}
        />
      )}
      {modal?.mode === 'edit' && (
        <StudentModal
          mode="edit"
          student={modal.student}
          courses={courses}
          requiredHoursOptions={requiredHoursOptions}
          onClose={() => setModal(null)}
          onSave={handleEdit}
        />
      )}
      {confirmStudent && (
        <ConfirmModal
          student={confirmStudent}
          onConfirm={handleToggleStatus}
          onCancel={() => setConfirmStudent(null)}
          loading={statusLoading}
        />
      )}
    </>
  );
};

export default AdminStudents;