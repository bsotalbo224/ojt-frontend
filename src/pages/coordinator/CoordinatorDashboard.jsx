import { useEffect, useState, useMemo } from 'react';
import {
  Users, FileText, BookOpen,
  TrendingUp, Activity,
  Building2, ChevronRight, PlusCircle,
  BarChart2, CheckCircle, AlertTriangle,
  LogIn, Coffee, LogOut, Moon, Clock,
  Sun, Zap, Utensils
} from 'lucide-react';
import { getCoordinatorDashboardStats } from '../../api/stats';
import { useNavigate } from 'react-router-dom';

// ─── Skeleton helper ───────────────────────────────────────────────────────────

const Skeleton = ({ className }) => (
  <div className={`animate-pulse rounded ${className}`} style={{ backgroundColor: `rgb(var(--primary-100))` }} />
);

// ─── HoverButton ───────────────────────────────────────────────────────────────

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
  // Local state to toggle workflow preview (helpful for coordinators to see different shift views)
  const [viewShift, setViewShift] = useState('day'); 
  const navigate = useNavigate();

  useEffect(() => {
    getCoordinatorDashboardStats().then((data) => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!stats) return;
    const list = stats.recentActivity;
    if (!list?.length) { setRecentActivity([]); return; }

    setRecentActivity(list.map((n) => {
      const f = (n.f_name ?? '').trim();
      const l = (n.l_name ?? '').trim();
      const fullName = [f, l].filter(Boolean).join(' ') || 'Unknown user';
      const type = n.type === 'narrative' ? 'narrative' : 'log';
      return {
        initials: (f[0] ?? '') + (l[0] ?? '') || fullName.slice(0, 2).toUpperCase(),
        name: fullName,
        action: type === 'narrative' ? 'submitted a narrative' : 'submitted a daily log',
        status: 'green',
        usePrimary: type === 'log',
        avatarBg: type === 'narrative' ? '#faf5ff' : '#fff7ed',
        avatarText: type === 'narrative' ? '#7e22ce' : '#c2410c',
      };
    }));
  }, [stats]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalStudents = stats?.totalStudents ?? 0;
  const ongoing = stats?.ongoing ?? 0;
  const submittedLogs = stats?.submittedLogs ?? 0;
  const submittedNarratives = stats?.submittedNarratives ?? 0;

  const clamp = (v, max) => Math.min(100, Math.max(0, max ? Math.round((v / max) * 100) : 0));
  
  // Shift Analytics
  const dayShiftCount = stats?.dayShiftCount ?? 0;
  const nightShiftCount = stats?.nightShiftCount ?? 0;
  const halfDayCount = stats?.halfDayCount ?? 0;

  // Attendance Summaries
  const workingCount = stats?.workingCount ?? 0;
  const onBreakCount = stats?.onBreakCount ?? 0;
  const onMealCount = stats?.onMealCount ?? 0;
  const otActiveCount = stats?.otActiveCount ?? 0;
  const completedCount = stats?.completedCount ?? 0;

  const attentionRows = [
    {
      label: 'Flagged Attendance',
      sublabel: 'Students not in their assigned location',
      value: stats?.flaggedAttendance ?? 0,
      pct: clamp(stats?.flaggedAttendance ?? 0, 20),
      accentColor: '#ef4444',
      barColor: '#fca5a5',
      textColor: '#b91c1c',
      iconBgColor: '#fff1f2',
      icon: AlertTriangle,
      to: '/coordinator/attendance',
    },
    {
      label: 'Submitted Daily Logs',
      sublabel: null,
      value: submittedLogs,
      pct: clamp(submittedLogs, 50),
      accentColor: '#f97316',
      barColor: '#fdba74',
      textColor: '#c2410c',
      iconBgColor: '#fff7ed',
      icon: FileText,
      to: '/coordinator/daily-logs',
    },
    {
      label: 'Submitted Narratives',
      sublabel: null,
      value: submittedNarratives,
      pct: clamp(submittedNarratives, 50),
      accentColor: '#a855f7',
      barColor: '#d8b4fe',
      textColor: '#7e22ce',
      iconBgColor: '#faf5ff',
      icon: BookOpen,
      to: '/coordinator/narratives',
    },
  ];

  const statCards = [
    { title: 'Total Students', subtitle: 'Total in department', value: totalStudents, pct: clamp(totalStudents, 150), icon: Users, usePrimary: true, to: '/coordinator/students' },
    { title: 'Ongoing OJT', subtitle: 'Students assigned', value: ongoing, pct: clamp(ongoing, totalStudents || 1), icon: Activity, usePrimary: true, to: '/coordinator/students' },
    { title: 'Submitted Daily Logs', subtitle: 'Awaiting review', value: submittedLogs, pct: clamp(submittedLogs, 50), icon: FileText, usePrimary: false, accentColor: '#f97316', iconBgColor: '#fff7ed', barColor: '#fdba74', textColor: '#c2410c', to: '/coordinator/daily-logs' },
    { title: 'Submitted Narratives', subtitle: 'Awaiting review', value: submittedNarratives, pct: clamp(submittedNarratives, 50), icon: BookOpen, usePrimary: false, accentColor: '#a855f7', iconBgColor: '#faf5ff', barColor: '#d8b4fe', textColor: '#7e22ce', to: '/coordinator/narratives' },
  ];

  // Dynamic Shift Cards
  const shiftCards = [
    { label: 'Day Shift', value: dayShiftCount, icon: Sun, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
    { label: 'Night Shift', value: nightShiftCount, icon: Moon, color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
    { label: 'Half-Day', value: halfDayCount, icon: Clock, color: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc' },
  ];

  // Dynamic Workflow Logic
  const getDynamicWorkflow = (shift) => {
    const steps = [
      { Icon: LogIn, label: 'Time In', color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0' },
    ];

    if (shift !== 'half-day') {
      steps.push({
        Icon: shift === 'night' ? Utensils : Coffee,
        label: shift === 'night' ? 'Meal Break' : 'Lunch',
        color: '#f59e0b', bg: '#fffbeb', border: '#fde68a'
      });
    }

    steps.push({ Icon: LogOut, label: 'Time Out', color: '#ef4444', bg: '#fff1f2', border: '#fecaca' });
    steps.push({ Icon: Moon, label: 'Overtime', color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' });

    return steps;
  };

  const attendanceWorkflow = useMemo(() => getDynamicWorkflow(viewShift), [viewShift]);

  const avgHours = stats?.avgHoursLogged ?? 0;
  const requiredHours = stats?.requiredHours ?? 0;
  const hoursPct = Math.min(100, Math.max(0, requiredHours > 0 ? Math.round((avgHours / requiredHours) * 100) : 0));

  const quickActions = [
    { label: 'Create evaluation', icon: PlusCircle, to: '/coordinator/evaluation', disabled: false, baseStyle: { backgroundColor: `rgb(var(--primary-600))`, color: '#fff' }, hoverStyle: { backgroundColor: `rgb(var(--primary-700))` } },
    { label: 'Assign company', icon: Building2, to: '/coordinator/students', disabled: false, baseStyle: { backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }, hoverStyle: { backgroundColor: '#dcfce7' } },
    { label: 'Review logs', icon: FileText, to: '/coordinator/daily-logs', disabled: false, baseStyle: { backgroundColor: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff' }, hoverStyle: { backgroundColor: '#f3e8ff' } },
    { label: 'View analytics', icon: BarChart2, to: null, disabled: true, baseStyle: { backgroundColor: '#f9fafb', color: '#9ca3af', border: '1px solid #e5e7eb', cursor: 'not-allowed' }, hoverStyle: {} },
  ];

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), white, rgb(var(--primary-50) / 0.3))` }}
    >
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between">
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
          
          {/* Attendance Workflow Summary (Badge style) */}
          <div className="hidden md:flex items-center gap-2">
            {[
              { label: 'Working', count: workingCount, color: '#10b981' },
              { label: 'Break', count: onBreakCount, color: '#f59e0b' },
              { label: 'Meal', count: onMealCount, color: '#f97316' },
              { label: 'OT', count: otActiveCount, color: '#8b5cf6' },
              { label: 'Done', count: completedCount, color: '#3b82f6' }
            ].map((s) => (
              <div key={s.label} className="px-3 py-1 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-[10px] font-bold uppercase tracking-tight text-gray-500">{s.label}</span>
                <span className="text-xs font-bold text-gray-800">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm animate-pulse space-y-3" style={{ border: `1px solid rgb(var(--primary-100))` }}>
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
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                    style={{ backgroundColor: card.usePrimary ? `rgb(var(--primary-500))` : card.accentColor }}
                  />
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium" style={{ color: `rgb(var(--primary-500))` }}>{card.title}</p>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: card.usePrimary ? `rgb(var(--primary-100))` : card.iconBgColor }}>
                      <card.icon className="w-3.5 h-3.5" style={{ color: card.usePrimary ? `rgb(var(--primary-600))` : card.accentColor }} />
                    </div>
                  </div>
                  <p className="text-3xl font-bold tabular-nums mb-3" style={{ color: card.usePrimary ? `rgb(var(--primary-700))` : card.textColor }}>
                    {card.value}
                  </p>
                  <div className="w-full rounded-full h-1.5" style={{ backgroundColor: `rgb(var(--primary-100))` }}>
                    <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${card.pct}%`, backgroundColor: card.usePrimary ? `rgb(var(--primary-400))` : card.barColor }} />
                  </div>
                  <p className="text-xs mt-1" style={{ color: `rgb(var(--primary-400))` }}>{card.subtitle}</p>
                </div>
              ))
          }
        </div>

        {/* ── Shift Analytics Indicators ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {shiftCards.map((shift) => (
             <div 
               key={shift.label} 
               className="bg-white/60 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between border"
               style={{ borderColor: `rgb(var(--primary-100))` }}
             >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: shift.bg }}>
                    <shift.icon className="w-5 h-5" style={{ color: shift.color }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{shift.label}</p>
                    <p className="text-lg font-bold text-gray-800">{shift.value} Interns</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-gray-400">{Math.round((shift.value / (totalStudents || 1)) * 100)}%</span>
                </div>
             </div>
          ))}
        </div>

        {/* ── Main 2-col Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200" style={{ border: `1px solid rgb(var(--primary-100))` }}>
            <p className="text-sm font-semibold mb-0.5" style={{ color: `rgb(var(--primary-800))` }}>Quick actions</p>
            <p className="text-xs mb-4" style={{ color: `rgb(var(--primary-400))` }}>Jump to common coordinator tasks.</p>
            <div className="space-y-3">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)
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
                      {!action.disabled && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40" />}
                    </HoverButton>
                  ))
              }
            </div>
          </div>

          {/* Students Needing Attention */}
          <div className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200" style={{ border: `1px solid rgb(var(--primary-100))` }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: `rgb(var(--primary-800))` }}>
                  Students needing attention
                </p>
                <p className="text-xs" style={{ color: `rgb(var(--primary-400))` }}>
                  Incomplete attendance workflow and pending submissions
                </p>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-xs font-bold"
                style={{ backgroundColor: `rgb(var(--primary-50))`, color: `rgb(var(--primary-700))`, border: `1px solid rgb(var(--primary-200))` }}
              >
                {(stats?.flaggedAttendance ?? 0) + submittedLogs + submittedNarratives} total
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
                    <div key={row.label} onClick={() => navigate(row.to)} className="cursor-pointer group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: row.iconBgColor }}>
                            <row.icon className="w-3 h-3" style={{ color: row.accentColor }} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-medium group-hover:underline leading-tight" style={{ color: `rgb(var(--primary-700))` }}>
                              {row.label}
                            </span>
                            {row.sublabel && (
                              <span className="text-xs leading-tight" style={{ color: `rgb(var(--primary-400))` }}>
                                {row.sublabel}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-bold" style={{ color: row.textColor }}>{row.value}</span>
                      </div>
                      <div className="w-full rounded-full h-2" style={{ backgroundColor: `rgb(var(--primary-100))` }}>
                        <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${row.pct}%`, backgroundColor: row.barColor }} />
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
          <div className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200" style={{ border: `1px solid rgb(var(--primary-100))` }}>
            <p className="text-sm font-semibold mb-0.5" style={{ color: `rgb(var(--primary-800))` }}>Recent activity</p>
            <p className="text-xs mb-4" style={{ color: `rgb(var(--primary-400))` }}>Latest student submissions and updates.</p>
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
                        style={{ backgroundColor: item.usePrimary ? `rgb(var(--primary-100))` : item.avatarBg }}
                      >
                        <span className="text-xs font-bold" style={{ color: item.usePrimary ? `rgb(var(--primary-700))` : item.avatarText }}>
                          {item.initials}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: `rgb(var(--primary-800))` }}>{item.name}</p>
                        <p className="text-xs truncate" style={{ color: `rgb(var(--primary-500))` }}>{item.action}</p>
                      </div>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.status === 'green' ? '#34d399' : item.status === 'yellow' ? '#fbbf24' : '#f87171' }}
                      />
                    </div>
                  ))
              }
            </div>
          </div>

          {/* Hours Completion */}
          <div className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200" style={{ border: `1px solid rgb(var(--primary-100))` }}>
            <div className="flex justify-between items-start mb-1">
              <p className="text-sm font-semibold" style={{ color: `rgb(var(--primary-800))` }}>Hours completion</p>
              <div className="flex gap-1">
                 {['day', 'night', 'half-day'].map(s => (
                   <button 
                     key={s} 
                     onClick={() => setViewShift(s)}
                     className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${viewShift === s ? 'bg-primary-500 text-white' : 'bg-gray-50 text-gray-400'}`}
                     style={{ backgroundColor: viewShift === s ? `rgb(var(--primary-500))` : '', borderColor: `rgb(var(--primary-200))` }}
                   >
                     {s.toUpperCase()}
                   </button>
                 ))}
              </div>
            </div>
            <p className="text-xs mb-1" style={{ color: `rgb(var(--primary-400))` }}>
              Average rendered work hours
            </p>
            <p className="text-xs mb-5" style={{ color: `rgb(var(--primary-300))` }}>
              Includes regular work hours and overtime
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
                    <p className="text-3xl font-bold tabular-nums" style={{ color: `rgb(var(--primary-600))` }}>{avgHours}</p>
                  </div>
                  <div className="pb-1">
                    <p className="text-xs mb-0.5" style={{ color: `rgb(var(--primary-400))` }}>Required</p>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: `rgb(var(--primary-200))` }}>{requiredHours}</p>
                  </div>
                </div>

                <div className="w-full rounded-full h-3 mb-2 relative" style={{ backgroundColor: `rgb(var(--primary-100))` }}>
                  <div
                    className="h-3 rounded-full transition-all duration-700"
                    style={{ width: `${hoursPct}%`, backgroundColor: `rgb(var(--primary-500))` }}
                  />
                  <span
                    className="absolute -top-5 text-xs font-bold"
                    style={{ left: `${hoursPct}%`, transform: 'translateX(-50%)', color: `rgb(var(--primary-600))` }}
                  >
                    {hoursPct}%
                  </span>
                </div>

                {/* Dynamic Attendance Workflow indicators */}
                <div className="flex items-center gap-2 mt-4 mb-3 flex-wrap">
                  {attendanceWorkflow.map(({ Icon, label, color, bg, border }) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight"
                      style={{ backgroundColor: bg, color, border: `1px solid ${border}` }}
                    >
                      <Icon className="w-2.5 h-2.5" />
                      {label}
                    </span>
                  ))}
                </div>

                {/* Work Structure Insight (Dynamic Text) */}
                <div
                  className="rounded-xl p-3 mt-1"
                  style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}
                >
                  <p className="text-xs font-semibold mb-1" style={{ color: `rgb(var(--primary-700))` }}>
                    Work Structure Insight
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: `rgb(var(--primary-500))` }}>
                    Students follow flexible company-assigned schedules including <strong>overnight attendance</strong> for night shifts. 
                    {viewShift === 'night' ? ' Meal breaks' : ' Lunch breaks'} are logged manually or auto-deducted. 
                    Overtime supports flexible schedules across all shift types.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 mt-4">
                  <CheckCircle className="w-4 h-4 shrink-0" style={{ color: `rgb(var(--primary-500))` }} />
                  <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>
                    {requiredHours === 0
                      ? 'No required hours data available.'
                      : `Progress varies by shift — ${viewShift === 'half-day' ? 'Half-day' : 'Full-time'} students are currently averaging ${hoursPct}% completion.`
                    }
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