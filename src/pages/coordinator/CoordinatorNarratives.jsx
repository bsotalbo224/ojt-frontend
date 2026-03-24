import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  AlertCircle,
  Clock,
  BookOpen,
  Users,
  ChevronRight,
} from 'lucide-react';
import { getCoordinatorNarratives } from '../../api/narrative';
import Avatar from "../../components/ui/Avatar";

const BASE_URL = import.meta.env.VITE_BASE_URL;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const resolveFullName = (n) => {
  if (n.student_name && n.student_name.trim()) return n.student_name.trim();
  const f = (n.f_name ?? '').trim();
  const l = (n.l_name ?? '').trim();
  const combined = [f, l].filter(Boolean).join(' ');
  return combined || 'Unknown Student';
};

const groupByStudent = (narratives) => {
  const map = {};
  narratives.forEach((n) => {
    const id = n.student_id;
    if (!map[id]) {
      map[id] = {
        student_id: id,
        full_name: resolveFullName(n),
        course: n.course ?? '',
        company: n.company ?? '',
        photo: n.photo ?? '',
        narratives: [],
      };
    }
    map[id].narratives.push(n);
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
        <p
          className="text-xs font-semibold uppercase tracking-wider mb-1"
          style={{ color: `rgb(var(--primary-500))` }}
        >
          {title}
        </p>
        {/* accent is a Tailwind class string — "Total Students" uses primary-800 inline below */}
        <p className={`text-3xl font-bold ${accent}`}>{loading ? '—' : value}</p>
      </div>
      <div
        className="p-3 rounded-lg"
        style={{ backgroundColor: `rgb(var(--primary-50))` }}
      >
        <Icon className="w-5 h-5" style={{ color: `rgb(var(--primary-600))` }} />
      </div>
    </div>
  </div>
);

const StudentCard = ({ student, onClick }) => {
  const { narratives, full_name } = student;
  const submitted = narratives.filter((n) => n.status === 'submitted').length;
  const approved  = narratives.filter((n) => n.status === 'approved').length;
  const revision  = narratives.filter((n) => n.status === 'revision').length;

  return (
    <div
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group"
      style={{ border: `1px solid rgb(var(--primary-50))` }}
      onMouseEnter={e => e.currentTarget.style.borderColor = `rgb(var(--primary-200))`}
      onMouseLeave={e => e.currentTarget.style.borderColor = `rgb(var(--primary-50))`}
    >
      {/* Header */}
      <div className="p-5 flex items-center gap-4">
        <Avatar
          name={student.full_name}
          src={student.photo ? `${BASE_URL}${student.photo}` : ""}
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

      {/* Stats — pending (amber) and revision (red) are semantic; approved uses primary vars */}
      <div className="px-5 pb-4 grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center bg-amber-50 border border-amber-100 rounded-lg py-2">
          <span className="text-lg font-bold text-amber-600">{submitted}</span>
          <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Pending</span>
        </div>
        <div
          className="flex flex-col items-center rounded-lg py-2"
          style={{
            backgroundColor: `rgb(var(--primary-50))`,
            border: `1px solid rgb(var(--primary-100))`,
          }}
        >
          <span className="text-lg font-bold" style={{ color: `rgb(var(--primary-600))` }}>{approved}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--primary-500))` }}>Approved</span>
        </div>
        <div className="flex flex-col items-center bg-red-50 border border-red-100 rounded-lg py-2">
          <span className="text-lg font-bold text-red-500">{revision}</span>
          <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wide">Revision</span>
        </div>
      </div>

      {/* Total */}
      <div className="px-5 pb-3">
        <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>
          <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>
            {narratives.length}
          </span>{' '}
          narrative{narratives.length !== 1 ? 's' : ''} submitted
        </p>
      </div>

      {/* Action */}
      <div className="mt-auto px-5 pb-5">
        <button
          onClick={onClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-lg active:scale-[0.98] transition-all duration-150 shadow-sm group-hover:shadow-md"
          style={{ backgroundColor: `rgb(var(--primary-600))` }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}
        >
          <BookOpen className="w-4 h-4" />
          View Narratives
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
        <div className="h-3 rounded w-1/2"   style={{ backgroundColor: `rgb(var(--primary-50))` }} />
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

const EmptyState = ({ hasFilter }) => (
  <div className="col-span-full py-20 flex flex-col items-center gap-3 text-center">
    <div
      className="w-16 h-16 rounded-full flex items-center justify-center"
      style={{ backgroundColor: `rgb(var(--primary-50))` }}
    >
      <FileText className="w-8 h-8" style={{ color: `rgb(var(--primary-300))` }} />
    </div>
    <p className="text-base font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
      {hasFilter ? 'No matching students' : 'No narrative submissions yet'}
    </p>
    <p className="text-sm max-w-xs" style={{ color: `rgb(var(--primary-500))` }}>
      {hasFilter ? 'Try adjusting your search or filter.' : 'Student submissions will appear here once submitted.'}
    </p>
  </div>
);

/* ErrorState — red is semantic, keep as Tailwind */
const ErrorState = () => (
  <div className="col-span-full py-20 flex flex-col items-center gap-3 text-center">
    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
      <AlertCircle className="w-8 h-8 text-red-300" />
    </div>
    <p className="text-base font-semibold text-red-700">Failed to load narratives</p>
    <p className="text-sm text-red-400">Please refresh the page or try again later.</p>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const CoordinatorNarratives = () => {
  const navigate = useNavigate();
  const [narratives, setNarratives] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    getCoordinatorNarratives()
      .then((data) => setNarratives(data ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const students = useMemo(() => groupByStudent(narratives), [narratives]);

  const stats = useMemo(() => ({
    totalStudents: students.length,
    submitted: narratives.filter((n) => n.status === 'submitted').length,
    revision:  narratives.filter((n) => n.status === 'revision').length,
  }), [students, narratives]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const name   = s.full_name.toLowerCase();
      const course = (s.course ?? "").toLowerCase();
      return name.includes(q) || course.includes(q);
    });
  }, [students, searchQuery]);

  const hasFilter = searchQuery.trim() !== '';

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
              Narrative Reports
            </h1>
            <p className="mt-1 text-sm" style={{ color: `rgb(var(--primary-500))` }}>
              Review and manage student narrative reports
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
          {/* Total — value colour via inline style */}
          <div
            className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow duration-200"
            style={{ border: `1px solid rgb(var(--primary-50))` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: `rgb(var(--primary-500))` }}>
                  Total Students
                </p>
                <p className="text-3xl font-bold" style={{ color: `rgb(var(--primary-800))` }}>
                  {loading ? '—' : stats.totalStudents}
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: `rgb(var(--primary-50))` }}>
                <Users className="w-5 h-5" style={{ color: `rgb(var(--primary-600))` }} />
              </div>
            </div>
          </div>
          {/* Pending Review — amber is semantic */}
          <SummaryCard title="Pending Review" value={stats.submitted} icon={Clock}        accent="text-amber-600" loading={loading} />
          {/* For Revision — red is semantic */}
          <SummaryCard title="For Revision"   value={stats.revision}  icon={AlertCircle}  accent="text-red-500"   loading={loading} />
        </div>

        {/* Toolbar */}
        <div
          className="bg-white rounded-2xl shadow-sm px-6 py-4"
          style={{ border: `1px solid rgb(var(--primary-50))` }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <h2 className="text-lg font-bold" style={{ color: `rgb(var(--primary-800))` }}>
              Student Submissions
            </h2>
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
                className="pl-9 pr-4 py-2 text-sm rounded-lg w-72 transition outline-none"
                style={{
                  border:          `1px solid rgb(var(--primary-200))`,
                  backgroundColor: `rgb(var(--primary-50) / 0.4)`,
                  color:           `rgb(var(--primary-800))`,
                }}
                onFocus={e => {
                  e.target.style.boxShadow  = `0 0 0 2px rgb(var(--primary-300))`;
                  e.target.style.borderColor = `rgb(var(--primary-300))`;
                }}
                onBlur={e => {
                  e.target.style.boxShadow  = 'none';
                  e.target.style.borderColor = `rgb(var(--primary-200))`;
                }}
              />
            </div>
          </div>
          {hasFilter && !loading && (
            <p className="text-xs mt-2" style={{ color: `rgb(var(--primary-500))` }}>
              Showing{' '}
              <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>
                {filteredStudents.length}
              </span>{' '}
              of {students.length} students
            </p>
          )}
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                onClick={() => navigate(`/coordinator/narratives/${student.student_id}`)}
              />
            ))
          )}
        </div>

      </div>
    </div>
  );
};

export default CoordinatorNarratives;