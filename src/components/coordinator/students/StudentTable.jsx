import {
  Users, Search, Eye, CheckCircle, Clock,
  FileText, BookOpen, Filter, Building2, Edit2, GraduationCap,
} from 'lucide-react';
import Avatar from '../../ui/Avatar';
import ScheduleBadge from './ScheduleBadge';

const FILTER_OPTIONS = [
  { value: 'all',       label: 'All Students' },
  { value: 'completed', label: 'Completed'    },
  { value: 'ongoing',   label: 'On-Going'     },
];

const TABLE_COLUMNS = ['Student', 'Course', 'Company / Schedule', 'OJT Hours', 'Daily Logs', 'Narratives', 'Status', 'Actions'];

const INPUT_CLASS =
  'pl-9 pr-4 py-2 text-sm rounded-lg w-72 outline-none transition-shadow border ' +
  'border-[rgb(var(--primary-200))] bg-[rgb(var(--primary-50))] text-[rgb(var(--primary-800))] ' +
  'focus:border-[rgb(var(--primary-300))] focus:shadow-[0_0_0_2px_rgb(var(--primary-300))]';

const SELECT_CLASS =
  'pl-9 pr-8 py-2 text-sm rounded-lg outline-none appearance-none cursor-pointer transition-shadow border ' +
  'border-[rgb(var(--primary-200))] bg-[rgb(var(--primary-50))] text-[rgb(var(--primary-800))] ' +
  'focus:border-[rgb(var(--primary-300))] focus:shadow-[0_0_0_2px_rgb(var(--primary-300))]';

const ACTION_BUTTON_CLASS = 'p-2 rounded-lg transition-colors text-[rgb(var(--primary-600))] hover:bg-[rgb(var(--primary-50))]';

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

const EmptyState = ({ hasFilter }) => (
  <tr>
    <td colSpan={TABLE_COLUMNS.length} className="py-16 text-center">
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
    {TABLE_COLUMNS.map((_, i) => (
      <td key={i} className="py-4 px-4">
        <div className="h-4 rounded animate-pulse" style={{ backgroundColor: `rgb(var(--primary-50))` }} />
      </td>
    ))}
  </tr>
);

const getFullName = (student) =>
  [student.f_name, student.l_name].filter(Boolean).join(' ') || 'Unknown Student';

const StudentRow = ({ student, completed, onViewProgress, onEditStudent, onAssignCompany }) => {
  const fullName = getFullName(student);
  const companyName = student.company || student.company_name || null;
  const hoursCompleted = Number(student.hours_completed ?? 0);
  const requiredHours = Number(student.ojt_hours_required ?? 0);
  const avatarSrc = typeof student.photo === 'string' && student.photo.trim() ? student.photo : '';

  return (
    <tr className="transition-colors duration-150 hover:bg-[rgb(var(--primary-50))]" style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}>
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-3">
          <Avatar name={fullName} src={avatarSrc} size="sm" />
          <span className="text-sm font-semibold whitespace-nowrap" style={{ color: `rgb(var(--primary-800))` }}>{fullName}</span>
        </div>
      </td>
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-1.5 text-sm whitespace-nowrap" style={{ color: `rgb(var(--primary-700))` }}>
          <GraduationCap className="w-3.5 h-3.5 shrink-0" style={{ color: `rgb(var(--primary-400))` }} />{student.course ?? '—'}
        </div>
      </td>
      <td className="py-3.5 px-4">
        <p className="text-sm max-w-44 truncate font-medium" style={{ color: `rgb(var(--primary-700))` }} title={companyName ?? undefined}>{companyName ?? '—'}</p>
        {companyName && <ScheduleBadge startTime={student.start_time} endTime={student.end_time} />}
      </td>
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: `rgb(var(--primary-400))` }} />
          <span className="font-semibold" style={{ color: `rgb(var(--primary-800))` }}>{hoursCompleted}</span>
          <span style={{ color: `rgb(var(--primary-400))` }}>/</span>
          <span style={{ color: `rgb(var(--primary-600))` }}>{requiredHours} hrs</span>
        </div>
      </td>
      <td className="py-3.5 px-4"><PendingChip count={student.submitted_logs}       icon={FileText} color="bg-orange-50 text-orange-600" /></td>
      <td className="py-3.5 px-4"><PendingChip count={student.submitted_narratives} icon={BookOpen}  color="bg-rose-50 text-rose-600" /></td>
      <td className="py-3.5 px-4"><StatusBadge completed={completed} /></td>
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-1">
          <button onClick={() => onViewProgress(student.student_id)} title="View Progress" aria-label="View Progress" className={ACTION_BUTTON_CLASS}>
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={() => onEditStudent(student)} title="Edit Student" aria-label="Edit Student" className={ACTION_BUTTON_CLASS}>
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => onAssignCompany(student)}
            title={companyName ? 'Change Company & Schedule' : 'Assign Company & Schedule'}
            aria-label={companyName ? 'Change Company & Schedule' : 'Assign Company & Schedule'}
            className={`p-2 rounded-lg transition-colors ${companyName ? 'text-indigo-600 hover:bg-indigo-50' : 'text-blue-600 hover:bg-blue-50'}`}>
            <Building2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

const StudentTable = ({
  students,
  filtered,
  loading,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  isCompleted,
  onViewProgress,
  onEditStudent,
  onAssignCompany,
}) => {
  const hasFilter = search.trim() !== '' || filter !== 'all';

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden" style={{ border: `1px solid rgb(var(--primary-50))` }}>
      <div className="px-6 pt-5 pb-4" style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <h2 className="text-lg font-bold" style={{ color: `rgb(var(--primary-800))` }}>Student List</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `rgb(var(--primary-400))` }} />
              <input type="text" placeholder="Search by name, course, company…" value={search} onChange={(e) => onSearchChange(e.target.value)}
                aria-label="Search students"
                className={INPUT_CLASS} />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `rgb(var(--primary-400))` }} />
              <select value={filter} onChange={(e) => onFilterChange(e.target.value)} aria-label="Filter students" className={SELECT_CLASS}>
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

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: `rgb(var(--primary-50))` }}>
              {TABLE_COLUMNS.map((col) => (
                <th key={col} className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: `rgb(var(--primary-600))` }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.length === 0 ? <EmptyState hasFilter={hasFilter} />
              : filtered.map((student) => (
                <StudentRow
                  key={student.student_id}
                  student={student}
                  completed={isCompleted(student)}
                  onViewProgress={onViewProgress}
                  onEditStudent={onEditStudent}
                  onAssignCompany={onAssignCompany}
                />
              ))
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
  );
};

export default StudentTable;