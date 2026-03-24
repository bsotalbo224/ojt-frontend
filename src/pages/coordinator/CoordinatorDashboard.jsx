import { useEffect, useState } from 'react';
import {
  Users, FileText, BookOpen,
  ArrowUpRight, TrendingUp, Activity,
  Building2, ArrowRight,
} from 'lucide-react';
import { getCoordinatorDashboardStats } from '../../api/stats';
import { useNavigate } from 'react-router-dom';

// ─── Skeleton Cards ────────────────────────────────────────────────────────────

const SkeletonStatCard = () => (
  <div
    className="bg-white rounded-2xl p-6 shadow-sm animate-pulse"
    style={{ border: `1px solid rgb(var(--primary-100))` }}
  >
    <div className="flex items-start justify-between mb-4">
      <div className="w-12 h-12 bg-gray-100 rounded-xl" />
      <div className="w-5 h-5 bg-gray-100 rounded-full" />
    </div>
    <div className="h-8 bg-gray-100 rounded-lg w-16 mb-2" />
    <div className="h-4 bg-gray-100 rounded w-32" />
  </div>
);

const SkeletonWorkflowCard = () => (
  <div
    className="bg-white rounded-xl p-5 animate-pulse"
    style={{ border: `1px solid rgb(var(--primary-100))` }}
  >
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 bg-gray-100 rounded-xl shrink-0" />
      <div className="w-12 h-3 bg-gray-100 rounded-full" />
    </div>
    <div className="h-4 bg-gray-100 rounded w-36 mb-2" />
    <div className="h-3 bg-gray-100 rounded w-full mb-1" />
    <div className="h-3 bg-gray-100 rounded w-3/4 mb-4" />
    <div className="h-3 bg-gray-100 rounded w-20" />
  </div>
);

// ─── Stat Card ─────────────────────────────────────────────────────────────────
// Cards with usePrimary=true render icon bg/color and accent via CSS vars.
// Cards without it (amber, orange) keep Tailwind class strings.

const StatCard = ({ title, value, icon: Icon, iconBg, iconColor, accent, accentStyle, iconStyle, to, usePrimary }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(to)}
      className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer relative overflow-hidden"
      style={{ border: `1px solid rgb(var(--primary-100))` }}
    >
      {/* Accent line */}
      {usePrimary ? (
        <div
          className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
          style={{ backgroundColor: `rgb(var(--primary-400))` }}
        />
      ) : (
        <div className={`absolute top-0 left-0 right-0 h-0.5 ${accent} rounded-t-2xl`} />
      )}

      <div className="flex items-start justify-between mb-4">
        {usePrimary ? (
          <div
            className="w-12 h-12 flex items-center justify-center rounded-xl"
            style={{ backgroundColor: `rgb(var(--primary-100))` }}
          >
            <Icon className="w-5 h-5" style={{ color: `rgb(var(--primary-600))` }} />
          </div>
        ) : (
          <div className={`w-12 h-12 flex items-center justify-center rounded-xl ${iconBg}`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}
        <ArrowUpRight
          className="w-4 h-4 text-gray-300 transition-all duration-200"
          style={{}}
          onMouseEnter={() => {}}
        />
      </div>

      <p className="text-3xl font-bold tabular-nums mb-1" style={{ color: `rgb(var(--primary-800))` }}>
        {value ?? '—'}
      </p>
      <p className="text-sm font-medium" style={{ color: `rgb(var(--primary-600))` }}>{title}</p>
    </div>
  );
};

// ─── Workflow Card ─────────────────────────────────────────────────────────────

const WorkflowCard = ({ step, title, description, icon: Icon, iconBg, iconColor, to, usePrimary }) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(to)}
      className="group bg-white rounded-xl p-5 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 cursor-pointer"
      style={{ border: `1px solid rgb(var(--primary-100))` }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`;
        e.currentTarget.style.borderColor = `rgb(var(--primary-200))`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'white';
        e.currentTarget.style.borderColor = `rgb(var(--primary-100))`;
      }}
    >
      {/* Icon + step label */}
      <div className="flex items-center gap-3 mb-4">
        {usePrimary ? (
          <div
            className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0 group-hover:scale-105 transition-transform duration-200"
            style={{ backgroundColor: `rgb(var(--primary-100))` }}
          >
            <Icon className="w-4 h-4" style={{ color: `rgb(var(--primary-600))` }} />
          </div>
        ) : (
          <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${iconBg} shrink-0 group-hover:scale-105 transition-transform duration-200`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
          </div>
        )}
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: `rgb(var(--primary-300))` }}
        >
          Step {step}
        </span>
      </div>

      <p className="text-sm font-semibold mb-1.5" style={{ color: `rgb(var(--primary-800))` }}>{title}</p>
      <p className="text-xs leading-relaxed" style={{ color: `rgb(var(--primary-500))` }}>{description}</p>

      {/* Bottom link hint */}
      <div
        className="flex items-center gap-1 mt-4 text-xs font-semibold transition-colors duration-200"
        style={{ color: `rgb(var(--primary-400))` }}
        onMouseEnter={e => e.currentTarget.style.color = `rgb(var(--primary-600))`}
        onMouseLeave={e => e.currentTarget.style.color = `rgb(var(--primary-400))`}
      >
        Go to page
        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform duration-200" />
      </div>
    </div>
  );
};

