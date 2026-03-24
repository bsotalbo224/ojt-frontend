import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Users,
  ChevronRight,
} from 'lucide-react';
import { getCoordinatorAttendance } from '../../api/attendance';
import Avatar from "../../components/ui/Avatar";

const BASE_URL = import.meta.env.VITE_BASE_URL;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const resolveFullName = (r) => {
  if (r.student_name && r.student_name.trim()) return r.student_name.trim();
  const f = (r.f_name ?? '').trim();
  const l = (r.l_name ?? '').trim();
  const combined = [f, l].filter(Boolean).join(' ');
  return combined || 'Unknown Student';
};

const isMissingTimeOut = (t) => !t || t === '00:00:00' || t === '0000-00-00 00:00:00';

const groupByStudent = (records) => {
  const map = {};
  records.forEach((r) => {
    const id = r.student_id;
    if (!map[id]) {
      map[id] = {
        student_id: id,
        full_name: resolveFullName(r),
        course: r.course ?? '',
        company: r.company ?? '',
        photo: r.photo ?? '',
        records: [],
      };
    }
    map[id].records.push(r);
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
        <p className={`text-3xl font-bold ${accent}`}>
          {loading ? '—' : value}
        </p>
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
  const { records, full_name } = student;

  const verified    = records.filter((r) => r.location_status === 'verified').length;
  const discrepancy = records.filter((r) => r.location_status === 'discrepancy').length;
  const missingOut  = records.filter((r) => isMissingTimeOut(r.time_out)).length;

  return (
    <div
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group h-full"
      style={{ border: `1px solid rgb(var(--primary-50))` }}
      onMouseEnter={e => e.currentTarget.style.borderColor = `rgb(var(--primary-200))`}
      onMouseLeave={e => e.currentTarget.style.borderColor = `rgb(var(--primary-50))`}
    >
      {/* Card Header */}
      <div className="p-5 flex items-center gap-4">
        <Avatar
          name={full_name}
          src={student.photo ? `${BASE_URL}${student.photo}` : ""}
          size="md"
        />
        <div className="min-w-0">
          <p
            className="text-sm font-bold truncate"
            style={{ color: `rgb(var(--primary-800))` }}
          >
            {full_name}
          </p>
          {student.course && (
            <p
              className="text-xs truncate mt-0.5"
              style={{ color: `rgb(var(--primary-500))` }}
            >
              {student.course}
            </p>
          )}
        </div>
      </div>

      {/* Stat Row — verified uses primary vars; discrepancy/missing-out are semantic */}
      <div className="px-5 pb-4 grid grid-cols-3 gap-2 items-stretch">
        <div
          className="flex flex-col items-center justify-center rounded-lg py-2 min-h-14"
          style={{
            backgroundColor: `rgb(var(--primary-50))`,
            border: `1px solid rgb(var(--primary-100))`,
          }}
        >
          <span className="text-lg font-bold" style={{ color: `rgb(var(--primary-600))` }}>
            {verified}
          </span>
          <span
            className="text-[10px] font-semibold uppercase tracking-wide text-center whitespace-nowrap"
            style={{ color: `rgb(var(--primary-500))` }}
          >
            Verified
          </span>
        </div>
        {/* Discrepancy — amber is semantic */}
        <div className="flex flex-col items-center justify-center bg-amber-50 border border-amber-100 rounded-lg py-2 min-h-14">
          <span className="text-lg font-bold text-amber-600">{discrepancy}</span>
          <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide text-center whitespace-nowrap">Discrepancy</span>
        </div>
        {/* Missing time-out — orange is semantic */}
        <div className="flex flex-col items-center justify-center bg-orange-50 border border-orange-100 rounded-lg py-2 min-h-14">
          <span className="text-lg font-bold text-orange-500">{missingOut}</span>
          <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-wide text-center whitespace-nowrap">No T-Out</span>
        </div>
      </div>

      {/* Total */}
      <div className="px-5 pb-3">
        <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>
          <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>
            {records.length}
          </span>{' '}
          attendance record{records.length !== 1 ? 's' : ''} total
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
          <Calendar className="w-4 h-4" />
          View Attendance
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
      <Calendar className="w-8 h-8" style={{ color: `rgb(var(--primary-300))` }} />
    </div>
    <p className="text-base font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
      {hasFilter ? 'No matching students' : 'No attendance records yet'}
    </p>
    <p className="text-sm max-w-xs" style={{ color: `rgb(var(--primary-500))` }}>
      {hasFilter
        ? 'Try adjusting your search.'
        : 'Attendance records will appear once students start logging.'}
    </p>
  </div>
);

/* ErrorState uses red — semantic, keep as Tailwind */
const ErrorState = () => (
  <div className="col-span-full py-20 flex flex-col items-center gap-3 text-center">
    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
      <AlertTriangle className="w-8 h-8 text-red-300" />
    </div>
    <p className="text-base font-semibold text-red-700">Failed to load attendance records</p>
    <p className="text-sm text-red-400">Please refresh the page or try again later.</p>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const CoordinatorAttendance = () => {
  const navigate = useNavigate();

  const [records, setRecords]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    getCoordinatorAttendance()
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .catch((err) => { console.error("Attendance API error:", err); setError(true); })
      .finally(() => setLoading(false));
  }, []);

  const students = useMemo(() => groupByStudent(records), [records]);

  const stats = useMemo(() => ({
    totalStudents: students.length,
    discrepancy:   records.filter((r) => r.location_status === 'discrepancy').length,
    missingOut:    records.filter((r) => isMissingTimeOut(r.time_out)).length,
  }), [students, records]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const name   = s.full_name.toLowerCase();
      const course = (s.course ?? '').toLowerCase();
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
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: `rgb(var(--primary-800))` }}
            >
              Attendance Monitoring
            </h1>
            <p className="mt-1 text-sm" style={{ color: `rgb(var(--primary-500))` }}>
              Review student time-in, time-out, and location records
            </p>
          </div>
          <div
            className="hidden lg:flex items-center gap-2 text-xs font-medium bg-white rounded-lg px-3 py-2 shadow-sm"
            style={{
              color: `rgb(var(--primary-400))`,
              border: `1px solid rgb(var(--primary-100))`,
            }}
          >
            <Users className="w-3.5 h-3.5" />
            {loading ? '—' : students.length} student{students.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total students — primary themed */}
          <SummaryCard
            title="Total Students"
            value={stats.totalStudents}
            icon={Users}
            accent="text-gray-800"
            loading={loading}
          />
          {/* Discrepancy + Missing — semantic colours passed via accent prop (Tailwind) */}
          <SummaryCard
            title="With Discrepancy"
            value={stats.discrepancy}
            icon={MapPin}
            accent="text-amber-600"
            loading={loading}
          />
          <SummaryCard
            title="Missing Time-Out"
            value={stats.missingOut}
            icon={AlertTriangle}
            accent="text-orange-500"
            loading={loading}
          />
        </div>

        {/* Toolbar */}
        <div
          className="bg-white rounded-2xl shadow-sm px-6 py-4"
          style={{ border: `1px solid rgb(var(--primary-50))` }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <h2
              className="text-lg font-bold"
              style={{ color: `rgb(var(--primary-800))` }}
            >
              Student Records
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
                  border: `1px solid rgb(var(--primary-200))`,
                  backgroundColor: `rgb(var(--primary-50) / 0.4)`,
                  color: `rgb(var(--primary-800))`,
                }}
                onFocus={e => {
                  e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`;
                  e.target.style.borderColor = `rgb(var(--primary-300))`;
                }}
                onBlur={e => {
                  e.target.style.boxShadow = 'none';
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

        {/* Student Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
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
                onClick={() => navigate(`/coordinator/attendance/${student.student_id}`)}
              />
            ))
          )}
        </div>

      </div>
    </div>
  );
};

export default CoordinatorAttendance;