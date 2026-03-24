import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  X,
  Loader2,
  InboxIcon,
  User,
  ChevronRight,
  CheckCircle,
  RefreshCcw,
  Clock,
} from 'lucide-react';
import { getCoordinatorLogs } from '../../api/logs';
import Avatar from "../../components/ui/Avatar";

const BASE_URL = import.meta.env.VITE_BASE_URL;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const groupByStudent = (logs) => {
  const map = {};
  logs.forEach((log) => {
    const id = log.student_id;
    if (!map[id]) {
      map[id] = {
        student_id: id,
        f_name: log.f_name,
        l_name: log.l_name,
        course: log.course || log.course_code,
        photo: log.photo,
        logs: [],
      };
    }
    map[id].logs.push(log);
  });
  return Object.values(map);
};

const countByStatus = (logs, status) =>
  logs.filter((l) => l.status?.toLowerCase() === status).length;

// ─── StatBox ──────────────────────────────────────────────────────────────────
// "Approved" uses primary vars; "Pending" (yellow) and "Revision" (red) are
// semantic states — kept as Tailwind class strings.

const StatBox = ({ icon: Icon, label, value, color, usePrimary }) => {
  if (usePrimary) {
    return (
      <div
        className="flex flex-col items-center justify-center p-2 rounded-xl border min-w-15"
        style={{
          borderColor:     `rgb(var(--primary-200))`,
          backgroundColor: `rgb(var(--primary-50))`,
          color:           `rgb(var(--primary-700))`,
        }}
      >
        <Icon className="w-3.5 h-3.5 mb-0.5 opacity-70" />
        <span className="text-lg font-bold leading-none">{value}</span>
        <span className="text-[10px] mt-0.5 font-medium uppercase tracking-wide opacity-70">{label}</span>
      </div>
    );
  }
  return (
    <div className={`flex flex-col items-center justify-center p-2 rounded-xl border ${color} min-w-15`}>
      <Icon className="w-3.5 h-3.5 mb-0.5 opacity-70" />
      <span className="text-lg font-bold leading-none">{value}</span>
      <span className="text-[10px] mt-0.5 font-medium uppercase tracking-wide opacity-70">{label}</span>
    </div>
  );
};

// ─── StudentCard ──────────────────────────────────────────────────────────────

