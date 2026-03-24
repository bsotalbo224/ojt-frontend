import { useState, useEffect } from 'react';
import { getMyProgress } from "../../api/progress";
import {
  TrendingUp, Calendar, FileText, BookOpen,
  ClipboardCheck, CheckCircle2, Circle,
  Building2, User, GraduationCap,
  BarChart3, Activity, Award
} from 'lucide-react';

const toInt = (n) => Math.round(Number(n || 0));

const computeStatus = (data) => {
  const { student, checklist } = data;
  if (
    checklist.requiredHoursCompleted &&
    checklist.dailyLogsComplete &&
    checklist.narrativesApproved
  )
    return { label: "Completed",               color: "green"  };
  if (!checklist.narrativesApproved)
    return { label: "Pending Daily Narratives", color: "orange" };
  if (student.completedHours < student.requiredHours)
    return { label: "Ongoing",                  color: "blue"   };
  if (!checklist.coordinatorVerified)
    return { label: "For Coordinator Review",   color: "purple" };
  return   { label: "Hours Completed",          color: "teal"   };
};

const SectionCard = ({ icon: Icon, title, children, className = "" }) => (
  <div
    className={`bg-white rounded-xl shadow-md p-5 ${className}`}
    style={{ border: `1px solid rgb(var(--primary-200))` }}
  >
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-5 h-5" style={{ color: `rgb(var(--primary-700))` }} />
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
    </div>
    {children}
  </div>
);

const InfoRow = ({ label, value, highlight = false }) => (
  <div>
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">
      {label}
    </label>
    <p
      className="text-sm font-semibold"
      style={highlight ? { color: `rgb(var(--primary-700))` } : { color: '#111827' }}
    >
      {value}
    </p>
  </div>
);

