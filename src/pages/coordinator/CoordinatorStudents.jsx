import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Users, CheckCircle, Clock, AlertCircle, TrendingUp, Plus,
} from 'lucide-react';
import { getCoordinatorStudents, assignCompany, getStudentProgress } from '../../api/students';
import { getCompanies } from '../../api/companies';
import apiClient from '../../api/axios';
import {
  toTimeInput,
  toTimeStorage,
} from '../../utils/attendanceUtils';
import AssignCompanyModal from '../../components/coordinator/students/AssignCompanyModal';
import StudentModal from '../../components/coordinator/students/StudentModal';
import ProgressModal from '../../components/coordinator/students/ProgressModal';
import SummaryCard from '../../components/coordinator/students/SummaryCard';
import StudentTable from '../../components/coordinator/students/StudentTable';

const DEFAULT_START = '08:30';
const DEFAULT_END   = '17:00';

const studentsApi = {
  getCourses:       async ()            => (await apiClient.get('/courses')).data,
  getRequiredHours: async ()            => (await apiClient.get('/required-hours')).data,
  createStudent:    async (payload)     => (await apiClient.post('/student', payload)).data,
  updateStudent:    async (id, payload) => (await apiClient.put(`/student/${id}`, payload)).data,
};

const isCompleted = (s) => s.hours_completed >= s.ojt_hours_required;

const Toast = ({ message, visible }) => (
  <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 text-white text-sm font-medium rounded-xl shadow-xl transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
    style={{ backgroundColor: `rgb(var(--primary-700))` }}>
    <CheckCircle className="w-4 h-4 shrink-0" style={{ color: `rgb(var(--primary-300))` }} />
    {message}
  </div>
);

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

  const toastTimeoutRef = useRef(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCoordinatorStudents();
      setStudents(data ?? []);
    } catch (err) {
      console.error('Failed to load students:', err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();

    studentsApi.getCourses().then((d) => setCourses(d ?? [])).catch(console.error);
    studentsApi.getRequiredHours().then((d) => setRequiredHoursOptions(Array.isArray(d) ? d : [])).catch(console.error);

    const handleAcademicYearChanged = () => {
      loadStudents();
    };

    window.addEventListener('academicYearChanged', handleAcademicYearChanged);

    return () => {
      window.removeEventListener('academicYearChanged', handleAcademicYearChanged);
    };
  }, [loadStudents]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const stats = useMemo(() => {
    const total = students.length, completed = students.filter(isCompleted).length;
    return { total, completed, ongoing: total - completed, withPending: students.filter((s) => s.submitted_logs > 0 || s.submitted_narratives > 0).length };
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const name = `${s.f_name} ${s.l_name}`.toLowerCase();
      const company = String(s.company || '').toLowerCase();
      const course = String(s.course || '').toLowerCase();
      const ok  = !q || name.includes(q) || company.includes(q) || course.includes(q);
      const okF = filter === 'all' || (filter === 'completed' && isCompleted(s)) || (filter === 'ongoing' && !isCompleted(s));
      return ok && okF;
    });
  }, [students, search, filter]);

  const showToast = (msg) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ visible: true, message: msg });
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ visible: false, message: '' });
      toastTimeoutRef.current = null;
    }, 3000);
  };

  const openAssignModal = async (student) => {
    setSelectedStudent(student);
    setSelectedCompanyId('');
    setScheduleStart(toTimeInput(student.start_time) || DEFAULT_START);
    setScheduleEnd(toTimeInput(student.end_time)     || DEFAULT_END);
    setShowModal(true); setLoadingCompanies(true);
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
    setProgressData(null);
    setProgressLoading(true);
    setShowProgressModal(true);
    try {
      setProgressData(await getStudentProgress(studentId));
    } catch (err) {
      console.error('Failed to fetch progress:', err);
      setShowProgressModal(false);
      showToast('Failed to fetch student progress');
    } finally {
      setProgressLoading(false);
    }
  };

  const closeProgressModal = () => {
    setShowProgressModal(false);
  };

  const handleAddStudent = async (form) => {
    await studentsApi.createStudent(form);
    await loadStudents();
    setStudentModal(null);
    showToast(`Student ${form.f_name} ${form.l_name} created`);
  };

  const handleEditStudent = async (form) => {
    await studentsApi.updateStudent(studentModal.student.student_id, form);
    await loadStudents();
    setStudentModal(null);
    showToast(`${form.f_name} ${form.l_name} updated successfully`);
  };

  return (
    <div className="min-h-screen p-6" style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), white)` }}>
      <div className="max-w-350 mx-auto space-y-6">

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Total Students"      value={loading ? '—' : stats.total}      icon={Users}        usePrimary />
          <SummaryCard title="Completed"           value={loading ? '—' : stats.completed}  icon={CheckCircle}  usePrimary
            subtext={!loading && stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}% of total` : null} />
          <SummaryCard title="On-Going"            value={loading ? '—' : stats.ongoing}    icon={Clock}        colorClass="text-amber-600" />
          <SummaryCard title="Pending Submissions" value={loading ? '—' : stats.withPending} icon={AlertCircle} colorClass="text-orange-600" subtext="Students with pending items" />
        </div>

        <StudentTable
          students={students}
          filtered={filtered}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={setFilter}
          isCompleted={isCompleted}
          onViewProgress={handleViewProgress}
          onEditStudent={(student) => setStudentModal({ mode: 'edit', student })}
          onAssignCompany={openAssignModal}
        />
      </div>

      {showModal && selectedStudent && (
        <AssignCompanyModal
          student={selectedStudent} companies={companies} loadingCompanies={loadingCompanies}
          selectedCompanyId={selectedCompanyId} onSelectCompany={setSelectedCompanyId}
          startTime={scheduleStart} endTime={scheduleEnd}
          onStartTime={setScheduleStart} onEndTime={setScheduleEnd}
          onSubmit={handleAssignSubmit} onClose={closeAssignModal} submitting={submitting}
        />
      )}

      {studentModal?.mode === 'add' && (
        <StudentModal mode="add" courses={courses} requiredHoursOptions={requiredHoursOptions} onClose={() => setStudentModal(null)} onSave={handleAddStudent} />
      )}
      {studentModal?.mode === 'edit' && (
        <StudentModal mode="edit" student={studentModal.student} courses={courses} requiredHoursOptions={requiredHoursOptions} onClose={() => setStudentModal(null)} onSave={handleEditStudent} />
      )}

      {showProgressModal && (
        <ProgressModal
          progressData={progressData}
          progressLoading={progressLoading}
          onClose={closeProgressModal}
        />
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