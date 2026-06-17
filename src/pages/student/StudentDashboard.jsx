import { useEffect, useState, useMemo } from 'react';
import {
  Award, Calendar, Building2, User, Info,
  CheckCircle2, ChevronRight, Loader2,
  LogIn, LogOut, Coffee, UtensilsCrossed, Moon, Sunrise,
  Clock, Zap, Paperclip,
} from 'lucide-react';
import { getStudentAttendance, timeIn, timeOut, startLunchBreak, endLunchBreak } from '../../api/attendance';
import { getStudentAssignment } from '../../api/student';

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const formatTime = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':');
  const d = new Date();
  d.setHours(parseInt(h), parseInt(m), 0);
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatDate = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

const getCurrentTimeHHMM = () => {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
};

/** "08:30:00" or "08:30" → total minutes */
const toMins = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return isNaN(h) ? null : h * 60 + m;
};

/* ─────────────────────────────────────────────
   SCHEDULE ANALYSIS
   Accepts snake_case fields directly from the API.
───────────────────────────────────────────── */
const analyzeSchedule = (start_time, end_time) => {
  const s = toMins(start_time);
  const e = toMins(end_time);
  if (s == null || e == null) {
    return { isNightShift: false, isHalfDay: false, shiftMins: 480, shiftType: 'Day Shift' };
  }

  const isNightShift = e < s; // end clock-value is "earlier" → crosses midnight
  const shiftMins = isNightShift ? (1440 - s + e) : (e - s);
  const isHalfDay = shiftMins < 300; // < 5 hours

  let shiftType = 'Day Shift';
  if (isHalfDay) shiftType = 'Half Day';
  else if (isNightShift) shiftType = 'Night Shift';

  return { isNightShift, isHalfDay, shiftMins, shiftType };
};

/* ─────────────────────────────────────────────
   DYNAMIC WORKFLOW BUILDER
───────────────────────────────────────────── */
const BREAK_LABELS = {
  day: { start: 'Lunch Start', end: 'Lunch End', short: 'Lunch', shortEnd: 'Resume' },
  night: { start: 'Meal Start', end: 'Meal End', short: 'Meal', shortEnd: 'Resume' },
};

const buildWorkflow = ({ requiresLunch, isNightShift }) => {
  const bl = isNightShift ? BREAK_LABELS.night : BREAK_LABELS.day;
  const steps = [
    { key: 'time_in', label: 'Time In', Icon: LogIn, color: '#10b981', shortLabel: 'In' },
  ];
  if (requiresLunch) {
    steps.push(
      { key: 'lunch_break_start', label: bl.start, Icon: Coffee, color: '#f59e0b', shortLabel: bl.short },
      { key: 'lunch_break_end', label: bl.end, Icon: UtensilsCrossed, color: '#f97316', shortLabel: bl.shortEnd },
    );
  }
  steps.push(
    { key: 'time_out', label: 'Time Out', Icon: LogOut, color: '#ef4444', shortLabel: 'Out' },
  );
  return steps;
};

// OT steps are always separate / optional
const OT_STEPS = [
  { key: 'ot_time_in', label: 'Start Overtime', Icon: Moon, color: '#8b5cf6', shortLabel: 'OT In' },
  { key: 'ot_time_out', label: 'End Overtime', Icon: Sunrise, color: '#6366f1', shortLabel: 'OT Out' },
];

/* ─────────────────────────────────────────────
   NEXT ACTION LOGIC (workflow-aware)
───────────────────────────────────────────── */
const getNextRequiredAction = (att, workflow) => {
  for (const step of workflow) {
    if (!att?.[step.key]) return { ...step, type: step.key };
  }
  return null; // required workflow complete
};

const getNextOtAction = (att) => {
  if (!att?.ot_time_in) return { ...OT_STEPS[0], type: 'ot_time_in' };
  if (!att?.ot_time_out) return { ...OT_STEPS[1], type: 'ot_time_out' };
  return null;
};

/* ─────────────────────────────────────────────
   SHIFT TYPE BADGE
───────────────────────────────────────────── */
const ShiftBadge = ({ shiftType }) => {
  const map = {
    'Half Day': { bg: '#fefce8', border: '#fde68a', text: '#a16207' },
    'Day Shift': { bg: `rgb(var(--primary-50))`, border: `rgb(var(--primary-200))`, text: `rgb(var(--primary-700))` },
    'Night Shift': { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' },
  };
  const s = map[shiftType] ?? map['Day Shift'];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      <Clock className="w-2.5 h-2.5" />{shiftType}
    </span>
  );
};