// ─── Coordinator Dashboard ─────────────────────────────────────────────────────

const CoordinatorDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCoordinatorDashboardStats().then((statsData) => {
      setStats(statsData);
      setLoading(false);
    });
  }, []);

  // usePrimary=true  → icon bg/color/accent rendered with CSS vars (green/emerald)
  // usePrimary=false → Tailwind classes used (amber, orange, blue — semantic)
  const statCards = [
    {
      title: 'Total Students',
      value: stats?.totalStudents,
      icon: Users,
      usePrimary: true,
      to: '/coordinator/students',
    },
    {
      title: 'Ongoing OJT',
      value: stats?.ongoing,
      icon: Activity,
      usePrimary: true,
      to: '/coordinator/students',
    },
    {
      title: 'Pending Daily Logs',
      value: stats?.pendingLogs,
      icon: FileText,
      usePrimary: false,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      accent: 'bg-amber-400',
      to: '/coordinator/daily-logs',
    },
    {
      title: 'Pending Narratives',
      value: stats?.pendingNarratives,
      icon: BookOpen,
      usePrimary: false,
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-500',
      accent: 'bg-orange-400',
      to: '/coordinator/narratives',
    },
  ];

  const workflowSteps = [
    {
      step: 1,
      title: 'Review Daily Logs',
      description: 'Check submitted logs and approve or request revisions.',
      icon: FileText,
      usePrimary: false,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      to: '/coordinator/daily-logs',
    },
    {
      step: 2,
      title: 'Evaluate Narratives',
      description: 'Review student narrative reports and provide feedback.',
      icon: BookOpen,
      usePrimary: false,
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-500',
      to: '/coordinator/narratives',
    },
    {
      step: 3,
      title: 'Monitor Student Progress',
      description: 'Track attendance and completed OJT hours.',
      icon: TrendingUp,
      usePrimary: true,
      to: '/coordinator/students',
    },
    {
      step: 4,
      title: 'Assign Companies',
      description: 'Assign partner companies to students when needed.',
      icon: Building2,
      usePrimary: false,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      to: '/coordinator/students',
    },
  ];

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), white, rgb(var(--primary-50) / 0.3))` }}
    >
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
                style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-500)), rgb(var(--primary-600)))` }}
              >
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-2xl font-bold" style={{ color: `rgb(var(--primary-800))` }}>
                Coordinator Dashboard
              </h1>
            </div>
            <p className="text-sm ml-10.5" style={{ color: `rgb(var(--primary-600))` }}>
              Monitor student OJT progress and quickly access important tasks.
            </p>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: `rgb(var(--primary-500))` }}
            >
              Overview
            </h2>
            <div className="flex-1 h-px" style={{ backgroundColor: `rgb(var(--primary-100))` }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
              : statCards.map((card) => <StatCard key={card.title} {...card} />)
            }
          </div>
        </section>

        {/* ── Coordinator Workflow ── */}
        <section>
          <div className="flex items-center gap-2 mb-1">
            <h2
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: `rgb(var(--primary-500))` }}
            >
              Coordinator Workflow
            </h2>
            <div className="flex-1 h-px" style={{ backgroundColor: `rgb(var(--primary-100))` }} />
          </div>
          <p className="text-xs mb-4" style={{ color: `rgb(var(--primary-400))` }}>
            Typical tasks coordinators perform when monitoring student OJT progress.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonWorkflowCard key={i} />)
              : workflowSteps.map((step) => <WorkflowCard key={step.step} {...step} />)
            }
          </div>
        </section>

        {/* ── Footer note ── */}
        {!loading && (
          <p className="text-xs text-center pb-2" style={{ color: `rgb(var(--primary-400))` }}>
            Click any card to navigate to the corresponding section.
          </p>
        )}

      </div>
    </div>
  );
};

export default CoordinatorDashboard;