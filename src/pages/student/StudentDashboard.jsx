import { useEffect, useState } from 'react';
import { Award, LogIn, LogOut, Calendar, Building2, User, Info } from 'lucide-react';
import { getStudentAttendanceHistory, timeIn, timeOut } from "../../api/attendance";
import { getStudentAssignment } from '../../api/student';

const StudentDashboard = () => {
  const [attendance, setAttendance] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [assignment, setAssignment] = useState(null);

  const fetchAttendance = async () => {
    try {
      setAttendanceLoading(true);
      const data = await getStudentAttendanceHistory();
      if (data.success) {
        setAttendance(data.today || null);
      } else {
        setAttendance(null);
      }
      setAttendanceError(null);
    } catch (err) {
      setAttendanceError(err.message || "Failed to load attendance");
      setAttendance(null);
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  const handleTimeIn = () => {
    if (actionLoading) return;
    setActionLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const data = await timeIn(latitude, longitude);
          if (data.success === false) {
            setAttendanceError(data.message);
            return;
          }
          await fetchAttendance();
        } catch (err) {
          setAttendanceError("Time-in failed");
        } finally {
          setActionLoading(false);
        }
      },
      () => {
        setAttendanceError("Location permission required for attendance.");
        setActionLoading(false);
      }
    );
  };

  const handleTimeOut = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const data = await timeOut();
      if (data.success === false) {
        setAttendanceError(data.message);
        return;
      }
      await fetchAttendance();
    } catch (err) {
      setAttendanceError("Time-out failed");
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (timeString) => {
  if (!timeString) return "—";

  const [h, m] = timeString.split(":");

  const date = new Date();
  date.setHours(parseInt(h), parseInt(m), 0);

  return date.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

  const formatDate = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  const canTimeIn = !attendance || !attendance.timeIn;
  const canTimeOut = attendance && attendance.timeIn && !attendance.timeOut;
  const isCompleted = attendance?.timeIn && attendance?.timeOut;

  const fetchAssignment = async () => {
    try {
      const res = await getStudentAssignment();
      if (res.success) setAssignment(res.data);
    } catch {
      console.error("Assignment load failed");
    }
  };

  useEffect(() => {
    fetchAttendance();
    fetchAssignment();
  }, []);

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

        {/* TODAY'S ATTENDANCE - PRIMARY SECTION */}
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
                style={{
                  border: `3px solid rgb(var(--primary-100))`,
                  borderTopColor: `rgb(var(--primary-600))`
                }}
              ></div>
            </div>
          ) : (
            <div className="space-y-4">
              {isCompleted ? (
                <div
                  className="rounded-lg p-5"
                  style={{
                    background: `linear-gradient(to bottom right, rgb(var(--primary-100)), rgb(var(--primary-400) / 0.15))`,
                    border: `1px solid rgb(var(--primary-400) / 0.4)`
                  }}
                >
                  <p
                    className="text-xs font-semibold uppercase tracking-wide mb-1"
                    style={{ color: `rgb(var(--primary-700))` }}
                  >Completed</p>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">
                    {formatTime(attendance.timeIn)} — {formatTime(attendance.timeOut)}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Time In Card */}
                  <div
                    className="rounded-lg p-5"
                    style={{
                      background: `linear-gradient(to bottom right, rgb(var(--primary-100)), rgb(var(--primary-400) / 0.15))`,
                      border: `1px solid rgb(var(--primary-400) / 0.4)`
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <LogIn className="w-4 h-4" style={{ color: `rgb(var(--primary-700))` }} />
                      <p
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{ color: `rgb(var(--primary-700))` }}
                      >Time In</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">
                      {attendance?.timeIn ? formatTime(attendance.timeIn) : "—"}
                    </p>
                  </div>

                  {/* Time Out Card */}
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <LogOut className="w-4 h-4 text-gray-600" />
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Time Out</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">
                      {attendance?.timeOut ? formatTime(attendance.timeOut) : "—"}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleTimeIn}
                  disabled={!canTimeIn || actionLoading || isCompleted}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm transition-all shadow-sm active:scale-[0.98]"
                  style={
                    canTimeIn && !actionLoading && !isCompleted
                      ? { backgroundColor: `rgb(var(--primary-600))`, color: 'white' }
                      : { backgroundColor: '#e5e7eb', color: '#9ca3af', cursor: 'not-allowed' }
                  }
                  onMouseEnter={e => { if (canTimeIn && !actionLoading && !isCompleted) e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`; }}
                  onMouseLeave={e => { if (canTimeIn && !actionLoading && !isCompleted) e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`; }}
                >
                  <LogIn className="w-4 h-4" />
                  <span>{actionLoading ? "Processing..." : "Time In"}</span>
                </button>

                <button
                  onClick={handleTimeOut}
                  disabled={!canTimeOut || actionLoading || isCompleted}
                  className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm transition-all shadow-sm ${canTimeOut && !actionLoading && !isCompleted
                    ? "bg-gray-700 text-white hover:bg-gray-800 hover:shadow-md active:scale-[0.98]"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                >
                  <LogOut className="w-4 h-4" />
                  <span>{actionLoading ? "Processing..." : "Time Out"}</span>
                </button>
              </div>

              {/* Error Message */}
              {attendanceError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  <p className="text-red-700 text-sm font-medium">{attendanceError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* TWO COLUMN LAYOUT FOR SECONDARY SECTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* OJT ASSIGNMENT INFORMATION */}
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
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                  Assigned Company
                </label>
                <p className="text-sm font-semibold text-gray-900">{assignment?.company || "Not assigned"}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                  Course
                </label>
                <p className="text-sm font-semibold text-gray-900">{assignment?.course || "—"}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                    Required Hours
                  </label>
                  <p className="text-sm font-semibold text-gray-900">{assignment?.required_hours || "—"} hours</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                    Coordinator
                  </label>
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-gray-500" />
                    {assignment?.coordinator || "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ATTENDANCE GUIDELINES */}
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
                "Attendance is recorded once daily",
                "Location data is captured for verification",
                "Records are reviewed by your coordinator",
                "Contact coordinator for any concerns",
              ].map((text) => (
                <div key={text} className="flex items-start gap-2.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                    style={{ backgroundColor: `rgb(var(--primary-600))` }}
                  ></div>
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