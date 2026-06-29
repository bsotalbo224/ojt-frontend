import { useEffect, useState, useMemo, useCallback } from 'react';
import { AlertCircle, Plus, Edit2, ChevronDown, X, Loader2 } from 'lucide-react';

const EMPTY_FORM = { f_name: '', l_name: '', email: '', course_id: '', ojt_hours_required: '' };

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

const StudentModal = ({ mode, student, courses, requiredHoursOptions, onClose, onSave }) => {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(
    isEdit
      ? { f_name: student.f_name ?? '', l_name: student.l_name ?? '', email: student.email ?? '',
          course_id: student.course_id != null ? String(student.course_id) : '',
          ojt_hours_required: student.ojt_hours_required != null ? String(student.ojt_hours_required) : '' }
      : { ...EMPTY_FORM }
  );
  const [hasManualHoursOverride, setHasManualHoursOverride] = useState(isEdit);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  const clearFieldError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    clearFieldError(field);
    setApiError('');
  };

  const selectedCourse = useMemo(
    () => courses.find((c) => String(c.course_id) === String(form.course_id)) ?? null,
    [courses, form.course_id]
  );

  const selectedCourseDefault = useMemo(
    () => (selectedCourse?.required_hours != null ? String(selectedCourse.required_hours) : null),
    [selectedCourse]
  );

  useEffect(() => {
    if (hasManualHoursOverride) return;
    if (!selectedCourseDefault) return;
    setForm((f) => ({ ...f, ojt_hours_required: selectedCourseDefault }));
  }, [selectedCourseDefault, hasManualHoursOverride]);

  const handleCourseChange = (e) => {
    const id = e.target.value;
    setForm((f) => ({ ...f, course_id: id }));
    clearFieldError('course_id');
    setApiError('');
  };

  const handleHoursChange = (e) => {
    setHasManualHoursOverride(true);
    setForm((f) => ({ ...f, ojt_hours_required: e.target.value }));
    clearFieldError('ojt_hours_required');
    setApiError('');
  };

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

  const handleSubmit = useCallback(async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiError('');
    try { await onSave(form); }
    catch (err) { setApiError(err?.message ?? 'Something went wrong.'); }
    finally { setSaving(false); }
  }, [form, onSave]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        const tag = e.target.tagName;
        if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
        e.preventDefault();
        if (!saving) handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleSubmit, saving]);

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
          <button type="button" onClick={onClose} aria-label="Close" title="Close" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ color: `rgb(var(--primary-500))` }}
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
            onChange={handleHoursChange} error={errors.ojt_hours_required}>
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
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{ border: `1px solid rgb(var(--primary-200))`, color: `rgb(var(--primary-700))` }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
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

export default StudentModal;