import { useEffect, useState } from 'react';
import { Award, Calendar, Building2, User, Info, Sun, Sunset, Moon, CheckCircle2, Clock, Circle, ChevronRight, Loader2 } from 'lucide-react';
import { getStudentAttendance, timeIn, timeOut } from "../../api/attendance";
import { getStudentAssignment } from '../../api/student';

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const formatTime = (timeString) => {
  if (!timeString) return null;
  const [h, m] = timeString.split(":");
  const date = new Date();
  date.setHours(parseInt(h), parseInt(m), 0);
  return date.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true });
};

const formatDate = () =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

/* ─────────────────────────────────────────────
   SESSION CARD
───────────────────────────────────────────── */
const SESSION_CONFIG = {
  morning:   { label: 'Morning',   Icon: Sun,     activeColor: '#f59e0b', activeBg: '#fffbeb', activeBorder: '#fde68a' },
  afternoon: { label: 'Afternoon', Icon: Sunset,  activeColor: '#f97316', activeBg: '#fff7ed', activeBorder: '#fed7aa' },
  ot:        { label: 'Overtime',  Icon: Moon,    activeColor: '#8b5cf6', activeBg: '#f5f3ff', activeBorder: '#ddd6fe' },
};

const getSessionStatus = (timeInVal, timeOutVal) => {
  if (timeInVal && timeOutVal) return 'completed';
  if (timeInVal) return 'inprogress';
  return 'pending';
};

const STATUS_STYLES = {
  completed:  { dot: '#22c55e', label: 'Completed',   dotBg: '#f0fdf4', labelColor: '#16a34a' },
  inprogress: { dot: '#eab308', label: 'In Progress', dotBg: '#fefce8', labelColor: '#a16207' },
  pending:    { dot: '#9ca3af', label: 'Pending',     dotBg: '#f9fafb', labelColor: '#6b7280' },
};