const StudentCard = ({ student, onView }) => {
  const submitted = countByStatus(student.logs, 'submitted');
  const approved  = countByStatus(student.logs, 'approved');
  const revision  = countByStatus(student.logs, 'revision');

  return (
    <div
      className="group bg-white rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col"
      style={{ border: `1px solid rgb(var(--primary-100))` }}
    >
      {/* Card top accent */}
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(to right, rgb(var(--primary-400)), rgb(var(--primary-500)))` }}
      />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Identity */}
        <div className="flex items-center gap-3">
          <Avatar
            name={`${student.f_name ?? ""} ${student.l_name ?? ""}`}
            src={student.photo ? `${BASE_URL}${student.photo}` : ""}
            size="md"
          />
          <div className="min-w-0">
            <p
              className="text-sm font-bold truncate"
              style={{ color: `rgb(var(--primary-800))` }}
            >
              {student.f_name} {student.l_name}
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: `rgb(var(--primary-500))` }}
            >
              {student.course ?? "—"}
            </p>
          </div>
          {/* Log count badge */}
          <div className="ml-auto shrink-0">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: `rgb(var(--primary-50))`,
                border:          `1px solid rgb(var(--primary-200))`,
                color:           `rgb(var(--primary-700))`,
              }}
            >
              <FileText className="w-3 h-3" />
              {student.logs.length}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-2">
          {/* Pending — yellow (semantic) */}
          <StatBox icon={Clock}        label="Pending"  value={submitted} color="border-yellow-200 bg-yellow-50 text-yellow-700" />
          {/* Approved — primary themed */}
          <StatBox icon={CheckCircle}  label="Approved" value={approved}  usePrimary />
          {/* Revision — red (semantic) */}
          <StatBox icon={RefreshCcw}   label="Revision" value={revision}  color="border-red-200 bg-red-50 text-red-600" />
        </div>

        {/* Action */}
        <button
          onClick={() => onView(student.student_id)}
          className="mt-auto w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors duration-150 group-hover:shadow-sm"
          style={{ backgroundColor: `rgb(var(--primary-600))` }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}
          onMouseDown={e =>  e.currentTarget.style.backgroundColor = `rgb(var(--primary-800))`}
          onMouseUp={e =>    e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`}
        >
          View Logs
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const CoordinatorDailyLogs = () => {
  const navigate = useNavigate();
  const [logs, setLogs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await getCoordinatorLogs();
        setLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch logs:', err);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const students = groupByStudent(logs);

  const filteredStudents = students.filter((s) => {
    const fullName = `${s.f_name ?? ''} ${s.l_name ?? ''}`.toLowerCase();
    const course   = (s.course ?? "").toLowerCase();
    const q        = searchQuery.toLowerCase();
    return !q || fullName.includes(q) || course.includes(q);
  });

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), white)` }}
    >
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: `rgb(var(--primary-800))` }}
            >
              Daily Log Management
            </h1>
            <p className="mt-1 text-sm" style={{ color: `rgb(var(--primary-600))` }}>
              Select a student to review their submitted daily logs
            </p>
          </div>
          <div
            className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-1.5 shadow-sm self-start sm:self-auto"
            style={{ border: `1px solid rgb(var(--primary-200))` }}
          >
            <User className="w-4 h-4" style={{ color: `rgb(var(--primary-500))` }} />
            <span className="text-sm font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
              {students.length}{' '}
              <span className="font-normal" style={{ color: `rgb(var(--primary-600))` }}>
                {students.length === 1 ? 'student' : 'students'}
              </span>
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
          <div className="relative max-w-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: `rgb(var(--primary-400))` }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name or course…"
              className="w-full pl-9 pr-8 py-2 text-sm rounded-lg transition outline-none"
              style={{
                border:          `1px solid rgb(var(--primary-200))`,
                backgroundColor: `rgb(var(--primary-50))`,
                color:           `rgb(var(--primary-800))`,
              }}
              onFocus={e => {
                e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-400))`;
                e.target.style.borderColor = `rgb(var(--primary-400))`;
                e.target.style.backgroundColor = 'white';
              }}
              onBlur={e => {
                e.target.style.boxShadow = 'none';
                e.target.style.borderColor = `rgb(var(--primary-200))`;
                e.target.style.backgroundColor = `rgb(var(--primary-50))`;
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: `rgb(var(--primary-400))` }}
                onMouseEnter={e => e.currentTarget.style.color = `rgb(var(--primary-600))`}
                onMouseLeave={e => e.currentTarget.style.color = `rgb(var(--primary-400))`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24" style={{ color: `rgb(var(--primary-500))` }}>
            <Loader2 className="w-10 h-10 animate-spin mb-3" />
            <p className="text-sm font-medium" style={{ color: `rgb(var(--primary-600))` }}>
              Loading student logs…
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center bg-white rounded-2xl shadow-md">
            <div
              className="p-5 rounded-2xl mb-4"
              style={{
                backgroundColor: `rgb(var(--primary-50))`,
                border:          `1px solid rgb(var(--primary-100))`,
              }}
            >
              <InboxIcon className="w-10 h-10" style={{ color: `rgb(var(--primary-300))` }} />
            </div>
            <h3
              className="text-base font-semibold mb-1"
              style={{ color: `rgb(var(--primary-800))` }}
            >
              No students found
            </h3>
            <p className="text-sm max-w-xs" style={{ color: `rgb(var(--primary-500))` }}>
              {searchQuery
                ? 'Try adjusting your search term.'
                : 'No student daily logs have been submitted yet.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 text-sm font-medium underline underline-offset-2 transition-colors"
                style={{ color: `rgb(var(--primary-600))` }}
                onMouseEnter={e => e.currentTarget.style.color = `rgb(var(--primary-800))`}
                onMouseLeave={e => e.currentTarget.style.color = `rgb(var(--primary-600))`}
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredStudents.map((student) => (
                <StudentCard
                  key={student.student_id}
                  student={student}
                  onView={(id) => navigate(`/coordinator/daily-logs/${id}`)}
                />
              ))}
            </div>
            <p className="mt-4 text-xs text-right" style={{ color: `rgb(var(--primary-500))` }}>
              Showing{' '}
              <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>
                {filteredStudents.length}
              </span>{' '}
              of{' '}
              <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>
                {students.length}
              </span>{' '}
              students
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default CoordinatorDailyLogs;