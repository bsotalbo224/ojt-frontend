import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Plus, Calendar, Paperclip, X, FileText, Image as ImageIcon,
  Upload, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp,
  Timer, TriangleAlert, Eye, MessageSquare, ExternalLink,
  Sun, Briefcase, Moon,
} from "lucide-react";

import {
  addLog, uploadLogAttachment, updateRevisionAttachment,
  getMyLogs, updateLog, getLogAttachment,
} from "../../api/logs";
import { getStudentAttendance } from "../../api/attendance";

/* ═══════════════════════════════════════════════════════
   SESSION HELPERS
═══════════════════════════════════════════════════════ */
const sessionHours = (timeIn, timeOut) => {
  if (!timeIn || !timeOut) return null;
  const toMs = (t) => {
    const [h, m, s = 0] = t.split(":").map(Number);
    return (h * 3600 + m * 60 + s) * 1000;
  };
  const diff = toMs(timeOut) - toMs(timeIn);
  return diff > 0 ? diff / 3_600_000 : 0;
};

const computeTotalHours = (att) => {
  if (!att) return null;
  const morning   = sessionHours(att.morning_time_in,   att.morning_time_out)   ?? 0;
  const afternoon = sessionHours(att.afternoon_time_in, att.afternoon_time_out) ?? 0;
  const ot        = sessionHours(att.ot_time_in,        att.ot_time_out)        ?? 0;
  const total = morning + afternoon + ot;
  if (total === 0) return null;
  const rounded = Math.round(total * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded} hrs`;
};

const isAttendanceIncomplete = (att) => {
  if (!att) return false;
  return !(att.morning_time_in && att.morning_time_out) ||
         !(att.afternoon_time_in && att.afternoon_time_out);
};

const formatTime = (timeStr) => {
  if (!timeStr) return null;
  const [h, m, s = 0] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, s);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};

const formatDateOnly = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00"));
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const formatDate = (d) =>
  new Date(d + (d.includes("T") ? "" : "T00:00:00")).toLocaleDateString("en-US", {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
  });

/* ═══════════════════════════════════════════════════════
   SESSION META
═══════════════════════════════════════════════════════ */
const SESSION_META = {
  morning:   { label: "Morning",   Icon: Sun,       accentColor: "#f59e0b", accentLight: "#fffbeb", accentBorder: "#fde68a" },
  afternoon: { label: "Afternoon", Icon: Briefcase, accentColor: "#3b82f6", accentLight: "#eff6ff", accentBorder: "#bfdbfe" },
  ot:        { label: "Overtime",  Icon: Moon,      accentColor: "#8b5cf6", accentLight: "#f5f3ff", accentBorder: "#ddd6fe" },
};

const getSessionStatus = (timeIn, timeOut) => {
  if (timeIn && timeOut) return "completed";
  if (timeIn)            return "inprogress";
  return "pending";
};

const STATUS_PILL = {
  completed:  { bg: "#f0fdf4", border: "#bbf7d0", dot: "#22c55e", text: "#16a34a", label: "Completed"   },
  inprogress: { bg: "#fefce8", border: "#fde68a",  dot: "#eab308", text: "#a16207", label: "In Progress" },
  pending:    { bg: "#f9fafb", border: "#e5e7eb",  dot: "#9ca3af", text: "#6b7280", label: "Not Started" },
};

/* ═══════════════════════════════════════════════════════
   SESSION ATTENDANCE CARD (form)
═══════════════════════════════════════════════════════ */
const SessionAttendanceCard = ({ session, timeIn, timeOut }) => {
  const { label, Icon, accentColor, accentLight, accentBorder } = SESSION_META[session];
  const status = getSessionStatus(timeIn, timeOut);
  const pill   = STATUS_PILL[status];

  const cardBg     = status === "completed" ? "#f0fdf4"   : status === "inprogress" ? accentLight  : "#f9fafb";
  const cardBorder = status === "completed" ? "#bbf7d0"   : status === "inprogress" ? accentBorder : "#e5e7eb";

  return (
    <div
      className="rounded-xl p-3.5 flex flex-col gap-2.5 transition-all duration-300"
      style={{ background: cardBg, border: `1.5px solid ${cardBorder}` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: status === "pending" ? "#f3f4f6" : cardBorder }}>
            <Icon className="w-3.5 h-3.5" style={{ color: status === "pending" ? "#9ca3af" : accentColor }} />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-600">{label}</span>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: pill.bg, border: `1px solid ${pill.border}` }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: pill.dot }} />
          <span className="text-[10px] font-bold" style={{ color: pill.text }}>{pill.label}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">In</p>
          <p className={`text-sm font-bold tabular-nums ${timeIn ? "text-gray-800" : "text-gray-300"}`}>{formatTime(timeIn) ?? "—"}</p>
        </div>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Out</p>
          <p className={`text-sm font-bold tabular-nums ${timeOut ? "text-gray-800" : "text-gray-300"}`}>{formatTime(timeOut) ?? "—"}</p>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   COMPACT SESSION PILL (log history cards)
═══════════════════════════════════════════════════════ */
const SessionPill = ({ session, timeIn, timeOut }) => {
  const { label, Icon, accentColor } = SESSION_META[session];
  if (!timeIn) return null;
  const timeStr = timeIn && timeOut
    ? `${formatTime(timeIn)} – ${formatTime(timeOut)}`
    : `${formatTime(timeIn)} – In Progress`;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 font-medium" style={{ background: "#f9fafb", border: "1px solid #e5e7eb", color: "#374151" }}>
      <Icon className="w-3 h-3 shrink-0" style={{ color: accentColor }} />
      <span className="text-gray-500 font-semibold">{label}:</span>
      {timeStr}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════
   SKELETON CARD
═══════════════════════════════════════════════════════ */
const SkeletonCard = () => (
  <div className="bg-white rounded-2xl p-6 animate-pulse" style={{ border: `2px solid rgb(var(--primary-100))` }}>
    <div className="flex items-center justify-between mb-4 pb-4" style={{ borderBottom: `1px solid rgb(var(--primary-100))` }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-xl" />
        <div className="h-5 w-36 bg-gray-200 rounded-lg" />
      </div>
      <div className="h-7 w-24 bg-gray-200 rounded-full" />
    </div>
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="h-14 bg-gray-100 rounded-xl" />
      <div className="h-14 bg-gray-100 rounded-xl" />
      <div className="h-14 bg-gray-100 rounded-xl" />
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-gray-200 rounded w-full" />
      <div className="h-4 bg-gray-200 rounded w-5/6" />
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════
   ATTACHMENT PREVIEW MODAL
═══════════════════════════════════════════════════════ */
const AttachmentModal = ({ file, onClose }) => {
  const [loaded, setLoaded] = useState(false);
  const isImage =
    file.file_type?.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(file.file_name ?? "");

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      style={{ animation: "fadeIn 0.18s ease" }}
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "scaleIn 0.2s ease" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.6))`, borderBottom: `1px solid rgb(var(--primary-100))` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Paperclip className="w-4 h-4 shrink-0" style={{ color: `rgb(var(--primary-medium))` }} />
            <span className="text-sm font-semibold truncate max-w-xs" style={{ color: `rgb(var(--primary-dark))` }}>{file.file_name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <a
              href={file.file_path} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ backgroundColor: `rgb(var(--primary-100))`, color: `rgb(var(--primary))` }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-200))`; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-100))`; }}
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ backgroundColor: `rgb(var(--primary-100))` }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-200))`; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-100))`; }}
              aria-label="Close preview"
            >
              <X className="w-4 h-4" style={{ color: `rgb(var(--primary))` }} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-50 min-h-0 relative">
          {!loaded && (
            <div className="flex items-center gap-2 text-sm" style={{ color: `rgb(var(--primary-medium))` }}>
              <div className="w-5 h-5 rounded-full animate-spin" style={{ border: `2px solid rgb(var(--primary-200))`, borderTopColor: `rgb(var(--primary-medium))` }} />
              Loading preview…
            </div>
          )}
          {isImage ? (
            <img
              src={file.file_path} alt={file.file_name}
              onLoad={() => setLoaded(true)} onError={() => setLoaded(true)}
              className="max-h-[75vh] max-w-full object-contain rounded-lg shadow"
              style={{ display: loaded ? "block" : "none" }}
            />
          ) : (
            <iframe
              src={file.file_path} title={file.file_name}
              className="w-full rounded-lg"
              style={{ height: "75vh", border: `1px solid rgb(var(--primary-100))`, display: loaded ? "block" : "none" }}
              onLoad={() => setLoaded(true)}
            />
          )}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn  { from { opacity:0 }                          to { opacity:1 } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.95) }  to { opacity:1; transform:scale(1) } }
      `}</style>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   NOTIFICATION BANNER
═══════════════════════════════════════════════════════ */
const NotificationBanner = ({ notification, onDismiss }) => {
  if (!notification) return null;
  const isSuccess = notification.type === "success";
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border-2 px-5 py-4 shadow-md ${isSuccess ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}
      style={{ animation: "slideDown 0.25s ease" }}
      role="alert"
    >
      <div className={`mt-0.5 shrink-0 ${isSuccess ? "text-emerald-500" : "text-red-500"}`}>
        {isSuccess ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
      </div>
      <p className="text-sm font-medium flex-1">{notification.message}</p>
      <button
        onClick={onDismiss}
        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0 ${isSuccess ? "hover:bg-emerald-100 text-emerald-600" : "hover:bg-red-100 text-red-600"}`}
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
const DailyLogs = () => {
  const [showForm, setShowForm]                       = useState(false);
  const [logText, setLogText]                         = useState("");
  const [editingLogId, setEditingLogId]               = useState(null);
  const [notification, setNotification]               = useState(null);
  const notificationTimerRef                          = useRef(null);
  const [attendance, setAttendance]                   = useState(null);
  const [logs, setLogs]                               = useState([]);
  const [loadingLogs, setLoadingLogs]                 = useState(true);
  const [showAllLogs, setShowAllLogs]                 = useState(false);
  const [uploadedFiles, setUploadedFiles]             = useState([]);
  const [isSubmitting, setIsSubmitting]               = useState(false);
  const [attachmentMap, setAttachmentMap]             = useState({});
  const [loadingAttachment, setLoadingAttachment]     = useState({});
  const [openEvidenceLogId, setOpenAttachmentLogId]   = useState(null);
  const [previewFile, setPreviewFile]                 = useState(null);

  const location            = useLocation();
  const revisionId          = new URLSearchParams(location.search).get("revision");
  const revisionHandledRef  = useRef(false);
  const revisionCardRef     = useRef(null);
  const navigate            = useNavigate();
  const formRef             = useRef(null);
  const MAX_CHARS           = 800;

  const showNotification = useCallback((message, type = "success") => {
    if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    setNotification({ message, type });
    notificationTimerRef.current = setTimeout(() => setNotification(null), 4000);
  }, []);

  const dismissNotification = useCallback(() => {
    if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    setNotification(null);
  }, []);

  useEffect(() => () => { if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current); }, []);

  const fetchLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const data = await getMyLogs();
      const sorted = (Array.isArray(data.logs) ? data.logs : [])
        .sort((a, b) => new Date(b.log_date) - new Date(a.log_date));
      setLogs(sorted);
    } catch (err) {
      console.error("Failed to fetch logs", err);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const data = await getStudentAttendance();
        if (!data) { setAttendance(null); return; }
        const d = new Date(data.attendance_date);
        const logDate = [
          d.getFullYear(),
          String(d.getMonth() + 1).padStart(2, "0"),
          String(d.getDate()).padStart(2, "0"),
        ].join("-");
        setAttendance({
          attendance_date:    logDate,
          morning_time_in:    data.morning_time_in    ?? null,
          morning_time_out:   data.morning_time_out   ?? null,
          afternoon_time_in:  data.afternoon_time_in  ?? null,
          afternoon_time_out: data.afternoon_time_out ?? null,
          ot_time_in:         data.ot_time_in         ?? null,
          ot_time_out:        data.ot_time_out        ?? null,
        });
      } catch (err) {
        console.error("Attendance fetch error:", err);
        setAttendance(null);
      }
    };
    fetchAttendance();
  }, []);

  const fetchAttachments = useCallback(async (logId) => {
    if (attachmentMap[logId] !== undefined) return;
    try {
      setLoadingAttachment((prev) => ({ ...prev, [logId]: true }));
      const files = await getLogAttachment(logId);
      setAttachmentMap((prev) => ({ ...prev, [logId]: Array.isArray(files) ? files : (files?.attachments ?? []) }));
    } catch {
      setAttachmentMap((prev) => ({ ...prev, [logId]: [] }));
    } finally {
      setLoadingAttachment((prev) => ({ ...prev, [logId]: false }));
    }
  }, [attachmentMap]);

  useEffect(() => {
    if (!revisionId || logs.length === 0 || revisionHandledRef.current) return;
    const target = logs.find((l) => String(l.log_id) === String(revisionId));
    if (target) {
      revisionHandledRef.current = true;
      if (logs.indexOf(target) >= 3) setShowAllLogs(true);
      setEditingLogId(target.log_id);
      setLogText(target.narrative || "");
      setUploadedFiles([]);
      setAttendance({
        attendance_date:    target.log_date,
        morning_time_in:    target.morning_time_in    ?? null,
        morning_time_out:   target.morning_time_out   ?? null,
        afternoon_time_in:  target.afternoon_time_in  ?? null,
        afternoon_time_out: target.afternoon_time_out ?? null,
        ot_time_in:         target.ot_time_in         ?? null,
        ot_time_out:        target.ot_time_out        ?? null,
      });
      setShowForm(true);
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
      setTimeout(() => revisionCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
      showNotification(`Log from ${formatDateOnly(target.log_date)} was flagged for revision. Please review and resubmit.`, "error");
    }
  }, [revisionId, logs, showNotification]);

  const handleFileSelect = (e) => setUploadedFiles((prev) => [...prev, ...Array.from(e.target.files)]);
  const removeFile = (index) => setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  const resetForm = useCallback(() => { setEditingLogId(null); setLogText(""); setUploadedFiles([]); }, []);

  const handleEditLog = (log) => {
    setEditingLogId(log.log_id);
    setLogText(log.narrative || "");
    setUploadedFiles([]);
    setAttendance({
      attendance_date:    log.log_date,
      morning_time_in:    log.morning_time_in    ?? null,
      morning_time_out:   log.morning_time_out   ?? null,
      afternoon_time_in:  log.afternoon_time_in  ?? null,
      afternoon_time_out: log.afternoon_time_out ?? null,
      ot_time_in:         log.ot_time_in         ?? null,
      ot_time_out:        log.ot_time_out        ?? null,
    });
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const attendanceIncomplete = isAttendanceIncomplete(attendance);

  const handleSubmit = async () => {
    if (!logText.trim()) { showNotification("Please write a brief daily log.", "error"); return; }
    if (attendanceIncomplete) return;
    if (!attendance?.attendance_date) { showNotification("No attendance record found. Cannot submit log.", "error"); return; }
    try {
      setIsSubmitting(true);
      let logId = editingLogId;
      if (editingLogId) {
        await updateLog(editingLogId, { narrative: logText });
        if (uploadedFiles.length > 0) {
          await Promise.all(uploadedFiles.map((file) => updateRevisionAttachment(logId, file)));
          setAttachmentMap((prev) => { const u = { ...prev }; delete u[logId]; return u; });
        }
      } else {
        const result = await addLog({ log_date: attendance.attendance_date, narrative: logText });
        if (!result?.log_id) throw new Error(result?.message || "Failed to create log");
        logId = result.log_id;
        if (uploadedFiles.length > 0) {
          await Promise.all(uploadedFiles.map((file) => uploadLogAttachment(logId, file)));
        }
      }
      resetForm(); setShowForm(false); await fetchLogs();
      showNotification(
        editingLogId
          ? "Daily log resubmitted successfully. It is now pending coordinator review."
          : "Daily log submitted successfully. Your entry is now pending coordinator review.",
        "success"
      );
    } catch (err) {
      console.error(err);
      showNotification("Submission failed. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAttachments = async (logId) => {
    if (openEvidenceLogId === logId) { setOpenAttachmentLogId(null); return; }
    setOpenAttachmentLogId(logId);
    await fetchAttachments(logId);
  };

  const handleConsultLog = (log) =>
    navigate(`/student/messages?log=${log.log_id}&date=${encodeURIComponent(formatDateOnly(log.log_date))}`);

  const statusConfig = {
    approved:  { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle className="w-3.5 h-3.5" />, label: "Approved"       },
    revision:  { cls: "bg-amber-50 text-amber-700 border-amber-200",       icon: <AlertCircle className="w-3.5 h-3.5" />, label: "Needs Revision" },
    draft:     { cls: "bg-gray-100 text-gray-600 border-gray-200",         icon: <Clock className="w-3.5 h-3.5" />,       label: "Draft"          },
    submitted: { cls: "bg-blue-50 text-blue-700 border-blue-200",          icon: <Clock className="w-3.5 h-3.5" />,       label: "Submitted"      },
  };
  const getStatus = (s) => statusConfig[s] || statusConfig.submitted;

  const visibleLogs     = showAllLogs ? logs : logs.slice(0, 3);
  const totalHoursToday = computeTotalHours(attendance);

  /* ══ RENDER ══ */
  return (
    <div
      className="min-h-screen p-4 sm:p-8"
      style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.4), rgb(var(--primary-50)))` }}
    >
      <div className="max-w-4xl mx-auto space-y-6">

        {/* PAGE HEADER */}
        <div className="text-center space-y-2 pb-2">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg mb-1"
            style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-500)), rgb(var(--primary-medium)))` }}
          >
            <FileText className="w-7 h-7 text-white" />
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent"
            style={{ backgroundImage: `linear-gradient(to right, rgb(var(--primary)), rgb(var(--primary-medium)))` }}
          >
            Daily Logs
          </h1>
          <p className="text-sm max-w-xl mx-auto" style={{ color: `rgb(var(--primary-medium))` }}>
            Document your daily activities and experiences throughout your OJT journey.
          </p>
        </div>

        <NotificationBanner notification={notification} onDismiss={dismissNotification} />

        {/* NARRATIVE SHORTCUT */}
        <div
          className="rounded-2xl p-5 shadow-md"
          style={{ background: `linear-gradient(to right, rgb(var(--primary-medium)), rgb(var(--primary)))`, border: `1px solid rgb(var(--primary) / 0.3)` }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <h3 className="text-base font-bold text-white">Narrative Report</h3>
                <p className="text-xs" style={{ color: `rgb(var(--primary-300))` }}>Write your official OJT narrative for final submission</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/student/narrative")}
              className="font-semibold px-5 py-2.5 rounded-xl shadow hover:shadow-md transition-all text-sm whitespace-nowrap bg-white hover:bg-gray-50"
              style={{ color: `rgb(var(--primary))` }}
            >
              Go to Narrative →
            </button>
          </div>
        </div>

        {/* ADD LOG BUTTON */}
        <button
          onClick={() => {
            if (showForm && !editingLogId) { setShowForm(false); resetForm(); }
            else { resetForm(); setShowForm(true); }
          }}
          className="w-full text-white rounded-2xl py-4 px-6 font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.01]"
          style={{ background: `linear-gradient(to right, rgb(var(--primary-medium)), rgb(var(--primary-500)))` }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `linear-gradient(to right, rgb(var(--primary)), rgb(var(--primary-medium)))`; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = `linear-gradient(to right, rgb(var(--primary-medium)), rgb(var(--primary-500)))`; }}
        >
          <Plus className="w-5 h-5" />
          <span>{showForm && !editingLogId ? "Close Form" : "Add New Log Entry"}</span>
        </button>

        {/* ══ FORM CARD ══ */}
        {showForm && (
          <div
            ref={formRef}
            className="bg-white rounded-2xl shadow-xl overflow-hidden"
            style={{ border: `2px solid rgb(var(--primary-100))`, animation: "slideDown 0.25s ease" }}
          >
            <div
              className="px-6 py-5 flex items-center gap-3"
              style={{ background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.5))`, borderBottom: `2px solid rgb(var(--primary-100))` }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `rgb(var(--primary-100))` }}>
                <FileText className="w-5 h-5" style={{ color: `rgb(var(--primary-medium))` }} />
              </div>
              <h2 className="text-xl font-bold" style={{ color: `rgb(var(--primary-dark))` }}>
                {editingLogId ? "Edit Daily Log — Revision" : "New Daily Log Entry"}
              </h2>
            </div>

            <div className="p-6 space-y-6">

              {/* ATTENDANCE READ-ONLY */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: `rgb(var(--primary))` }}>Attendance Record</span>
                    <span className="text-xs text-gray-400 font-normal">(system-generated · read-only)</span>
                  </div>
                  {totalHoursToday && (
                    <div
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                      style={{ background: "linear-gradient(to right, #f0fdf4, #dcfce7)", border: "1px solid #bbf7d0", color: "#15803d" }}
                    >
                      <Timer className="w-3 h-3" />
                      {totalHoursToday} today
                    </div>
                  )}
                </div>

                {attendanceIncomplete && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3 mb-3">
                    <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                    <span>
                      <strong>Attendance incomplete.</strong> Both Morning and Afternoon sessions must be fully completed (time-in and time-out) before submitting a daily log.
                    </span>
                  </div>
                )}

                {attendance ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
                        style={{ background: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-200))`, color: `rgb(var(--primary-dark))` }}
                      >
                        <Calendar className="w-4 h-4" style={{ color: `rgb(var(--primary-medium))` }} />
                        {formatDateOnly(attendance.attendance_date)}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <SessionAttendanceCard session="morning"   timeIn={attendance.morning_time_in}   timeOut={attendance.morning_time_out}   />
                      <SessionAttendanceCard session="afternoon" timeIn={attendance.afternoon_time_in} timeOut={attendance.afternoon_time_out} />
                      <SessionAttendanceCard session="ot"        timeIn={attendance.ot_time_in}        timeOut={attendance.ot_time_out}        />
                    </div>
                  </>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-sm text-gray-400 italic">
                    No attendance record found for today.
                  </div>
                )}
              </div>

              {/* LOG TEXT */}
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: `rgb(var(--primary))` }}>
                  Daily Log <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={5}
                  value={logText}
                  maxLength={MAX_CHARS}
                  onChange={(e) => setLogText(e.target.value)}
                  placeholder="Describe what you accomplished today (concise and direct)."
                  className="w-full px-4 py-3.5 rounded-xl resize-none outline-none transition-all text-sm text-gray-700"
                  style={{ border: `2px solid rgb(var(--primary-200))` }}
                  onFocus={(e) => { e.target.style.borderColor = `rgb(var(--primary-medium))`; e.target.style.boxShadow = `0 0 0 4px rgb(var(--primary-100))`; }}
                  onBlur={(e)  => { e.target.style.borderColor = `rgb(var(--primary-200))`;    e.target.style.boxShadow = "none"; }}
                />
                <div className={`text-right text-xs mt-1 font-medium ${logText.length >= MAX_CHARS ? "text-red-500" : "text-gray-400"}`}>
                  {logText.length} / {MAX_CHARS}
                </div>
              </div>

              {/* ATTACHMENT */}
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: `rgb(var(--primary))` }}>
                  Attachment <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <label
                  className="rounded-xl p-6 text-center cursor-pointer block transition-all"
                  style={{ border: `2px dashed rgb(var(--primary-300))`, background: `linear-gradient(to bottom right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.4))` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = `linear-gradient(to bottom right, rgb(var(--primary-100)), rgb(var(--primary-200) / 0.4))`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = `linear-gradient(to bottom right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.4))`; }}
                >
                  <div className="w-12 h-12 mx-auto mb-3 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <Upload className="w-6 h-6" style={{ color: `rgb(var(--primary-medium))` }} />
                  </div>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: `rgb(var(--primary))` }}>Click to upload files</p>
                  <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>Images or PDFs accepted</p>
                  <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
                </label>
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {uploadedFiles.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-xl transition-all"
                        style={{ background: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-200))` }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = `rgb(var(--primary-100))`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = `rgb(var(--primary-50))`; }}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                            {file.type.startsWith("image/")
                              ? <ImageIcon className="w-3.5 h-3.5" style={{ color: `rgb(var(--primary-medium))` }} />
                              : <FileText  className="w-3.5 h-3.5" style={{ color: `rgb(var(--primary-medium))` }} />}
                          </div>
                          <span className="text-xs truncate font-medium" style={{ color: `rgb(var(--primary-dark))` }}>{file.name}</span>
                        </div>
                        <button onClick={() => removeFile(i)} className="ml-2 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-100 transition-all shrink-0" aria-label={`Remove ${file.name}`}>
                          <X className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* FORM ACTIONS */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2" style={{ borderTop: `2px solid rgb(var(--primary-100))` }}>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || attendanceIncomplete || !logText.trim() || !attendance}
                  className="flex-1 text-white py-3.5 rounded-xl font-semibold shadow hover:shadow-lg transition-all disabled:cursor-not-allowed text-sm"
                  style={
                    isSubmitting || attendanceIncomplete || !logText.trim() || !attendance
                      ? { background: "linear-gradient(to right, #d1d5db, #9ca3af)" }
                      : { background: `linear-gradient(to right, rgb(var(--primary-medium)), rgb(var(--primary-500)))` }
                  }
                >
                  {isSubmitting ? "Submitting…" : editingLogId ? "Resubmit Log" : "Submit Log"}
                </button>
                <button
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="flex-1 bg-white py-3.5 rounded-xl font-semibold transition-all text-sm"
                  style={{ border: `2px solid rgb(var(--primary-300))`, color: `rgb(var(--primary))` }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgb(var(--primary-medium))`; e.currentTarget.style.background = `rgb(var(--primary-50))`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = `rgb(var(--primary-300))`;    e.currentTarget.style.background = "white"; }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ LOG HISTORY ══ */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden" style={{ border: `2px solid rgb(var(--primary-100))` }}>
          <div
            className="px-6 py-5 flex items-center gap-3"
            style={{ background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.5))`, borderBottom: `2px solid rgb(var(--primary-100))` }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `rgb(var(--primary-100))` }}>
              <Clock className="w-5 h-5" style={{ color: `rgb(var(--primary-medium))` }} />
            </div>
            <h2 className="text-xl font-bold" style={{ color: `rgb(var(--primary-dark))` }}>Recent Daily Logs</h2>
          </div>

          <div className="p-6 space-y-4">
            {loadingLogs && [1, 2, 3].map((i) => <SkeletonCard key={i} />)}

            {!loadingLogs && logs.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `rgb(var(--primary-50))` }}>
                  <FileText className="w-8 h-8" style={{ color: `rgb(var(--primary-300))` }} />
                </div>
                <p className="font-semibold" style={{ color: `rgb(var(--primary))` }}>No logs yet</p>
                <p className="text-sm mt-1" style={{ color: `rgb(var(--primary-500))` }}>Start by adding your first daily log entry above.</p>
              </div>
            )}

            {!loadingLogs && visibleLogs.map((log) => {
              const st = getStatus(log.status);
              const attachCount = attachmentMap[log.log_id]?.length ?? 0;
              const isRevisionTarget = revisionId && String(log.log_id) === String(revisionId);
              const logTotalHrs = computeTotalHours({
                morning_time_in:    log.morning_time_in,
                morning_time_out:   log.morning_time_out,
                afternoon_time_in:  log.afternoon_time_in,
                afternoon_time_out: log.afternoon_time_out,
                ot_time_in:         log.ot_time_in,
                ot_time_out:        log.ot_time_out,
              });

              return (
                <div
                  key={log.log_id}
                  ref={isRevisionTarget ? revisionCardRef : null}
                  className={`rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200 ${isRevisionTarget ? "ring-2 ring-amber-400 ring-offset-2" : ""}`}
                  style={{
                    border: log.status === "revision" ? "2px solid #fcd34d" : `2px solid rgb(var(--primary-100))`,
                    borderLeft: log.status === "revision" ? "4px solid #f59e0b" : undefined,
                  }}
                >
                  {/* Card header */}
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4"
                    style={{ background: `linear-gradient(to right, rgb(var(--primary-50) / 0.6), rgb(var(--primary-100) / 0.4))`, borderBottom: `1px solid rgb(var(--primary-100))` }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0" style={{ border: `1px solid rgb(var(--primary-100))` }}>
                        <Calendar className="w-4 h-4" style={{ color: `rgb(var(--primary-medium))` }} />
                      </div>
                      <div>
                        <span className="font-bold text-base" style={{ color: `rgb(var(--primary-dark))` }}>{formatDate(log.log_date)}</span>
                        {logTotalHrs && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d" }}>
                            <Timer className="w-2.5 h-2.5" />{logTotalHrs}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {log.status === "revision" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-semibold bg-blue-50 border border-blue-200 px-2 py-1 rounded-full">
                          <MessageSquare className="w-2.5 h-2.5" /> Discussion Available
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${st.cls}`}>
                        {st.icon}{st.label}
                      </span>
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-4">
                    {log.status === "revision" && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <div className="text-sm text-blue-800">
                          This log requires revision. You may continue the discussion in the{" "}
                          <button onClick={() => handleConsultLog(log)} className="font-semibold underline underline-offset-2 hover:text-blue-600 transition-colors">
                            Consultation Hub
                          </button>.
                        </div>
                      </div>
                    )}

                    {/* Session pills */}
                    {(log.morning_time_in || log.afternoon_time_in || log.ot_time_in) && (
                      <div className="flex flex-wrap gap-2">
                        <SessionPill session="morning"   timeIn={log.morning_time_in}   timeOut={log.morning_time_out}   />
                        <SessionPill session="afternoon" timeIn={log.afternoon_time_in} timeOut={log.afternoon_time_out} />
                        <SessionPill session="ot"        timeIn={log.ot_time_in}        timeOut={log.ot_time_out}        />
                      </div>
                    )}

                    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                      <p className="text-sm text-gray-700 leading-relaxed">{log.narrative || "—"}</p>
                    </div>

                    {log.status === "revision" && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Coordinator Feedback</span>
                        </div>
                        <p className="text-sm text-amber-800 leading-relaxed">
                          {log.feedback?.trim() || "Coordinator requested revision. Please consult the coordinator for clarification."}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => toggleAttachments(log.log_id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white rounded-xl text-xs font-semibold transition-all"
                        style={{ border: `2px solid rgb(var(--primary-200))`, color: `rgb(var(--primary))` }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgb(var(--primary-medium))`; e.currentTarget.style.background = `rgb(var(--primary-50))`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = `rgb(var(--primary-200))`;    e.currentTarget.style.background = "white"; }}
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {`Attachments (${attachCount})`}
                        {openEvidenceLogId === log.log_id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {log.status === "revision" && (
                        <button
                          onClick={() => handleConsultLog(log)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl text-xs font-semibold text-blue-700 transition-all"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Consult Coordinator
                        </button>
                      )}

                      {(log.status === "revision" || log.status === "draft") && (
                        <button
                          onClick={() => handleEditLog(log)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-white rounded-xl text-xs font-semibold shadow hover:shadow-md transition-all"
                          style={{ background: "linear-gradient(to right, #f59e0b, #f97316)" }}
                        >
                          <AlertCircle className="w-3.5 h-3.5" /> Edit & Resubmit
                        </button>
                      )}
                    </div>

                    {/* Attachment panel */}
                    {openEvidenceLogId === log.log_id && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-1">
                        {loadingAttachment[log.log_id] && (
                          <div className="flex items-center gap-2 text-sm" style={{ color: `rgb(var(--primary-medium))` }}>
                            <div className="w-4 h-4 rounded-full animate-spin" style={{ border: `2px solid rgb(var(--primary-200))`, borderTopColor: `rgb(var(--primary-medium))` }} />
                            Loading attachments…
                          </div>
                        )}
                        {!loadingAttachment[log.log_id] && attachmentMap[log.log_id]?.length === 0 && (
                          <div className="text-center py-5">
                            <Paperclip className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                            <p className="text-xs text-gray-400 font-medium">No attachments uploaded</p>
                          </div>
                        )}
                        {!loadingAttachment[log.log_id] && attachmentMap[log.log_id]?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-bold mb-2" style={{ color: `rgb(var(--primary))` }}>Attached Files</p>
                            {attachmentMap[log.log_id].map((file) => (
                              <button
                                key={file.attachment_id}
                                onClick={() => setPreviewFile(file)}
                                className="w-full flex items-center gap-3 p-3 bg-white rounded-xl transition-all group text-left"
                                style={{ border: `1px solid rgb(var(--primary-100))` }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = `rgb(var(--primary-50))`; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "white"; }}
                              >
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-200))` }}>
                                  {file.file_type?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.file_name ?? "")
                                    ? <ImageIcon className="w-4 h-4" style={{ color: `rgb(var(--primary-500))` }} />
                                    : <FileText  className="w-4 h-4" style={{ color: `rgb(var(--primary-500))` }} />}
                                </div>
                                <span className="text-sm font-medium group-hover:underline flex-1 truncate" style={{ color: `rgb(var(--primary))` }}>
                                  {file.file_name}
                                </span>
                                <Eye className="w-4 h-4 shrink-0" style={{ color: `rgb(var(--primary-400))` }} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {!loadingLogs && logs.length > 3 && (
              <button
                onClick={() => setShowAllLogs((prev) => !prev)}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 bg-white"
                style={{ border: `2px dashed rgb(var(--primary-300))`, color: `rgb(var(--primary-medium))` }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgb(var(--primary-medium))`; e.currentTarget.style.background = `rgb(var(--primary-50))`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = `rgb(var(--primary-300))`;    e.currentTarget.style.background = "white"; }}
              >
                {showAllLogs
                  ? <><ChevronUp className="w-4 h-4" /> Show Less</>
                  : <><ChevronDown className="w-4 h-4" /> View All Logs ({logs.length})</>}
              </button>
            )}
          </div>
        </div>
      </div>

      {previewFile && <AttachmentModal file={previewFile} onClose={() => setPreviewFile(null)} />}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default DailyLogs;