const StatBadge = ({ value, label, accent = "green" }) => {
  if (accent === "green") {
    return (
      <div
        className="rounded-lg border p-3 text-center"
        style={{
          backgroundColor: `rgb(var(--primary-50))`,
          borderColor:     `rgb(var(--primary-200))`,
          color:           `rgb(var(--primary-700))`,
        }}
      >
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs font-medium mt-0.5">{label}</p>
      </div>
    );
  }
  const colors = {
    gray:  "bg-gray-50  border-gray-200  text-gray-600",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    red:   "bg-red-50   border-red-200   text-red-700",
  };
  return (
    <div className={`rounded-lg border p-3 text-center ${colors[accent] ?? colors.gray}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
    </div>
  );
};

const ChecklistItem = ({ checked, label }) => (
  <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
    {checked
      ? <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: `rgb(var(--primary-600))` }} />
      : <Circle       className="w-5 h-5 shrink-0 text-gray-300" />
    }
    <span className={`text-sm font-medium ${checked ? "text-gray-800" : "text-gray-500"}`}>
      {label}
    </span>
  </div>
);

const StudentProgress = () => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProgress() {
      try {
        const user      = JSON.parse(localStorage.getItem("user"));
        const studentId = user?.student_id;
        if (!studentId) { setLoading(false); return; }

        const progress = await getMyProgress(studentId);
        const completedHours = toInt(progress?.completed_hours);
        const requiredHours  = toInt(progress?.required_hours);
        const pct            = Math.min(progress?.completion_percent ?? 0, 100);

        setData({
          pct,
          student: {
            name:          progress?.student_name    || user?.name || "Student",
            course:        progress?.course_name     || "—",
            department:    progress?.department_name || "—",
            company:       progress?.company_name    || "—",
            requiredHours,
            completedHours,
            coordinator:   progress?.coordinator_name || "—",
          },
          attendance: {
            totalDays:          toInt(progress?.attendance?.totalDays),
            totalHours:         toInt(progress?.attendance?.totalHours),
            averageHoursPerDay: toInt(progress?.attendance?.avgHoursPerDay),
            lastDate:           progress?.attendance?.lastDate || null,
          },
          dailyLogs: {
            total:         toInt(progress?.dailyLogs?.total),
            approved:      toInt(progress?.dailyLogs?.approved),
            pending:       toInt(progress?.dailyLogs?.submitted),
            needsRevision: toInt(progress?.dailyLogs?.needsRevision),
          },
          dailyNarratives: {
            total:     toInt(progress?.narratives?.total),
            approved:  toInt(progress?.narratives?.approved),
            submitted: toInt(progress?.narratives?.submitted),
            revision:  toInt(progress?.narratives?.revision),
          },
          
          checklist: {
            requiredHoursCompleted: Boolean(progress?.checklist?.requiredHoursCompleted),
            dailyLogsComplete:      Boolean(progress?.checklist?.dailyLogsComplete),
            narrativesApproved:     Boolean(progress?.checklist?.narrativesApproved),
            coordinatorVerified:    Boolean(progress?.checklist?.coordinatorVerified),
          },
        });
      } catch (err) {
        console.error("Progress load error", err);
      } finally {
        setLoading(false);
      }
    }
    loadProgress();
  }, []);

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading OJT progress...</div>;
  if (!data)   return <div className="p-6 text-sm text-red-500">No progress data found.</div>;

  const { pct, student, attendance, dailyLogs, dailyNarratives, checklist } = data;
  const completedHours     = toInt(student.completedHours);
  const requiredHours      = toInt(student.requiredHours);
  const remainingHours     = Math.max(requiredHours - completedHours, 0);
  const status             = computeStatus(data);
  const completedChecklist = Object.values(checklist).filter(Boolean).length;
  const totalChecklist     = Object.values(checklist).length;

  /* Status badge — semantic states unrelated to primary theme, keep as Tailwind */
  const statusColorMap = {
    green:  { bg: "bg-green-100",  text: "text-green-800",  border: "border-green-300"  },
    blue:   { bg: "bg-blue-100",   text: "text-blue-800",   border: "border-blue-300"   },
    amber:  { bg: "bg-amber-100",  text: "text-amber-800",  border: "border-amber-300"  },
    orange: { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300" },
    purple: { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300" },
    teal:   { bg: "bg-teal-100",   text: "text-teal-800",   border: "border-teal-300"   },
  };
  const sc = statusColorMap[status.color];

  const formatPageDate = () =>
    new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try { return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return "—"; }
  };

  return (
    <div
      className="h-full"
      style={{ background: `linear-gradient(to bottom, rgb(var(--primary-50)), white, rgb(var(--primary-50)))` }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* PAGE HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-600)), rgb(var(--primary-700)))` }}
            >
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">OJT Progress</h1>
              <p className="text-xs text-gray-500">Track your internship completion status</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div
              className="bg-white rounded-lg px-4 py-2 shadow-sm"
              style={{ border: `1px solid rgb(var(--primary-200))` }}
            >
              <p className="text-sm font-semibold text-gray-700">{formatPageDate()}</p>
            </div>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-semibold text-sm shadow-sm ${sc.bg} ${sc.text} ${sc.border}`}>
              <Activity className="w-4 h-4" />
              {status.label}
            </div>
          </div>
        </div>

        {/* ROW 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

          <SectionCard icon={GraduationCap} title="Student OJT Overview">
            <div className="space-y-3">
              <InfoRow label="Student Name"        value={student.name} />
              <InfoRow label="Course / Department" value={`${student.course} — ${student.department}`} />
              <div className="flex items-start gap-2">
                <Building2 className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-1" />
                <InfoRow label="Assigned Company" value={student.company} />
              </div>
              <div className="flex items-start gap-2">
                <User className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-1" />
                <InfoRow label="Coordinator" value={student.coordinator} />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <InfoRow label="Required Hours"  value={`${student.requiredHours} hrs`} />
                <InfoRow label="Completed Hours" value={`${student.completedHours} hrs`} highlight />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Remaining Hours</p>
                <p className="text-xl font-bold text-gray-900">{remainingHours} hrs</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={BarChart3} title="Hours Progress">
            <div className="space-y-5">
              <div className="flex items-center gap-6">
                <div className="relative w-28 h-28 shrink-0">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
                    <circle cx="56" cy="56" r="46" strokeWidth="10" fill="none"
                      stroke={`rgb(var(--primary-100))`} />
                    <circle cx="56" cy="56" r="46" strokeWidth="10" fill="none"
                      stroke={`rgb(var(--primary-600))`}
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 46}`}
                      strokeDashoffset={`${2 * Math.PI * 46 * (1 - pct / 100)}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900">{pct}%</span>
                    <span className="text-xs text-gray-500 font-medium">Done</span>
                  </div>
                </div>
                <div className="space-y-3 flex-1">
                  <div className="rounded-lg p-3" style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-200))` }}>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--primary-700))` }}>Completed</p>
                    <p className="text-xl font-bold text-gray-900">
                      {student.completedHours} <span className="text-sm font-medium text-gray-500">/ {requiredHours} hrs</span>
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Remaining</p>
                    <p className="text-xl font-bold text-gray-900">
                      {remainingHours} <span className="text-sm font-medium text-gray-500">hrs left</span>
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-500 mb-1.5">
                  <span>0 hrs</span><span>{student.requiredHours} hrs</span>
                </div>
                <div className="w-full rounded-full h-3 overflow-hidden" style={{ backgroundColor: `rgb(var(--primary-100))` }}>
                  <div className="h-3 rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(to right, rgb(var(--primary-500)), rgb(var(--primary-600)))` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1.5 text-center">{pct}% of required hours completed</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg p-2.5 text-center" style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-200))` }}>
                  <p className="text-lg font-bold" style={{ color: `rgb(var(--primary-700))` }}>{pct}%</p>
                  <p className="text-xs text-gray-500 font-medium">Complete</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-gray-700">{student.completedHours}</p>
                  <p className="text-xs text-gray-500 font-medium">Done (hrs)</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-gray-700">{remainingHours}</p>
                  <p className="text-xs text-gray-500 font-medium">Left (hrs)</p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ROW 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
          <SectionCard icon={Calendar} title="Attendance">
            <div className="grid grid-cols-2 gap-2.5">
              <StatBadge value={attendance.totalDays}                       label="Days Attended" accent="green" />
              <StatBadge value={`${toInt(attendance.totalHours)}h`}         label="Total Hours"   accent="green" />
              <StatBadge value={`${toInt(attendance.averageHoursPerDay)}h`} label="Avg / Day"     accent="gray"  />
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-2.5 text-center">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-tight">Last Attended</p>
                <p className="text-xs font-bold text-gray-700 mt-0.5">{formatDate(attendance.lastDate)}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={FileText} title="Daily Logs">
            <div className="grid grid-cols-2 gap-2.5">
              <StatBadge value={dailyLogs.total}         label="Total"          accent="gray"  />
              <StatBadge value={dailyLogs.approved}      label="Approved"       accent="green" />
              <StatBadge value={dailyLogs.pending}       label="Submitted"      accent="amber" />
              <StatBadge value={dailyLogs.needsRevision} label="Needs Revision" accent="red"   />
            </div>
          </SectionCard>

          <SectionCard icon={BookOpen} title="Daily Narratives">
            <div className="grid grid-cols-2 gap-2.5">
              <StatBadge value={dailyNarratives.total}     label="Total"          accent="gray"  />
              <StatBadge value={dailyNarratives.approved}  label="Approved"       accent="green" />
              <StatBadge value={dailyNarratives.submitted} label="Submitted"      accent="amber" />
              <StatBadge value={dailyNarratives.revision}  label="Needs Revision" accent="red"   />
            </div>
          </SectionCard>
        </div>

        {/* ROW 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          <SectionCard icon={ClipboardCheck} title="Completion Checklist">
            <div className="mb-3">
              <div className="flex justify-between text-xs font-semibold text-gray-500 mb-1.5">
                <span>Progress</span>
                <span>{completedChecklist} / {totalChecklist} completed</span>
              </div>
              <div className="w-full rounded-full h-2 overflow-hidden" style={{ backgroundColor: `rgb(var(--primary-100))` }}>
                <div className="h-2 rounded-full" style={{ width: `${(completedChecklist / totalChecklist) * 100}%`, background: `linear-gradient(to right, rgb(var(--primary-500)), rgb(var(--primary-600)))` }} />
              </div>
            </div>
            <ChecklistItem checked={checklist.requiredHoursCompleted} label="Required OJT hours completed" />
            <ChecklistItem checked={checklist.dailyLogsComplete}      label="All daily logs submitted & approved" />
            <ChecklistItem checked={checklist.narrativesApproved}     label="All daily narratives approved" />
            <ChecklistItem checked={checklist.coordinatorVerified}    label="Coordinator verified & signed off" />
          </SectionCard>

          <SectionCard icon={Award} title="Overall OJT Status">
            <div className="flex flex-col items-center justify-center h-full py-2 space-y-4">
              <div className={`w-full py-5 rounded-xl border-2 flex flex-col items-center gap-2 ${sc.bg} ${sc.border}`}>
                <Activity className={`w-8 h-8 ${sc.text}`} />
                <p className={`text-2xl font-bold ${sc.text}`}>{status.label}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 w-full">
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 text-center">
                  <p className="text-xl font-bold text-gray-900">{pct}%</p>
                  <p className="text-xs text-gray-500 font-medium">Hours Done</p>
                </div>
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 text-center">
                  <p className="text-xl font-bold text-gray-900">{dailyLogs.approved}</p>
                  <p className="text-xs text-gray-500 font-medium">Logs OK</p>
                </div>
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 text-center">
                  <p className="text-xl font-bold text-gray-900">{completedChecklist}/{totalChecklist}</p>
                  <p className="text-xs text-gray-500 font-medium">Checklist</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center px-2">
                Status is computed automatically based on submitted records, daily narratives, and coordinator review.
              </p>
            </div>
          </SectionCard>
        </div>

      </div>
    </div>
  );
};

export default StudentProgress;