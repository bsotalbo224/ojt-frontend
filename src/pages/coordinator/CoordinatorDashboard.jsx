import { useEffect, useState } from 'react';
import {
  Users, FileText, BookOpen,
  TrendingUp, Activity,
  Building2, ChevronRight, PlusCircle,
  BarChart2, CheckCircle, AlertTriangle,
} from 'lucide-react';
import { getCoordinatorDashboardStats } from '../../api/stats';
import { useNavigate } from 'react-router-dom';

// ─── Skeleton helper ───────────────────────────────────────────────────────────

const Skeleton = ({ className }) => (
  <div className={`animate-pulse rounded ${className}`} style={{ backgroundColor: `rgb(var(--primary-100))` }} />
);

// ─── HoverButton — handles inline style hover without Tailwind color classes ───

const HoverButton = ({ children, baseStyle, hoverStyle, className, disabled, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={className}
      style={{ ...baseStyle, ...(hovered ? hoverStyle : {}) }}
    >
      {children}
    </button>
  );
};

// ─── Coordinator Dashboard ─────────────────────────────────────────────────────

const CoordinatorDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    getCoordinatorDashboardStats().then((statsData) => {
      setStats(statsData);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetch('/api/notifications')
      .then((res) => res.json())
      .then((data) => {
        const filtered = (data ?? [])
          .filter((n) => n.type === 'log' || n.type === 'narrative')
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 3)
          .map((n) => {
            const fullName = n.name ?? n.title ?? '';
            const parts = fullName.trim().split(/\s+/);
            const initials =
              parts.length >= 2
                ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
                : fullName.slice(0, 2).toUpperCase();
            return {
              initials,
              name: fullName,
              action: n.message ?? (n.type === 'log' ? 'submitted a daily log' : 'submitted a narrative'),
              status: n.status === 'flagged' ? 'red' : n.status === 'pending' ? 'yellow' : 'green',
              usePrimary: n.type === 'log',
              avatarBg: n.type === 'narrative' ? '#faf5ff' : '#fff7ed',
              avatarText: n.type === 'narrative' ? '#7e22ce' : '#c2410c',
            };
          });
        setRecentActivity(filtered);
      })
      .catch(() => setRecentActivity([]));
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalStudents       = stats?.totalStudents       ?? 0;
  const ongoing             = stats?.ongoing             ?? 0;
  const submittedLogs       = stats?.submittedLogs       ?? 0;
  const submittedNarratives = stats?.submittedNarratives ?? 0;

  const clamp = (v, max) => Math.min(100, Math.max(0, max ? Math.round((v / max) * 100) : 0));
  const studentPct   = clamp(totalStudents, 150);
  const ongoingPct   = clamp(ongoing, totalStudents || 1);
  const logPct       = clamp(submittedLogs, 50);
  const narrativePct = clamp(submittedNarratives, 50);

  // ── Attention-derived values (sourced from stats) ─────────────────────────
  const flaggedAttendance    = stats?.flaggedAttendance    ?? 0;
  const attentionPendingLogs = stats?.submittedLogs        ?? 0;
  const attentionNarratives  = stats?.submittedNarratives  ?? 0;

  const attentionRows = [
    {
      label:      'Flagged Attendance',
      value:      flaggedAttendance,
      pct:        clamp(flaggedAttendance, 20),
      accentColor:'#ef4444',
      barColor:   '#fca5a5',
      textColor:  '#b91c1c',
      iconBgColor:'#fff1f2',
      icon:       AlertTriangle,
      to:         '/coordinator/attendance',
    },
    {
      label:      'Submitted Daily Logs',
      value:      attentionPendingLogs,
      pct:        clamp(attentionPendingLogs, 50),
      accentColor:'#f97316',
      barColor:   '#fdba74',
      textColor:  '#c2410c',
      iconBgColor:'#fff7ed',
      icon:       FileText,
      to:         '/coordinator/daily-logs',
    },
    {
      label:      'Submitted Narratives',
      value:      attentionNarratives,
      pct:        clamp(attentionNarratives, 50),
      accentColor:'#a855f7',
      barColor:   '#d8b4fe',
      textColor:  '#7e22ce',
      iconBgColor:'#faf5ff',
      icon:       BookOpen,
      to:         '/coordinator/narratives',
    },
  ];

  // ── Stat cards ─────────────────────────────────────────────────────────────
  const statCards = [
    {
      title: 'Total Students',
      value: totalStudents,
      pct: studentPct,
      icon: Users,
      usePrimary: true,
      to: '/coordinator/students',
    },
    {
      title: 'Ongoing OJT',
      value: ongoing,
      pct: ongoingPct,
      icon: Activity,
      usePrimary: true,
      to: '/coordinator/students',
    },
    {
      title: 'Submitted Daily Logs',
      value: submittedLogs,
      pct: logPct,
      icon: FileText,
      usePrimary: false,
      accentColor: '#f97316',
      iconBgColor: '#fff7ed',
      barColor: '#fdba74',
      textColor: '#c2410c',
      to: '/coordinator/daily-logs',
    },
    {
      title: 'Submitted Narratives',
      value: submittedNarratives,
      pct: narrativePct,
      icon: BookOpen,
      usePrimary: false,
      accentColor: '#a855f7',
      iconBgColor: '#faf5ff',
      barColor: '#d8b4fe',
      textColor: '#7e22ce',
      to: '/coordinator/narratives',
    },
  ];

  // ── Workflow steps ─────────────────────────────────────────────────────────
  const workflowSteps = [
    { label: 'Review Logs',         icon: FileText,   to: '/coordinator/daily-logs', usePrimary: false, ringColor: '#fff7ed', iconColor: '#f97316' },
    { label: 'Evaluate Narratives', icon: BookOpen,   to: '/coordinator/narratives', usePrimary: false, ringColor: '#faf5ff', iconColor: '#a855f7' },
    { label: 'Monitor Progress',    icon: TrendingUp, to: '/coordinator/students',   usePrimary: true },
    { label: 'Assign Companies',    icon: Building2,  to: '/coordinator/students',   usePrimary: false, ringColor: '#eff6ff', iconColor: '#3b82f6' },
  ];

  // ── Hours ──────────────────────────────────────────────────────────────────
  const avgHours      = stats?.avgHoursLogged ?? 0;
  const requiredHours = stats?.requiredHours  ?? 0;
  const hoursPct      = Math.min(100, Math.max(0, requiredHours ? Math.round((avgHours / requiredHours) * 100) : 0));

  // ── Quick actions ──────────────────────────────────────────────────────────
  const quickActions = [
    {
      label: 'Create evaluation',
      icon: PlusCircle,
      to: '/coordinator/evaluation',
      disabled: false,
      baseStyle: { backgroundColor: `rgb(var(--primary-600))`, color: '#fff' },
      hoverStyle: { backgroundColor: `rgb(var(--primary-700))` },
    },
    {
      label: 'Assign company',
      icon: Building2,
      to: '/coordinator/students',
      disabled: false,
      baseStyle: { backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
      hoverStyle: { backgroundColor: '#dcfce7' },
    },
    {
      label: 'Review logs',
      icon: FileText,
      to: '/coordinator/daily-logs',
      disabled: false,
      baseStyle: { backgroundColor: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff' },
      hoverStyle: { backgroundColor: '#f3e8ff' },
    },
    {
      label: 'View analytics',
      icon: BarChart2,
      to: null,
      disabled: true,
      baseStyle: { backgroundColor: '#f9fafb', color: '#9ca3af', border: '1px solid #e5e7eb', cursor: 'not-allowed' },
      hoverStyle: {},
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), white, rgb(var(--primary-50) / 0.3))` }}
    >
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Page Header ── */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-500)), rgb(var(--primary-600)))` }}
          >
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight" style={{ color: `rgb(var(--primary-800))` }}>
              Coordinator Dashboard
            </h1>
            <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>
              Monitor student OJT progress and manage tasks.
            </p>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-5 shadow-sm animate-pulse space-y-3"
                  style={{ border: `1px solid rgb(var(--primary-100))` }}
                >
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))
            : statCards.map((card) => (
                <div
                  key={card.title}
                  onClick={() => navigate(card.to)}
                  className="group bg-white rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer overflow-hidden relative"
                  style={{ border: `1px solid rgb(var(--primary-100))` }}
                >
                  {/* accent stripe */}
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                    style={{
                      backgroundColor: card.usePrimary
                        ? `rgb(var(--primary-500))`
                        : card.accentColor,
                    }}
                  />

                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium" style={{ color: `rgb(var(--primary-500))` }}>
                      {card.title}
                    </p>
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: card.usePrimary
                          ? `rgb(var(--primary-100))`
                          : card.iconBgColor,
                      }}
                    >
                      <card.icon
                        className="w-3.5 h-3.5"
                        style={{
                          color: card.usePrimary
                            ? `rgb(var(--primary-600))`
                            : card.accentColor,
                        }}
                      />
                    </div>
                  </div>

                  <p
                    className="text-3xl font-bold tabular-nums mb-3"
                    style={{
                      color: card.usePrimary
                        ? `rgb(var(--primary-700))`
                        : card.textColor,
                    }}
                  >
                    {card.value}
                  </p>

                  <div
                    className="w-full rounded-full h-1.5"
                    style={{ backgroundColor: `rgb(var(--primary-100))` }}
                  >
                    <div
                      className="h-1.5 rounded-full transition-all duration-700"
                      style={{
                        width: `${card.pct}%`,
                        backgroundColor: card.usePrimary
                          ? `rgb(var(--primary-400))`
                          : card.barColor,
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: `rgb(var(--primary-400))` }}>
                    {card.pct}% of target
                  </p>
                </div>
              ))
          }
        </div>

        {/* ── Workflow Steps ── */}
        <div
          className="bg-white rounded-2xl shadow-sm p-5"
          style={{ border: `1px solid rgb(var(--primary-100))` }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: `rgb(var(--primary-400))` }}
          >
            Coordinator Workflow
          </p>
          <div className="flex items-center">
            {workflowSteps.map((step, idx) => (
              <div key={step.label} className="flex items-center flex-1 min-w-0">
                <button
                  onClick={() => navigate(step.to)}
                  className="group flex flex-col items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-200"
                    style={{
                      backgroundColor: step.usePrimary
                        ? `rgb(var(--primary-100))`
                        : step.ringColor,
                    }}
                  >
                    <step.icon
                      className="w-4 h-4"
                      style={{
                        color: step.usePrimary
                          ? `rgb(var(--primary-600))`
                          : step.iconColor,
                      }}
                    />
                  </div>
                  <span
                    className="text-xs font-medium text-center leading-tight px-1"
                    style={{ color: `rgb(var(--primary-700))` }}
                  >
                    {step.label}
                  </span>
                </button>

                {idx < workflowSteps.length - 1 && (
                  <div className="flex items-center shrink-0 -mt-5">
                    <div
                      className="w-6 sm:w-10 h-px"
                      style={{ backgroundColor: `rgb(var(--primary-200))` }}
                    />
                    <ChevronRight
                      className="w-3 h-3"
                      style={{ color: `rgb(var(--primary-300))` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Main 2-col Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Quick Actions */}
          <div
            className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200"
            style={{ border: `1px solid rgb(var(--primary-100))` }}
          >
            <p className="text-sm font-semibold mb-0.5" style={{ color: `rgb(var(--primary-800))` }}>
              Quick actions
            </p>
            <p className="text-xs mb-4" style={{ color: `rgb(var(--primary-400))` }}>
              Jump to common coordinator tasks.
            </p>
            <div className="space-y-3">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))
                : quickActions.map((action) => (
                    <HoverButton
                      key={action.label}
                      disabled={action.disabled}
                      onClick={() => !action.disabled && navigate(action.to)}
                      baseStyle={action.baseStyle}
                      hoverStyle={action.hoverStyle}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150"
                    >
                      <action.icon className="w-4 h-4 shrink-0" />
                      {action.label}
                      {!action.disabled && (
                        <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40" />
                      )}
                    </HoverButton>
                  ))
              }
            </div>
          </div>

          {/* ── Students Needing Attention ── */}
          <div
            className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200"
            style={{ border: `1px solid rgb(var(--primary-100))` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: `rgb(var(--primary-800))` }}>
                  Students needing attention
                </p>
                <p className="text-xs" style={{ color: `rgb(var(--primary-400))` }}>
                  Flagged attendance and pending submissions
                </p>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: `rgb(var(--primary-50))`,
                  color: `rgb(var(--primary-700))`,
                  border: `1px solid rgb(var(--primary-200))`,
                }}
              >
                {flaggedAttendance + attentionPendingLogs + attentionNarratives} total
              </span>
            </div>

            <div className="space-y-4">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                  ))
                : attentionRows.map((row) => (
                    <div
                      key={row.label}
                      onClick={() => navigate(row.to)}
                      className="cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center"
                            style={{ backgroundColor: row.iconBgColor }}
                          >
                            <row.icon
                              className="w-3 h-3"
                              style={{ color: row.accentColor }}
                            />
                          </div>
                          <span
                            className="text-xs font-medium group-hover:underline"
                            style={{ color: `rgb(var(--primary-700))` }}
                          >
                            {row.label}
                          </span>
                        </div>
                        <span
                          className="text-xs font-bold"
                          style={{ color: row.textColor }}
                        >
                          {row.value}
                        </span>
                      </div>
                      <div
                        className="w-full rounded-full h-2"
                        style={{ backgroundColor: `rgb(var(--primary-100))` }}
                      >
                        <div
                          className="h-2 rounded-full transition-all duration-700"
                          style={{
                            width: `${row.pct}%`,
                            backgroundColor: row.barColor,
                          }}
                        />
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>

        {/* ── Second Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Recent Activity */}
          <div
            className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200"
            style={{ border: `1px solid rgb(var(--primary-100))` }}
          >
            <p className="text-sm font-semibold mb-0.5" style={{ color: `rgb(var(--primary-800))` }}>
              Recent activity
            </p>
            <p className="text-xs mb-4" style={{ color: `rgb(var(--primary-400))` }}>
              Latest student submissions and updates.
            </p>
            <div className="space-y-4">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-9 h-9 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="w-2.5 h-2.5 rounded-full" />
                    </div>
                  ))
                : recentActivity.map((item) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: item.usePrimary
                            ? `rgb(var(--primary-100))`
                            : item.avatarBg,
                        }}
                      >
                        <span
                          className="text-xs font-bold"
                          style={{
                            color: item.usePrimary
                              ? `rgb(var(--primary-700))`
                              : item.avatarText,
                          }}
                        >
                          {item.initials}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: `rgb(var(--primary-800))` }}>
                          {item.name}
                        </p>
                        <p className="text-xs truncate" style={{ color: `rgb(var(--primary-500))` }}>
                          {item.action}
                        </p>
                      </div>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            item.status === 'green'  ? '#34d399' :
                            item.status === 'yellow' ? '#fbbf24' :
                                                       '#f87171',
                        }}
                      />
                    </div>
                  ))
              }
            </div>
          </div>

          {/* Hours Completion */}
          <div
            className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200"
            style={{ border: `1px solid rgb(var(--primary-100))` }}
          >
            <p className="text-sm font-semibold mb-0.5" style={{ color: `rgb(var(--primary-800))` }}>
              Hours completion
            </p>
            <p className="text-xs mb-5" style={{ color: `rgb(var(--primary-400))` }}>
              Average OJT hours logged vs required.
            </p>

            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-28" />
                <Skeleton className="h-12 w-24" />
                <Skeleton className="h-3 w-full rounded-full" />
              </div>
            ) : (
              <>
                <div className="flex items-end gap-8 mb-5">
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: `rgb(var(--primary-400))` }}>Avg hours logged</p>
                    <p className="text-3xl font-bold tabular-nums" style={{ color: `rgb(var(--primary-600))` }}>
                      {avgHours}
                    </p>
                  </div>
                  <div className="pb-1">
                    <p className="text-xs mb-0.5" style={{ color: `rgb(var(--primary-400))` }}>Required</p>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: `rgb(var(--primary-200))` }}>
                      {requiredHours}
                    </p>
                  </div>
                </div>

                <div
                  className="w-full rounded-full h-3 mb-2 relative"
                  style={{ backgroundColor: `rgb(var(--primary-100))` }}
                >
                  <div
                    className="h-3 rounded-full transition-all duration-700"
                    style={{
                      width: `${hoursPct}%`,
                      backgroundColor: `rgb(var(--primary-500))`,
                    }}
                  />
                  <span
                    className="absolute -top-5 text-xs font-bold"
                    style={{
                      left: `${hoursPct}%`,
                      transform: 'translateX(-50%)',
                      color: `rgb(var(--primary-600))`,
                    }}
                  >
                    {hoursPct}%
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mt-4">
                  <CheckCircle className="w-4 h-4 shrink-0" style={{ color: `rgb(var(--primary-500))` }} />
                  <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>
                    Students are on track — {100 - hoursPct}% of required hours remaining on average.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <p className="text-xs text-center pb-2" style={{ color: `rgb(var(--primary-400))` }}>
          Click any card or button to navigate to the corresponding section.
        </p>

      </div>
    </div>
  );
};

export default CoordinatorDashboard;