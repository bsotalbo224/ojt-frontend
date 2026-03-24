import { useEffect, useState } from 'react';
import {
  Users, Clock, CheckCircle, AlertCircle,
  FileText, Building2, UserCog, Eye,
  BookOpen, UserPlus, Award, Loader2,
  GraduationCap, Mail, Hash,
} from 'lucide-react';
import {
  getAdminDashboardStats,
  getAdminStudentsOverview,
  getAdminCoordinatorsSummary,
  getAdminCompaniesSummary,
  getAdminRecentActivity
} from "../../api/admin";
import Avatar from "../../components/ui/Avatar";

const BASE_URL = import.meta.env.VITE_BASE_URL;

const STATUS_CONFIG = {
  ongoing: {
    label: 'Ongoing',
    pill: 'bg-blue-50 text-blue-600 border border-blue-200',
    icon: Clock,
  },
  completed: {
    label: 'Completed',
    pill: 'bg-green-100 text-green-700 border border-green-200',
    icon: CheckCircle,
  },
  pending: {
    label: 'Pending',
    pill: 'bg-amber-50 text-amber-700 border border-amber-200',
    icon: AlertCircle,
  },
};

const ACTIVITY_ICON_CONFIG = {
  assigned: 'bg-blue-50 text-blue-500',
  completed: 'bg-green-50 text-green-500',
  coordinator: 'bg-purple-50 text-purple-500',
};

const StatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    pill: 'bg-gray-100 text-gray-600 border border-gray-200',
    icon: Clock,
  };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${config.pill}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

const SummaryCard = ({ title, value, icon: Icon, loading }) => (
  <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-green-600 font-medium mb-1">{title}</p>
        {loading ? (
          <div className="h-9 w-16 bg-green-100 rounded-lg animate-pulse mt-1" />
        ) : (
          <p className="text-3xl font-bold text-green-800">{value ?? '—'}</p>
        )}
      </div>
      <div className="bg-green-100 p-3 rounded-lg shrink-0">
        <Icon className="w-6 h-6 text-green-600" />
      </div>
    </div>
  </div>
);

const EmptyState = ({ icon: Icon, message, subtext }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-3">
    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
      <Icon className="w-8 h-8 text-green-300" />
    </div>
    <p className="text-base font-semibold text-green-800">{message}</p>
    {subtext && <p className="text-sm text-green-500">{subtext}</p>}
  </div>
);

// ─── Student Overview Table ───────────────────────────────────────────────────