/* ─────────────────────────────────────────────
   PROGRESS STEPPER (dynamic)
───────────────────────────────────────────── */
const ProgressStepper = ({ attendance, workflow }) => {
  return (
    <div className="flex items-center mb-5">
      {workflow.map((step, i) => {
        const isComplete = !!attendance?.[step.key];
        const isCurrent = !isComplete && workflow.slice(0, i).every(s => !!attendance?.[s.key]);
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
            {i < workflow.length - 1 && (
              <div
                className="h-0.5 flex-1 mx-1 rounded-full transition-all duration-500"
                style={{ background: isComplete ? '#22c55e' : '#e5e7eb' }}
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
  const cardBg = isComplete ? '#f0fdf4' : isActive ? '#fafafa' : '#f9fafb';
  const cardBorder = isComplete ? '#bbf7d0' : isActive ? `${color}40` : '#e5e7eb';
  const iconBg = isComplete ? '#dcfce7' : isActive ? `${color}15` : '#f3f4f6';
  const iconBorder = isComplete ? '#bbf7d0' : isActive ? `${color}40` : '#e5e7eb';
  const iconColor = isComplete ? '#22c55e' : isActive ? color : '#9ca3af';

  return (
    <div
      className="rounded-xl p-3.5 transition-all duration-300"
      style={{ background: cardBg, border: `1px solid ${cardBorder}`, boxShadow: isActive ? `0 0 0 2px ${color}25` : 'none' }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg, border: `1px solid ${iconBorder}` }}>
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
          <p className={`text-sm font-bold tabular-nums ${isComplete ? 'text-gray-900' : 'text-gray-400'}`}>
            {formatTime(value) ?? '—'}
          </p>
        </div>
        {isComplete && (
          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: '#dcfce7' }}>
            <CheckCircle2 className="w-3 h-3 text-green-600" />
          </div>
        )}
        {isActive && !isComplete && (
          <div className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${color}15`, color }}>
            Next
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   OT CARD (small, secondary)
───────────────────────────────────────────── */
const OtCard = ({ step, value }) => {
  const isComplete = !!value;
  return (
    <div
      className="rounded-xl p-3 flex items-center gap-2.5 transition-all duration-300"
      style={{
        background: isComplete ? '#f5f3ff' : '#fafafa',
        border: `1px solid ${isComplete ? '#ddd6fe' : '#e5e7eb'}`,
      }}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: isComplete ? '#ede9fe' : '#f3f4f6', border: `1px solid ${isComplete ? '#c4b5fd' : '#e5e7eb'}` }}>
        <step.Icon className="w-3.5 h-3.5" style={{ color: isComplete ? '#7c3aed' : '#9ca3af' }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isComplete ? '#7c3aed' : '#9ca3af' }}>{step.label}</p>
        <p className={`text-xs font-bold tabular-nums ${isComplete ? 'text-gray-800' : 'text-gray-400'}`}>
          {formatTime(value) ?? '—'}
        </p>
      </div>
      {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />}
    </div>
  );
};

/* ─────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────── */
const StudentDashboard = () => {
  const [attendance, setAttendance] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [otLoading, setOtLoading] = useState(false);
  const [assignment, setAssignment] = useState(null);
  const [assignmentLoaded, setAssignmentLoaded] = useState(false);
  const [otExpanded, setOtExpanded] = useState(false);

  // Early attendance state
  const [showEarlyModal, setShowEarlyModal] = useState(false);
  const [earlyReason, setEarlyReason] = useState('');
  const [earlyAttachment, setEarlyAttachment] = useState(null);
  const [pendingCoords, setPendingCoords] = useState(null);

  /* ── Fetch ── */
  const fetchAttendance = async () => {
    try {
      setAttendanceLoading(true);
      const data = await getStudentAttendance();
      setAttendance(data || null);
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
      if (res?.success) {
        setAssignment(res.data || null);
      }
    } catch (err) {
      console.error("Assignment load failed", err);
    } finally {
      setAssignmentLoaded(true);
    }
  };

  // Load assignment first so schedule is ready before workflow computes.
  useEffect(() => {
    const init = async () => {
      await fetchAssignment();
      await fetchAttendance();
    };
    init();
  }, []);

  /* ── Schedule analysis ── */
  const startTime = assignment?.start_time ?? null;
  const endTime = assignment?.end_time ?? null;

  const schedule = useMemo(
    () => analyzeSchedule(startTime, endTime),
    [startTime, endTime],
  );

  /* ── Dynamic workflow ── */
  const { isHalfDay, isNightShift, shiftType } = schedule;

  const workflow = useMemo(() => {
    if (!assignmentLoaded) return [];
    return buildWorkflow({
      requiresLunch: !isHalfDay,
      isNightShift,
    });
  }, [assignmentLoaded, isHalfDay, isNightShift]);

  /* ── Optimistic helpers ── */
  const applyOptimistic = (field) =>
    setAttendance(prev => ({ ...(prev || {}), [field]: getCurrentTimeHHMM() }));
  const revert = (snapshot) => setAttendance(snapshot);

  /* ── Generic action runner ── */
  const runAction = async (field, apiFn, setLoading) => {
    const snapshot = attendance;
    setLoading(true);
    try {
      applyOptimistic(field);
      const data = await apiFn();
      if (data?.success === false) { revert(snapshot); setAttendanceError(data.message); return; }
      await fetchAttendance();
    } catch {
      revert(snapshot);
      setAttendanceError('Action failed — please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Dedicated Time In handler (supports early attendance) ── */
  const handleTimeIn = async (
    latitude,
    longitude,
    reason = null,
    attachment = null
  ) => {
    const snapshot = attendance;
    setActionLoading(true);
    applyOptimistic('time_in');
    try {
      await timeIn(latitude, longitude, reason, attachment);
      await fetchAttendance();
      setAttendanceError(null);
      return true;
    } catch (err) {
      revert(snapshot);
      if (
        err.message === 'Reason is required for early attendance.' ||
        err.message === 'Attachment is required for early attendance.'
      ) {
        setPendingCoords({ latitude, longitude });
        setShowEarlyModal(true);
        setAttendanceError(null);
      } else {
        setAttendanceError(err.message || 'Action failed — please try again.');
      }
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Early reason submit handler ── */
  const submitEarlyReason = async () => {
    if (actionLoading) return;

    if (!earlyReason.trim()) {
      setAttendanceError('Reason is required.');
      return;
    }
    if (!earlyAttachment) {
      setAttendanceError('Attachment is required.');
      return;
    }
    if (!pendingCoords) return;

    const success = await handleTimeIn(
      pendingCoords.latitude,
      pendingCoords.longitude,
      earlyReason,
      earlyAttachment
    );

    if (!success) return;

    // Only reached on success
    setShowEarlyModal(false);
    setEarlyReason('');
    setEarlyAttachment(null);
    setPendingCoords(null);
  };

  /* ── Primary action ── */
  const handleNextAction = () => {
    if (actionLoading) return;
    const action = getNextRequiredAction(attendance, workflow);
    if (!action) return;
    const { type } = action;

    if (type === 'time_in') {
      setActionLoading(true);
      navigator.geolocation.getCurrentPosition(
        ({ coords: { latitude, longitude } }) => {
          handleTimeIn(latitude, longitude);
        },
        () => {
          setAttendanceError('Location permission required for attendance logging. Please enable GPS/location services.');
          setActionLoading(false);
        }
      );
    } else if (type === 'lunch_break_start') {
      runAction('lunch_break_start', () => startLunchBreak(), setActionLoading);
    } else if (type === 'lunch_break_end') {
      runAction('lunch_break_end', () => endLunchBreak(), setActionLoading);
    } else if (type === 'time_out') {
      runAction('time_out', () => timeOut(), setActionLoading);
    }
  };

  /* ── OT action ── */
  const handleOtAction = () => {
    if (otLoading) return;
    const action = getNextOtAction(attendance);
    if (!action) return;
    const { type } = action;

    if (type === 'ot_time_in') {
      navigator.geolocation.getCurrentPosition(
        ({ coords: { latitude, longitude } }) =>
          runAction('ot_time_in', () => timeIn(latitude, longitude), setOtLoading),
        () => {
          setAttendanceError('Location permission required for attendance logging. Please enable GPS/location services.');
          setOtLoading(false);
        }
      );
    } else if (type === 'ot_time_out') {
      runAction('ot_time_out', () => timeOut(), setOtLoading);
    }
  };

  const nextAction = workflow.length > 0 ? getNextRequiredAction(attendance, workflow) : null;
  const nextOtAction = getNextOtAction(attendance);
  const requiredDone = !nextAction;
  const otDone = !nextOtAction;
  const hasOtStarted = !!attendance?.ot_time_in;

  // Auto-expand OT section when OT has already been started
  const showOtExpanded = otExpanded || hasOtStarted;

  // Active step key drives card highlight
  const activeStepKey = nextAction?.key ?? null;

  // Hold the full render until both assignment and attendance have resolved
  const isInitializing = attendanceLoading && !assignmentLoaded;

  return (
    <div className="h-full" style={{ background: 'linear-gradient(to bottom, rgb(var(--primary-50)), white, rgb(var(--primary-50)))' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* PAGE HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-700)), rgb(var(--primary-800)))` }}>
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-xs text-gray-500">Track your attendance and view OJT details</p>
            </div>
          </div>
          <div className="bg-white rounded-lg px-4 py-2 shadow-sm" style={{ border: '1px solid rgb(var(--primary-400) / 0.4)' }}>
            <p className="text-sm font-semibold text-gray-700">{formatDate()}</p>
          </div>
        </div>

        {/* TODAY'S ATTENDANCE */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-5" style={{ border: '1px solid rgb(var(--primary-400) / 0.4)' }}>
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" style={{ color: `rgb(var(--primary-700))` }} />
              <h2 className="text-lg font-bold text-gray-900">Today's Attendance</h2>
            </div>
            {startTime && <ShiftBadge shiftType={shiftType} />}
          </div>

          {/* Spinner until both assignment + attendance are ready */}
          {(isInitializing || attendanceLoading) ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-8 h-8 rounded-full animate-spin"
                style={{ border: `3px solid rgb(var(--primary-100))`, borderTopColor: `rgb(var(--primary-600))` }} />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Dynamic progress stepper */}
              {workflow.length > 0 && (
                <ProgressStepper
                  attendance={attendance}
                  workflow={workflow}
                />
              )}

              {/* Dynamic workflow step cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {workflow.length > 0 && workflow.map((step) => (
                  <WorkflowStepCard
                    key={step.key}
                    step={step}
                    value={attendance?.[step.key]}
                    isActive={activeStepKey === step.key}
                  />
                ))}
              </div>

              {/* Primary action button */}
              {!requiredDone ? (
                <button
                  onClick={handleNextAction}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-200 active:scale-[0.98]"
                  style={{
                    background: actionLoading ? '#9ca3af' : `linear-gradient(135deg, ${nextAction.color}, ${nextAction.color}cc)`,
                    boxShadow: actionLoading ? 'none' : `0 4px 14px ${nextAction.color}45`,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {actionLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /><span>Processing…</span></>
                  ) : (
                    <><nextAction.Icon className="w-4 h-4" /><span>{nextAction.label}</span><ChevronRight className="w-4 h-4 opacity-70" /></>
                  )}
                </button>
              ) : (
                <div className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm"
                  style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a' }}>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Attendance successfully recorded.</span>
                </div>
              )}

              {/* OT Section — only shown after required workflow is complete */}
              {requiredDone && (
                <div className="rounded-xl transition-all duration-300" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>

                  {/* OT Header */}
                  <button
                    onClick={() => !hasOtStarted && setOtExpanded(prev => !prev)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3"
                    style={{ cursor: hasOtStarted ? 'default' : 'pointer' }}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-violet-500" />
                      <p className="text-xs font-bold text-violet-700 uppercase tracking-wider">Overtime (Optional)</p>
                    </div>
                    {!hasOtStarted && (
                      <span className="text-[10px] font-semibold text-violet-400">
                        {showOtExpanded ? 'Hide ▲' : 'Start OT ▼'}
                      </span>
                    )}
                  </button>

                  {showOtExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        {OT_STEPS.map((step) => (
                          <OtCard key={step.key} step={step} value={attendance?.[step.key]} />
                        ))}
                      </div>

                      {!otDone ? (
                        <button
                          onClick={handleOtAction}
                          disabled={otLoading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
                          style={{
                            background: otLoading ? '#e9d5ff' : '#7c3aed',
                            color: 'white',
                            opacity: otLoading ? 0.7 : 1,
                            cursor: otLoading ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {otLoading ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Processing…</span></>
                          ) : (
                            <><nextOtAction.Icon className="w-3.5 h-3.5" /><span>{nextOtAction.label}</span></>
                          )}
                        </button>
                      ) : (
                        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-violet-600 py-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          Overtime Completed
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
          <div className="bg-white rounded-xl shadow-md p-5" style={{ border: '1px solid rgb(var(--primary-400) / 0.4)' }}>
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

              {/* Work Schedule */}
              {(startTime || endTime) && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Work Schedule</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatTime(startTime) ?? '—'} → {formatTime(endTime) ?? '—'}
                    </p>
                    <ShiftBadge shiftType={shiftType} />
                  </div>
                </div>
              )}

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
          <div className="bg-white rounded-xl shadow-md p-5" style={{ border: '1px solid rgb(var(--primary-400) / 0.4)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-5 h-5" style={{ color: `rgb(var(--primary-700))` }} />
              <h2 className="text-lg font-bold text-gray-900">Attendance Guidelines</h2>
            </div>
            <div className="space-y-2.5">
              {[
                'Meal/lunch break logging is recommended for long work shifts',
                'Overtime is optional — only log if instructed by your supervisor',
                'Attendance workflow adapts to your assigned work schedule',
                'Lunch auto-deduction acts as a fallback if break is not logged',
                'Location verification is captured during Time In',
              ].map((text) => (
                <div key={text} className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: `rgb(var(--primary-600))` }} />
                  <p className="text-sm text-gray-700">{text}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* EARLY ATTENDANCE MODAL */}
      {showEarlyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.5)' }}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
            style={{ border: '1px solid rgb(var(--primary-200))' }}
          >
            {/* Modal header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgb(var(--primary-50))', border: '1px solid rgb(var(--primary-200))' }}
              >
                <Sunrise className="w-5 h-5" style={{ color: 'rgb(var(--primary-700))' }} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Early Attendance Detected</h3>
                <p className="text-xs text-gray-500 mt-0.5">A reason and attachment are required to proceed</p>
              </div>
            </div>

            {/* Message */}
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              You are logging attendance earlier than your assigned schedule.
              Please provide a reason and attach a supporting document.
            </p>

            {/* Reason textarea */}
            <textarea
              value={earlyReason}
              onChange={(e) => setEarlyReason(e.target.value)}
              placeholder="Enter reason..."
              rows={3}
              className="w-full text-sm text-gray-800 placeholder-gray-400 rounded-xl px-4 py-3 resize-none focus:outline-none transition-all duration-200"
              style={{
                border: '1px solid #e5e7eb',
                background: '#f9fafb',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'rgb(var(--primary-400))'; e.target.style.background = '#fff'; }}
              onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; }}
            />

            {/* File upload */}
            <div className="mt-3">
              <label
                className="flex items-center gap-2 w-full cursor-pointer rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200"
                style={{
                  border: '1px dashed #d1d5db',
                  background: '#f9fafb',
                  color: '#6b7280',
                }}
              >
                <Paperclip className="w-4 h-4 shrink-0" style={{ color: 'rgb(var(--primary-600))' }} />
                <span className="truncate">
                  {earlyAttachment ? earlyAttachment.name : 'Attach supporting document…'}
                </span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.xls,.xlsx"
                  className="sr-only"
                  onChange={(e) => setEarlyAttachment(e.target.files?.[0] || null)}
                />
              </label>
              {earlyAttachment && (
                <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1.5 px-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                  <span className="truncate">Selected: {earlyAttachment.name}</span>
                </p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowEarlyModal(false);
                  setEarlyReason('');
                  setEarlyAttachment(null);
                  setPendingCoords(null);
                  setAttendanceError(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 transition-all duration-200 active:scale-[0.98]"
                style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}
              >
                Cancel
              </button>
              <button
                onClick={submitEarlyReason}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98]"
                style={{
                  background: actionLoading ? '#9ca3af' : `linear-gradient(135deg, rgb(var(--primary-600)), rgb(var(--primary-700)))`,
                  boxShadow: actionLoading ? 'none' : `0 4px 12px rgb(var(--primary-600) / 0.35)`,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {actionLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing…
                  </span>
                ) : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
