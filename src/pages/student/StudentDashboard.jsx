import { useEffect, useState } from 'react';
import {
  Award, Calendar, Building2, User, Info,
  Clock, CheckCircle2, ChevronRight, Loader2,
  LogIn, LogOut, Coffee, UtensilsCrossed, Moon, Sunrise,
} from 'lucide-react';
import { getStudentAttendance, timeIn, timeOut, startLunchBreak, endLunchBreak } from '../../api/attendance';
import { getStudentAssignment } from '../../api/student';

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const formatTime = (timeString) => {
  if (!timeString) return null;
  const [h, m] = timeString.split(':');
  const d = new Date();
  d.setHours(parseInt(h), parseInt(m), 0);
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatDate = () =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

const getCurrentTimeHHMM = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

/* ─────────────────────────────────────────────
   WORKFLOW STEPS CONFIG
───────────────────────────────────────────── */
const WORKFLOW = [
  { key: 'time_in',           label: 'Time In',      Icon: LogIn,          color: '#10b981', shortLabel: 'In'         },
  { key: 'lunch_break_start', label: 'Lunch Start',  Icon: Coffee,         color: '#f59e0b', shortLabel: 'Lunch'      },
  { key: 'lunch_break_end',   label: 'Lunch End',    Icon: UtensilsCrossed,color: '#f97316', shortLabel: 'Resume'     },
  { key: 'time_out',          label: 'Time Out',     Icon: LogOut,         color: '#ef4444', shortLabel: 'Out'        },
  { key: 'ot_time_in',        label: 'OT Start',     Icon: Moon,           color: '#8b5cf6', shortLabel: 'OT In'      },
  { key: 'ot_time_out',       label: 'OT End',       Icon: Sunrise,        color: '#6366f1', shortLabel: 'OT Out'     },
];

/* ─────────────────────────────────────────────
   NEXT ACTION LOGIC
───────────────────────────────────────────── */
const getNextAction = (att) => {
  if (!att?.time_in)           return { ...WORKFLOW[0], type: 'time_in'           };
  if (!att?.lunch_break_start) return { ...WORKFLOW[1], type: 'lunch_break_start' };
  if (!att?.lunch_break_end)   return { ...WORKFLOW[2], type: 'lunch_break_end'   };
  if (!att?.time_out)          return { ...WORKFLOW[3], type: 'time_out'          };
  if (!att?.ot_time_in)        return { ...WORKFLOW[4], type: 'ot_time_in'        };
  if (!att?.ot_time_out)       return { ...WORKFLOW[5], type: 'ot_time_out'       };
  return null;
};

const getStepsDone = (att) => {
  if (!att) return 0;
  return WORKFLOW.filter(s => att[s.key]).length;
};

/* ─────────────────────────────────────────────
   PROGRESS STEPPER
───────────────────────────────────────────── */
const ProgressStepper = ({ attendance }) => {
  const done = getStepsDone(attendance);
  return (
    <div className="flex items-center mb-5">
      {WORKFLOW.map((step, i) => {
        const isComplete = i < done;
        const isCurrent  = i === done;
        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center shrink-0">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300"
                style={{
                  background: isComplete ? step.color : isCurrent ? `rgb(var(--primary-600))` : '#e5e7eb',
                  color: isComplete || isCurrent ? 'white' : '#9ca3af',
                  boxShadow: isCurrent ? `0 0 0 3px rgb(var(--primary-200))` : 'none',
                }}
              >
                {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <p
                className="text-[9px] font-semibold mt-1 text-center whitespace-nowrap"
                style={{ color: isComplete ? step.color : isCurrent ? `rgb(var(--primary-700))` : '#9ca3af' }}
              >
                {step.shortLabel}
              </p>
            </div>
            {i < WORKFLOW.length - 1 && (
              <div
                className="h-0.5 flex-1 mx-1 rounded-full transition-all duration-500"
                style={{ background: i < done ? '#22c55e' : '#e5e7eb' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ─────────────────────────────────────────────
   WORKFLOW STEP CARD
───────────────────────────────────────────── */
const WorkflowStepCard = ({ step, value, isActive }) => {
  const { label, Icon, color } = step;
  const isComplete = !!value;

  const cardBg     = isComplete ? '#f0fdf4' : isActive ? '#fafafa'      : '#f9fafb';
  const cardBorder = isComplete ? '#bbf7d0' : isActive ? `${color}40`   : '#e5e7eb';
  const iconBg     = isComplete ? '#dcfce7' : isActive ? `${color}15`   : '#f3f4f6';
  const iconBorder = isComplete ? '#bbf7d0' : isActive ? `${color}40`   : '#e5e7eb';
  const iconColor  = isComplete ? '#22c55e' : isActive ? color           : '#9ca3af';

  return (
    <div
      className="rounded-xl p-3.5 transition-all duration-300"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: isActive ? `0 0 0 2px ${color}25` : 'none',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: iconBg, border: `1px solid ${iconBorder}` }}
        >
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
          <p className={`text-sm font-bold tabular-nums ${isComplete ? 'text-gray-900' : 'text-gray-400'}`}>
            {formatTime(value) ?? '—'}
          </p>
        </div>
        {isComplete && (
          <div className="shrink-0">
            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#dcfce7' }}>
              <CheckCircle2 className="w-3 h-3 text-green-600" />
            </div>
          </div>
        )}
        {isActive && !isComplete && (
          <div
            className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: `${color}15`, color }}
          >
            Next
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────── */
const StudentDashboard = () => {
  const [attendance,       setAttendance]       = useState(null);
  const [attendanceLoading,setAttendanceLoading]= useState(false);
  const [attendanceError,  setAttendanceError]  = useState(null);
  const [actionLoading,    setActionLoading]    = useState(false);
  const [assignment,       setAssignment]       = useState(null);

  /* ── Fetch ── */
  const fetchAttendance = async () => {
    try {
      setAttendanceLoading(true);
      const data = await getStudentAttendance();
      setAttendance(prev => (data ? data : prev));
      setAttendanceError(null);
    } catch (err) {
      setAttendanceError(err.message || 'Failed to load attendance');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchAssignment = async () => {
    try {
      const res = await getStudentAssignment();
      if (res.success) setAssignment(res.data);
    } catch { console.error('Assignment load failed'); }
  };

  useEffect(() => { fetchAttendance(); fetchAssignment(); }, []);

  /* ── Optimistic helpers ── */
  const applyOptimistic = (field) =>
    setAttendance(prev => ({ ...(prev || {}), [field]: getCurrentTimeHHMM() }));

  const revert = (snapshot) => setAttendance(snapshot);

  /* ── Action dispatcher ── */
  const handleNextAction = () => {
    if (actionLoading) return;
    const action = getNextAction(attendance);
    if (!action) return;

    const snapshot = attendance;
    const { type } = action;

    const runAction = async (apiFn) => {
      try {
        applyOptimistic(type);
        const data = await apiFn();
        if (data?.success === false) {
          revert(snapshot);
          setAttendanceError(data.message);
          return;
        }
        await fetchAttendance();
      } catch {
        revert(snapshot);
        setAttendanceError(`Action failed — please try again.`);
      } finally {
        setActionLoading(false);
      }
    };

    setActionLoading(true);

    if (type === 'time_in') {
      navigator.geolocation.getCurrentPosition(
        async ({ coords: { latitude, longitude } }) => {
          await runAction(() => timeIn(latitude, longitude));
        },
        () => {
          setAttendanceError('Location permission required for time-in.');
          setActionLoading(false);
        }
      );
    } else if (type === 'lunch_break_start') {
      runAction(() => startLunchBreak());
    } else if (type === 'lunch_break_end') {
      runAction(() => endLunchBreak());
    } else if (type === 'time_out') {
      runAction(() => timeOut());
    } else if (type === 'ot_time_in') {
      navigator.geolocation.getCurrentPosition(
        async ({ coords: { latitude, longitude } }) => {
          await runAction(() => timeIn(latitude, longitude, 'ot'));
        },
        () => {
          setAttendanceError('Location permission required for OT time-in.');
          setActionLoading(false);
        }
      );
    } else if (type === 'ot_time_out') {
      runAction(() => timeOut('ot'));
    }
  };

  const nextAction  = getNextAction(attendance);
  const allComplete = !nextAction;

  return (
    <div className="h-full" style={{ background: 'linear-gradient(to bottom, rgb(var(--primary-50)), white, rgb(var(--primary-50)))' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* PAGE HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-700)), rgb(var(--primary-800)))` }}
            >
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-xs text-gray-500">Track your attendance and view OJT details</p>
            </div>
          </div>
          <div
            className="bg-white rounded-lg px-4 py-2 shadow-sm"
            style={{ border: '1px solid rgb(var(--primary-400) / 0.4)' }}
          >
            <p className="text-sm font-semibold text-gray-700">{formatDate()}</p>
          </div>
        </div>

        {/* TODAY'S ATTENDANCE */}
        <div
          className="bg-white rounded-xl shadow-md p-6 mb-5"
          style={{ border: '1px solid rgb(var(--primary-400) / 0.4)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5" style={{ color: `rgb(var(--primary-700))` }} />
            <h2 className="text-lg font-bold text-gray-900">Today's Attendance</h2>
          </div>

          {attendanceLoading ? (
            <div className="flex justify-center items-center py-12">
              <div
                className="w-8 h-8 rounded-full animate-spin"
                style={{ border: `3px solid rgb(var(--primary-100))`, borderTopColor: `rgb(var(--primary-600))` }}
              />
            </div>
          ) : (
            <div className="space-y-5">

              {/* Progress stepper */}
              <ProgressStepper attendance={attendance} />

              {/* Workflow step cards — 2 cols on sm, 3 on lg */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {WORKFLOW.map((step) => (
                  <WorkflowStepCard
                    key={step.key}
                    step={step}
                    value={attendance?.[step.key]}
                    isActive={nextAction?.key === step.key}
                  />
                ))}
              </div>

              {/* Primary action button */}
              {allComplete ? (
                <div
                  className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm"
                  style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a' }}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>All Steps Completed — Great work today!</span>
                </div>
              ) : (
                <button
                  onClick={handleNextAction}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-200 active:scale-[0.98]"
                  style={{
                    background: actionLoading
                      ? '#9ca3af'
                      : `linear-gradient(135deg, ${nextAction.color}, ${nextAction.color}cc)`,
                    boxShadow: actionLoading ? 'none' : `0 4px 14px ${nextAction.color}45`,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing…</span>
                    </>
                  ) : (
                    <>
                      <nextAction.Icon className="w-4 h-4" />
                      <span>{nextAction.label}</span>
                      <ChevronRight className="w-4 h-4 opacity-70" />
                    </>
                  )}
                </button>
              )}

              {/* Error */}
              {attendanceError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  <p className="text-red-700 text-sm font-medium">{attendanceError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECONDARY: OJT + GUIDELINES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* OJT ASSIGNMENT */}
          <div
            className="bg-white rounded-xl shadow-md p-5"
            style={{ border: '1px solid rgb(var(--primary-400) / 0.4)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5" style={{ color: `rgb(var(--primary-700))` }} />
              <h2 className="text-lg font-bold text-gray-900">OJT Assignment</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Assigned Company</label>
                <p className="text-sm font-semibold text-gray-900">{assignment?.company || 'Not assigned'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Course</label>
                <p className="text-sm font-semibold text-gray-900">{assignment?.course || '—'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Required Hours</label>
                  <p className="text-sm font-semibold text-gray-900">{assignment?.required_hours || '—'} hours</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Coordinator</label>
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-gray-500" />
                    {assignment?.coordinator || '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* GUIDELINES */}
          <div
            className="bg-white rounded-xl shadow-md p-5"
            style={{ border: '1px solid rgb(var(--primary-400) / 0.4)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-5 h-5" style={{ color: `rgb(var(--primary-700))` }} />
              <h2 className="text-lg font-bold text-gray-900">Attendance Guidelines</h2>
            </div>
            <div className="space-y-2.5">
              {[
                'Lunch break logging is required every working day',
                'OT is optional — only log if instructed by your supervisor',
                'Attendance timing follows your assigned schedule',
                'Lunch deduction acts as an automatic backup if not logged',
                'Location verification is captured during Time In',
              ].map((text) => (
                <div key={text} className="flex items-start gap-2.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                    style={{ backgroundColor: `rgb(var(--primary-600))` }}
                  />
                  <p className="text-sm text-gray-700">{text}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;