const SessionCard = ({ session, timeInVal, timeOutVal, isActive }) => {
  const { label, Icon, activeColor, activeBg, activeBorder } = SESSION_CONFIG[session];
  const status = getSessionStatus(timeInVal, timeOutVal);
  const { dot, label: statusLabel, dotBg, labelColor } = STATUS_STYLES[status];

  const cardStyle = status === 'completed'
    ? { background: '#f0fdf4', border: '1px solid #bbf7d0' }
    : status === 'inprogress'
    ? { background: activeBg, border: `1px solid ${activeBorder}` }
    : { background: '#f9fafb', border: '1px solid #e5e7eb' };

  const iconStyle = status === 'completed'
    ? { color: '#22c55e' }
    : status === 'inprogress'
    ? { color: activeColor }
    : { color: '#9ca3af' };

  return (
    <div
      className="rounded-xl p-4 transition-all duration-300"
      style={{
        ...cardStyle,
        ...(isActive ? { boxShadow: `0 0 0 2px ${status === 'completed' ? '#22c55e' : activeColor}40` } : {}),
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: status === 'completed' ? '#dcfce7' : status === 'inprogress' ? activeBg : '#f3f4f6', border: `1px solid ${status === 'completed' ? '#bbf7d0' : status === 'inprogress' ? activeBorder : '#e5e7eb'}` }}
          >
            <Icon className="w-3.5 h-3.5" style={iconStyle} />
          </div>
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{label}</span>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{ background: dotBg }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
          <span className="text-xs font-semibold" style={{ color: labelColor }}>{statusLabel}</span>
        </div>
      </div>

      {/* Times */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">In</p>
          <p className={`text-sm font-bold tabular-nums ${timeInVal ? 'text-gray-900' : 'text-gray-400'}`}>
            {formatTime(timeInVal) ?? '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Out</p>
          <p className={`text-sm font-bold tabular-nums ${timeOutVal ? 'text-gray-900' : 'text-gray-400'}`}>
            {formatTime(timeOutVal) ?? '—'}
          </p>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   NEXT ACTION BUTTON LOGIC
───────────────────────────────────────────── */
const getNextAction = (att) => {
  if (!att || !att.morning_time_in)
    return { label: 'Time In — Morning',   type: 'in',  session: 'morning',   Icon: Sun,    color: '#f59e0b' };
  if (!att.morning_time_out)
    return { label: 'Time Out — Morning',  type: 'out', session: 'morning',   Icon: Sun,    color: '#f59e0b' };
  if (!att.afternoon_time_in)
    return { label: 'Time In — Afternoon', type: 'in',  session: 'afternoon', Icon: Sunset, color: '#f97316' };
  if (!att.afternoon_time_out)
    return { label: 'Time Out — Afternoon',type: 'out', session: 'afternoon', Icon: Sunset, color: '#f97316' };
  if (!att.ot_time_in)
    return { label: 'Start OT',            type: 'in',  session: 'ot',        Icon: Moon,   color: '#8b5cf6' };
  if (!att.ot_time_out)
    return { label: 'End OT',              type: 'out', session: 'ot',        Icon: Moon,   color: '#8b5cf6' };
  return null; // all complete
};

/* ─────────────────────────────────────────────
   PROGRESS STEPPER
───────────────────────────────────────────── */
const steps = [
  { key: 'morning_in',   label: 'AM In' },
  { key: 'morning_out',  label: 'AM Out' },
  { key: 'afternoon_in', label: 'PM In' },
  { key: 'afternoon_out',label: 'PM Out' },
  { key: 'ot_in',        label: 'OT In' },
  { key: 'ot_out',       label: 'OT Out' },
];

const getStepsDone = (att) => {
  if (!att) return 0;
  let n = 0;
  if (att.morning_time_in)   n++;
  if (att.morning_time_out)  n++;
  if (att.afternoon_time_in) n++;
  if (att.afternoon_time_out)n++;
  if (att.ot_time_in)        n++;
  if (att.ot_time_out)       n++;
  return n;
};

const ProgressStepper = ({ attendance }) => {
  const done = getStepsDone(attendance);
  return (
    <div className="flex items-center gap-0 mb-5">
      {steps.map((step, i) => {
        const isComplete = i < done;
        const isCurrent  = i === done;
        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center shrink-0">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300"
                style={{
                  background: isComplete ? '#22c55e' : isCurrent ? `rgb(var(--primary-600))` : '#e5e7eb',
                  color: isComplete || isCurrent ? 'white' : '#9ca3af',
                  boxShadow: isCurrent ? `0 0 0 3px rgb(var(--primary-200))` : 'none',
                }}
              >
                {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <p className="text-[9px] font-semibold mt-1 text-center whitespace-nowrap"
                style={{ color: isComplete ? '#16a34a' : isCurrent ? `rgb(var(--primary-700))` : '#9ca3af' }}>
                {step.label}
              </p>
            </div>
            {i < steps.length - 1 && (
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
   MAIN DASHBOARD
───────────────────────────────────────────── */
const StudentDashboard = () => {
  const [attendance, setAttendance]               = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError]     = useState(null);
  const [actionLoading, setActionLoading]         = useState(false);
  const [assignment, setAssignment]               = useState(null);

  const fetchAttendance = async () => {
    try {
      setAttendanceLoading(true);
      const data = await getStudentAttendance();
      // /attendance/student returns the record directly (not wrapped in { success, today })
      // Only overwrite state with real data — never clobber an optimistic update with null
      setAttendance(prev => {
        if (!data) return prev;
        return data;
      });
      setAttendanceError(null);
    } catch (err) {
      setAttendanceError(err.message || "Failed to load attendance");
      // Do not reset to null on error — keep whatever state we already have
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchAssignment = async () => {
    try {
      const res = await getStudentAssignment();
      if (res.success) setAssignment(res.data);
    } catch { console.error("Assignment load failed"); }
  };

  useEffect(() => { fetchAttendance(); fetchAssignment(); }, []);

  /* ── Optimistic update helpers ── */
  const getCurrentTimeHHMM = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const applyOptimisticUpdate = (action) => {
    const field = `${action.session}_time_${action.type === 'in' ? 'in' : 'out'}`;
    setAttendance(prev => ({ ...(prev || {}), [field]: getCurrentTimeHHMM() }));
  };

  const revertOptimisticUpdate = (snapshot) => {
    setAttendance(snapshot);
  };

  /* ── Next action handler ── */
  const handleNextAction = () => {
    if (actionLoading) return;
    const action = getNextAction(attendance);
    if (!action) return;

    const snapshot = attendance; // save for potential rollback

    if (action.type === 'in') {
      setActionLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            applyOptimisticUpdate(action); // ← instant UI update before API call
            const { latitude, longitude } = pos.coords;
            const data = await timeIn(latitude, longitude, action.session);
            if (data.success === false) {
              revertOptimisticUpdate(snapshot);
              setAttendanceError(data.message);
              return;
            }
            await fetchAttendance(); // sync real server data
          } catch {
            revertOptimisticUpdate(snapshot);
            setAttendanceError("Time-in failed");
          } finally {
            setActionLoading(false);
          }
        },
        () => {
          setAttendanceError("Location permission required.");
          setActionLoading(false);
        }
      );
    } else {
      setActionLoading(true);
      applyOptimisticUpdate(action); // ← instant UI update before API call
      (async () => {
        try {
          const data = await timeOut(action.session);
          if (data.success === false) {
            revertOptimisticUpdate(snapshot);
            setAttendanceError(data.message);
            return;
          }
          await fetchAttendance(); // sync real server data
        } catch {
          revertOptimisticUpdate(snapshot);
          setAttendanceError("Time-out failed");
        } finally {
          setActionLoading(false);
        }
      })();
    }
  };

  const nextAction = getNextAction(attendance);
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

              {/* Session cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SessionCard
                  session="morning"
                  timeInVal={attendance?.morning_time_in}
                  timeOutVal={attendance?.morning_time_out}
                  isActive={nextAction?.session === 'morning'}
                />
                <SessionCard
                  session="afternoon"
                  timeInVal={attendance?.afternoon_time_in}
                  timeOutVal={attendance?.afternoon_time_out}
                  isActive={nextAction?.session === 'afternoon'}
                />
                <SessionCard
                  session="ot"
                  timeInVal={attendance?.ot_time_in}
                  timeOutVal={attendance?.ot_time_out}
                  isActive={nextAction?.session === 'ot'}
                />
              </div>

              {/* Next Action Button */}
              {allComplete ? (
                <div
                  className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm"
                  style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a' }}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>All Sessions Completed</span>
                </div>
              ) : (
                <button
                  onClick={handleNextAction}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-200 active:scale-[0.98]"
                  style={{
                    background: actionLoading
                      ? '#9ca3af'
                      : `linear-gradient(135deg, ${nextAction.color}, ${nextAction.color}dd)`,
                    boxShadow: actionLoading ? 'none' : `0 4px 14px ${nextAction.color}50`,
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
                <p className="text-sm font-semibold text-gray-900">{assignment?.company || "Not assigned"}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Course</label>
                <p className="text-sm font-semibold text-gray-900">{assignment?.course || "—"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Required Hours</label>
                  <p className="text-sm font-semibold text-gray-900">{assignment?.required_hours || "—"} hours</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Coordinator</label>
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-gray-500" />
                    {assignment?.coordinator || "—"}
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
                "Morning and Afternoon sessions are required each day",
                "OT is optional — only start if instructed",
                "Location data is captured on every time-in",
                "Records are reviewed by your coordinator",
                "Contact coordinator for missed or incorrect entries",
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