const StudentOverviewTable = ({ students, loading, onPreview }) => (
  <div className="bg-white rounded-2xl shadow-md border border-green-50 overflow-hidden mb-8">
    <div className="px-6 pt-5 pb-4 border-b border-green-50 flex items-center justify-between">
      <h2 className="text-lg font-bold text-green-800">Student Overview</h2>
      <span className="text-xs text-green-500 font-medium">
        {!loading && `${students.length} students`}
      </span>
    </div>
    <div className="overflow-x-auto">
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
          <p className="text-sm text-green-500">Loading students…</p>
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          message="No students found"
          subtext="Student records will appear here."
        />
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-green-50/60">
              {['Student Name', 'Course', 'Company', 'Coordinator', 'Hours', 'Status'].map((col) => (
                <th
                  key={col}
                  className="text-left py-3 px-4 text-xs font-semibold text-green-600 uppercase tracking-wider whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
              <th className="text-center py-3 px-4 text-xs font-semibold text-green-600 uppercase tracking-wider whitespace-nowrap">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const pct = student.totalHours
                ? Math.round((student.hoursCompleted / student.totalHours) * 100)
                : 0;
              return (
                <tr
                  key={student.student_id}
                  className="border-b border-green-50 hover:bg-green-50/50 transition-colors duration-150 group"
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={`${student.f_name} ${student.l_name}`}
                        src={student.photo ? `${BASE_URL}${student.photo}` : ""}
                        size="sm"
                      />
                      <span className="text-sm font-semibold text-green-900 whitespace-nowrap">
                        {student.f_name} {student.l_name}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-green-700">
                    <span
                      className="block max-w-40 truncate font-semibold"
                      title={student.course_name || ""}
                    >
                      {student.course_code || "—"}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-green-700 whitespace-nowrap">{student.company_name ?? "—"}</td>
                  <td className="py-4 px-4 text-sm text-green-700 whitespace-nowrap">{student.coordinator ?? "—"}</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2 min-w-30">
                      <div className="flex-1 bg-green-100 rounded-full h-1.5 min-w-16">
                        <div
                          className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-green-700 whitespace-nowrap">
                        {Math.round(student.hoursCompleted)}/{Math.round(student.totalHours)}h
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <StatusBadge status={student.status ?? "pending"} />
                  </td>
                  <td className="py-4 px-4 text-center">
                    <button
                      onClick={() => onPreview?.(student)}
                      className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
    {!loading && students.length > 0 && (
      <div className="px-6 py-3 border-t border-green-50 bg-green-50/30 flex items-center justify-between">
        <p className="text-xs text-green-500">
          {students.length} record{students.length !== 1 ? 's' : ''} shown
        </p>
        <div className="flex items-center gap-4 text-xs text-green-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Ongoing
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Pending
          </span>
        </div>
      </div>
    )}
  </div>
);

// ─── Coordinators Card List ───────────────────────────────────────────────────

const CoordinatorsCard = ({ coordinators, loading }) => (
  <div className="bg-white rounded-2xl shadow-md border border-green-50 overflow-hidden flex flex-col">
    <div className="px-6 pt-5 pb-4 border-b border-green-50 flex items-center justify-between">
      <h2 className="text-lg font-bold text-green-800">Coordinators</h2>
      <div className="bg-green-100 p-2 rounded-lg">
        <UserCog className="w-4 h-4 text-green-600" />
      </div>
    </div>
    <div className="flex-1 overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
        </div>
      ) : coordinators.length === 0 ? (
        <EmptyState icon={UserCog} message="No coordinators" subtext="Coordinator records will appear here." />
      ) : (
        <ul className="divide-y divide-green-50">
          {coordinators.map((coord) => (
            <li key={coord.coordinator_id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-green-50/50 transition-colors">
              <Avatar
                name={`${coord.f_name} ${coord.l_name}`}
                src={coord.photo ? `${API_URL}${coord.photo}` : ""}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-900 truncate">{coord.f_name} {coord.l_name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Mail className="w-3 h-3 text-green-400 shrink-0" />
                  <p className="text-xs text-green-500 truncate">{coord.email}</p>
                </div>
              </div>
              <div className="shrink-0">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-100 rounded-full text-xs font-semibold text-green-700 whitespace-nowrap">
                  <Users className="w-2.5 h-2.5" />
                  {coord.assignedStudents ?? 0}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

// ─── Companies Summary Card ───────────────────────────────────────────────────

const CompaniesCard = ({ companies, loading }) => (
  <div className="bg-white rounded-2xl shadow-md border border-green-50 overflow-hidden flex flex-col">
    <div className="px-6 pt-5 pb-4 border-b border-green-50 flex items-center justify-between">
      <h2 className="text-lg font-bold text-green-800">Partner Companies</h2>
      <div className="bg-green-100 p-2 rounded-lg">
        <Building2 className="w-4 h-4 text-green-600" />
      </div>
    </div>
    <div className="flex-1 overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
        </div>
      ) : companies.length === 0 ? (
        <EmptyState icon={Building2} message="No companies" subtext="Partner companies will appear here." />
      ) : (
        <ul className="divide-y divide-green-50">
          {companies.map((company) => (
            <li key={company.company_id} className="flex items-center justify-between px-5 py-3.5 hover:bg-green-50/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-linear-to-br from-green-100 to-green-200 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-sm font-semibold text-green-900 truncate">{company.company_name}</p>
              </div>
              <div className="shrink-0 ml-3">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-100 rounded-full text-xs font-semibold text-green-700 whitespace-nowrap">
                  <Hash className="w-2.5 h-2.5" />
                  {company.totalInterns ?? 0} intern{company.totalInterns !== 1 ? 's' : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

// ─── Recent Activity Card ─────────────────────────────────────────────────────

const RecentActivityCard = ({ activities, loading }) => (
  <div className="bg-white rounded-2xl shadow-md border border-green-50 overflow-hidden flex flex-col">
    <div className="px-6 pt-5 pb-4 border-b border-green-50 flex items-center justify-between">
      <h2 className="text-lg font-bold text-green-800">Recent Activity</h2>
      <div className="bg-green-100 p-2 rounded-lg">
        <BookOpen className="w-4 h-4 text-green-600" />
      </div>
    </div>
    <div className="flex-1 overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <EmptyState icon={FileText} message="No recent activity" subtext="System activity will appear here." />
      ) : (
        <ul className="divide-y divide-green-50">
          {activities.map((activity) => {
            const Icon = activity.icon;
            const colorClass = ACTIVITY_ICON_CONFIG[activity.type] ?? 'bg-gray-50 text-gray-400';
            return (
              <li key={activity.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-green-50/50 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-sm text-green-800 flex-1 leading-snug">{activity.text}</p>
                <span className="text-xs text-green-400 shrink-0 whitespace-nowrap ml-2">{activity.date}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  </div>
);

// ─── Student Preview Modal ────────────────────────────────────────────────────

const StudentPreviewModal = ({ student, onClose }) => {
  if (!student) return null;

  const pct = student.totalHours
    ? Math.round((student.hoursCompleted / student.totalHours) * 100)
    : 0;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-linear-to-r from-green-600 to-green-500 px-6 py-5">
          <div className="flex items-center gap-4">
            <Avatar
              name={`${student.f_name} ${student.l_name}`}
              src={student.photo ? `${API_URL}${student.photo}` : ""}
              size="lg"
            />
            <div>
              <h2 className="text-lg font-bold text-white">
                {student.f_name} {student.l_name}
              </h2>
              <p className="text-green-100 text-sm mt-0.5">{student.course_name ?? student.course_code ?? "—"}</p>
            </div>
            <StatusBadge status={student.status ?? "pending"} />
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Hours Progress</span>
              <span className="text-xs font-bold text-green-800">{Math.round(student.hoursCompleted)}/{Math.round(student.totalHours)}h ({pct}%)</span>
            </div>
            <div className="w-full bg-green-100 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="divide-y divide-green-50 rounded-xl border border-green-100 overflow-hidden">
            {[
              { label: 'Company', value: student.company_name ?? "—", icon: Building2 },
              { label: 'Coordinator', value: student.coordinator ?? "—", icon: UserCog },
              { label: 'Course', value: student.course_name ?? student.course_code ?? "—", icon: GraduationCap },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-green-50/40 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-green-500 font-medium">{label}</p>
                  <p className="text-sm font-semibold text-green-900 truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-green-50 bg-green-50/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 active:scale-95 transition-all duration-150 shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    const loadAdminDashboard = async () => {
      try {
        const [
          statsData,
          studentsData,
          coordinatorsData,
          companiesData,
          activityData
        ] = await Promise.all([
          getAdminDashboardStats(),
          getAdminStudentsOverview(),
          getAdminCoordinatorsSummary(),
          getAdminCompaniesSummary(),
          getAdminRecentActivity()
        ]);

        setStats(statsData);
        setStudents(studentsData);
        setCoordinators(coordinatorsData);
        setCompanies(companiesData);

        const mappedActivities = Array.isArray(activityData)
          ? activityData.map(a => {
              let icon = FileText;
              let type = "assigned";

              if (a.type === "evaluation") {
                icon = Award;
                type = "completed";
              }

              if (a.type === "log") {
                icon = BookOpen;
              }

              if (a.type === "coordinator") {
                icon = UserPlus;
                type = "coordinator";
              }

              return {
                id: a.notif_id,
                icon,
                type,
                text: a.message,
                date: new Date(a.created_at).toLocaleDateString()
              };
            })
          : [];

        setActivities(mappedActivities);
      } catch (err) {
        console.error("Admin dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAdminDashboard();
  }, []);

  const handlePreviewStudent = (student) => {
    setSelectedStudent(student);
  };

  const summaryCards = [
    { title: 'Total Students', value: stats?.totalStudents, icon: GraduationCap },
    { title: 'Total Coordinators', value: stats?.totalCoordinators, icon: UserCog },
    { title: 'Total Companies', value: stats?.totalCompanies, icon: Building2 },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 to-white p-6">
      <div className="max-w-7xl mx-auto">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-green-800">Admin Dashboard</h1>
          <p className="text-green-600 mt-1">System overview and management</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {summaryCards.map((card, i) => (
            <SummaryCard
              key={i}
              title={card.title}
              value={card.value}
              icon={card.icon}
              loading={loading}
            />
          ))}
        </div>

        <StudentOverviewTable
          students={students}
          loading={loading}
          onPreview={handlePreviewStudent}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <CoordinatorsCard coordinators={coordinators} loading={loading} />
          <CompaniesCard companies={companies} loading={loading} />
          <RecentActivityCard activities={activities} loading={loading} />
        </div>

      </div>

      <StudentPreviewModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    </div>
  );
};

export default AdminDashboard;