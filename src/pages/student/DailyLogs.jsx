import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Plus,
  Calendar,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  LogIn,
  LogOut,
  Timer,
  TriangleAlert,
  Eye,
  MessageSquare,
} from "lucide-react";

import {
  addLog,
  uploadLogAttachment,
  updateRevisionAttachment,
  getMyLogs,
  updateLog,
  getLogAttachment,
} from "../../api/logs";
import { getStudentAttendance } from "../../api/attendance";

const API_URL = import.meta.env.VITE_API_URL;

/* ─────────────────────────────────────────
   SKELETON CARD
───────────────────────────────────────── */
const SkeletonCard = () => (
  <div
    className="bg-white rounded-2xl p-6 animate-pulse"
    style={{ border: `2px solid rgb(var(--primary-100))` }}
  >
    <div
      className="flex items-center justify-between mb-4 pb-4"
      style={{ borderBottom: `1px solid rgb(var(--primary-100))` }}
    >
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
      <div className="h-4 bg-gray-200 rounded w-4/6" />
    </div>
    <div className="flex gap-3 mt-4">
      <div className="h-9 w-32 bg-gray-200 rounded-xl" />
      <div className="h-9 w-28 bg-gray-200 rounded-xl" />
    </div>
  </div>
);

/* ─────────────────────────────────────────
   ATTACHMENT PREVIEW MODAL
───────────────────────────────────────── */
const AttachmentModal = ({ file, onClose }) => {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);

    const loadFile = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${API_URL}/logs/attachments/${file.attachment_id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) throw new Error("Failed to load file");
        const blob = await res.blob();
        setSrc(URL.createObjectURL(blob));
      } catch (err) {
        console.error("Attachment preview error:", err);
      }
    };

    loadFile();
    return () => window.removeEventListener("keydown", handleKey);
  }, [file, onClose]);

  const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(file.file_name);

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      style={{ animation: "fadeIn 0.18s ease" }}
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "scaleIn 0.2s ease" }}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.6))`,
            borderBottom: `1px solid rgb(var(--primary-100))`,
          }}
        >
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4" style={{ color: `rgb(var(--primary-medium))` }} />
            <span className="text-sm font-semibold truncate max-w-xs" style={{ color: `rgb(var(--primary-dark))` }}>
              {file.file_name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ backgroundColor: `rgb(var(--primary-100))` }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-200))`}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-100))`}
          >
            <X className="w-4 h-4" style={{ color: `rgb(var(--primary))` }} />
          </button>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-50">
          {!src ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: `rgb(var(--primary-medium))` }}>
              <div
                className="w-5 h-5 rounded-full animate-spin"
                style={{ border: `2px solid rgb(var(--primary-200))`, borderTopColor: `rgb(var(--primary-medium))` }}
              />
              Loading preview…
            </div>
          ) : isImage ? (
            <img src={src} alt={file.file_name} className="max-h-[75vh] max-w-full object-contain rounded-lg shadow" />
          ) : (
            <iframe
              src={src}
              title={file.file_name}
              className="w-full rounded-lg"
              style={{ height: "75vh", border: `1px solid rgb(var(--primary-100))` }}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 }                         to { opacity: 1 } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
      `}</style>
    </div>
  );
};

/* ─────────────────────────────────────────
   NOTIFICATION BANNER
   (amber/red states are semantic — kept as Tailwind)
───────────────────────────────────────── */
const NotificationBanner = ({ notification, onDismiss }) => {
  if (!notification) return null;
  const isSuccess = notification.type === "success";
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border-2 px-5 py-4 shadow-md transition-all
        ${isSuccess ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}
      style={{ animation: "slideDown 0.25s ease" }}
      role="alert"
    >
      <div className={`mt-0.5 shrink-0 ${isSuccess ? "text-emerald-500" : "text-red-500"}`}>
        {isSuccess ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
      </div>
      <p className="text-sm font-medium flex-1">{notification.message}</p>
      <button
        onClick={onDismiss}
        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0
          ${isSuccess ? "hover:bg-emerald-100 text-emerald-600" : "hover:bg-red-100 text-red-600"}`}
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const formatTime = (timeStr) => {
  if (!timeStr) return "—";
  const [h, m, s] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, s || 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};

const computeHours = (timeIn, timeOut) => {
  if (!timeIn || !timeOut) return null;
  const start = new Date(`1970-01-01T${timeIn}`);
  const end = new Date(`1970-01-01T${timeOut}`);
  return Math.floor((end - start) / 36e5);
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

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
const DailyLogs = () => {
  const [showForm, setShowForm] = useState(false);
  const [logText, setLogText] = useState("");
  const [editingLogId, setEditingLogId] = useState(null);
  const [notification, setNotification] = useState(null);
  const notificationTimerRef = useRef(null);
  const [attendance, setAttendance] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentMap, setAttachmentMap] = useState({});
  const [loadingAttachment, setLoadingAttachment] = useState({});
  const [openEvidenceLogId, setOpenAttachmentLogId] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);

  const location = useLocation();
  const revisionId = new URLSearchParams(location.search).get("revision");
  const revisionHandledRef = useRef(false);
  const revisionCardRef = useRef(null);
  const navigate = useNavigate();
  const formRef = useRef(null);
  const MAX_CHARS = 800;

  /* ── NOTIFICATIONS ── */
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

  /* ── FETCH LOGS ── */
  const fetchLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const data = await getMyLogs();
      const sorted = (Array.isArray(data.logs) ? data.logs : []).sort(
        (a, b) => new Date(b.log_date) - new Date(a.log_date)
      );
      setLogs(sorted);
    } catch (err) {
      console.error("Failed to fetch logs", err);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  /* ── FETCH ATTENDANCE ── */
  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const data = await getStudentAttendance();
        if (!data) { setAttendance(null); return; }
        const d = new Date(data.attendance_date);
        const logDate = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
        setAttendance({
          attendance_date: logDate,
          time_in: data.time_in,
          time_out: data.time_out || null,
          total_hours: computeHours(data.time_in, data.time_out),
        });
      } catch (err) {
        console.error("Attendance fetch error:", err);
        setAttendance(null);
      }
    };
    fetchAttendance();
  }, []);

  /* ── FETCH ATTACHMENTS ── */
  const fetchAttachments = useCallback(async (logId) => {
    if (attachmentMap[logId] !== undefined) return;
    try {
      setLoadingAttachment((prev) => ({ ...prev, [logId]: true }));
      const files = await getLogAttachment(logId);
      setAttachmentMap((prev) => ({ ...prev, [logId]: Array.isArray(files) ? files : files?.attachments || [] }));
    } catch (err) {
      console.error("Failed to fetch attachments", err);
      setAttachmentMap((prev) => ({ ...prev, [logId]: [] }));
    } finally {
      setLoadingAttachment((prev) => ({ ...prev, [logId]: false }));
    }
  }, [attachmentMap]);

  /* ── REVISION DEEP-LINK ── */
  useEffect(() => {
    if (!revisionId || logs.length === 0 || revisionHandledRef.current) return;
    const target = logs.find((l) => String(l.log_id) === String(revisionId));
    if (target) {
      revisionHandledRef.current = true;
      if (logs.indexOf(target) >= 3) setShowAllLogs(true);
      setEditingLogId(target.log_id);
      setLogText(target.narrative || "");
      setUploadedFiles([]);
      setShowForm(true);
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
      setTimeout(() => revisionCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
      showNotification(
        `Log from ${formatDateOnly(target.log_date)} was flagged for revision. Please review and resubmit.`,
        "error"
      );
    }
  }, [revisionId, logs, showNotification]);

  /* ── HANDLERS ── */
  const handleFileSelect = (e) => setUploadedFiles((prev) => [...prev, ...Array.from(e.target.files)]);
  const removeFile = (index) => setUploadedFiles((prev) => prev.filter((_, i) => i !== index));

  const resetForm = useCallback(() => {
    setEditingLogId(null);
    setLogText("");
    setUploadedFiles([]);
  }, []);

  const handleEditLog = (log) => {
    setEditingLogId(log.log_id);
    setLogText(log.narrative || "");
    setUploadedFiles([]);
    setAttendance({
      attendance_date: log.log_date,
      time_in: log.time_in,
      time_out: log.time_out,
      total_hours: log.total_hours,
    });
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const attendanceIncomplete = attendance && !attendance.time_out;

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
          await updateRevisionAttachment(logId, uploadedFiles);
          setAttachmentMap((prev) => { const u = { ...prev }; delete u[logId]; return u; });
        }
      } else {
        const result = await addLog({ log_date: attendance.attendance_date, narrative: logText });
        if (!result?.log_id) throw new Error(result?.message || "Failed to create log");
        logId = result.log_id;
        for (const file of uploadedFiles) await uploadLogAttachment(logId, file);
      }
      resetForm();
      setShowForm(false);
      await fetchLogs();
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

  const handleConsultLog = (log) => {
    navigate(`/student/messages?log=${log.log_id}&date=${encodeURIComponent(formatDateOnly(log.log_date))}`);
  };

  /* ── STATUS CONFIG (amber/blue/gray are semantic — kept as Tailwind) ── */
  const statusConfig = {
    approved: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle className="w-3.5 h-3.5" />, label: "Approved" },
    revision: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <AlertCircle className="w-3.5 h-3.5" />, label: "Needs Revision" },
    draft: { cls: "bg-gray-100 text-gray-600 border-gray-200", icon: <Clock className="w-3.5 h-3.5" />, label: "Draft" },
    submitted: { cls: "bg-blue-50 text-blue-700 border-blue-200", icon: <Clock className="w-3.5 h-3.5" />, label: "Submitted" },
  };
  const getStatus = (s) => statusConfig[s] || statusConfig.submitted;

  const visibleLogs = showAllLogs ? logs : logs.slice(0, 3);

  /* ── RENDER ── */
  return (
    <div
      className="min-h-screen p-4 sm:p-8"
      style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.4), rgb(var(--primary-50)))` }}
    >
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── PAGE HEADER ── */}
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

        {/* ── NOTIFICATION BANNER ── */}
        <NotificationBanner notification={notification} onDismiss={dismissNotification} />

        {/* ── NARRATIVE REPORT SHORTCUT ── */}
        <div
          className="rounded-2xl p-5 shadow-md"
          style={{
            background: `linear-gradient(to right, rgb(var(--primary-medium)), rgb(var(--primary)))`,
            border: `1px solid rgb(var(--primary) / 0.3)`,
          }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <h3 className="text-base font-bold text-white">Narrative Report</h3>
                <p className="text-xs" style={{ color: `rgb(var(--primary-300))` }}>
                  Write your official OJT narrative for final submission
                </p>
              </div>
            </div>
            <button
              onClick={() => (window.location.href = "/student/narrative")}
              className="font-semibold px-5 py-2.5 rounded-xl shadow hover:shadow-md transition-all text-sm whitespace-nowrap bg-white hover:bg-gray-50"
              style={{ color: `rgb(var(--primary))` }}
            >
              Go to Narrative →
            </button>
          </div>
        </div>

        {/* ── ADD LOG BUTTON ── */}
        <button
          onClick={() => {
            if (showForm && !editingLogId) { setShowForm(false); resetForm(); }
            else { resetForm(); setShowForm(true); }
          }}
          className="w-full text-white rounded-2xl py-4 px-6 font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.01]"
          style={{ background: `linear-gradient(to right, rgb(var(--primary-medium)), rgb(var(--primary-500)))` }}
          onMouseEnter={e => e.currentTarget.style.background = `linear-gradient(to right, rgb(var(--primary)), rgb(var(--primary-medium)))`}
          onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(to right, rgb(var(--primary-medium)), rgb(var(--primary-500)))`}
        >
          <Plus className="w-5 h-5" />
          <span>{showForm && !editingLogId ? "Close Form" : "Add New Log Entry"}</span>
        </button>

        {/* ══════════════════════════════════════════
            FORM CARD
        ══════════════════════════════════════════ */}
        {showForm && (
          <div
            ref={formRef}
            className="bg-white rounded-2xl shadow-xl overflow-hidden"
            style={{ border: `2px solid rgb(var(--primary-100))`, animation: "slideDown 0.25s ease" }}
          >
            {/* Form header */}
            <div
              className="px-6 py-5 flex items-center gap-3"
              style={{
                background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.5))`,
                borderBottom: `2px solid rgb(var(--primary-100))`,
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `rgb(var(--primary-100))` }}
              >
                <FileText className="w-5 h-5" style={{ color: `rgb(var(--primary-medium))` }} />
              </div>
              <h2 className="text-xl font-bold" style={{ color: `rgb(var(--primary-dark))` }}>
                {editingLogId ? "Edit Daily Log — Revision" : "New Daily Log Entry"}
              </h2>
            </div>

            <div className="p-6 space-y-6">

              {/* ── ATTENDANCE READ-ONLY ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: `rgb(var(--primary))` }}>
                    Attendance Record
                  </span>
                  <span className="text-xs text-gray-400 font-normal">(system-generated · read-only)</span>
                </div>

                {attendanceIncomplete && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3 mb-3">
                    <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                    <span>
                      <strong>Attendance incomplete.</strong> Please complete your time-out before submitting a daily log.
                    </span>
                  </div>
                )}

                {attendance ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { icon: <Calendar className="w-4 h-4" style={{ color: `rgb(var(--primary-medium))` }} />, label: "Date", value: formatDateOnly(attendance.attendance_date) },
                      { icon: <LogIn className="w-4 h-4" style={{ color: `rgb(var(--primary-medium))` }} />, label: "Time In", value: formatTime(attendance.time_in) },
                      {
                        icon: <LogOut className="w-4 h-4" style={{ color: `rgb(var(--primary-medium))` }} />, label: "Time Out",
                        value: attendance.time_out
                          ? formatTime(attendance.time_out)
                          : <span className="text-amber-500 font-semibold">Pending</span>,
                      },
                      { icon: <Timer className="w-4 h-4" style={{ color: `rgb(var(--primary-medium))` }} />, label: "Total Hours", value: attendance.total_hours != null ? `${attendance.total_hours}h` : "—" },
                    ].map(({ icon, label, value }) => (
                      <div key={label} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-1.5 mb-1 text-gray-500">
                          {icon}
                          <span className="text-xs font-medium">{label}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-700">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-sm text-gray-400 italic">
                    No attendance record found for today.
                  </div>
                )}
              </div>

              {/* ── LOG TEXT ── */}
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
                  onFocus={e => {
                    e.target.style.borderColor = `rgb(var(--primary-medium))`;
                    e.target.style.boxShadow = `0 0 0 4px rgb(var(--primary-100))`;
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = `rgb(var(--primary-200))`;
                    e.target.style.boxShadow = "none";
                  }}
                />
                <div className={`text-right text-xs mt-1 font-medium ${logText.length >= MAX_CHARS ? "text-red-500" : "text-gray-400"}`}>
                  {logText.length} / {MAX_CHARS}
                </div>
              </div>

              {/* ── ATTACHMENT ── */}
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: `rgb(var(--primary))` }}>
                  Attachment <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <label
                  className="rounded-xl p-6 text-center cursor-pointer block transition-all"
                  style={{
                    border: `2px dashed rgb(var(--primary-300))`,
                    background: `linear-gradient(to bottom right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.4))`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = `linear-gradient(to bottom right, rgb(var(--primary-100)), rgb(var(--primary-200) / 0.4))`}
                  onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(to bottom right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.4))`}
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
                        onMouseEnter={e => e.currentTarget.style.background = `rgb(var(--primary-100))`}
                        onMouseLeave={e => e.currentTarget.style.background = `rgb(var(--primary-50))`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                            {file.type.startsWith("image/")
                              ? <ImageIcon className="w-3.5 h-3.5" style={{ color: `rgb(var(--primary-medium))` }} />
                              : <FileText className="w-3.5 h-3.5" style={{ color: `rgb(var(--primary-medium))` }} />}
                          </div>
                          <span className="text-xs truncate font-medium" style={{ color: `rgb(var(--primary-dark))` }}>{file.name}</span>
                        </div>
                        <button onClick={() => removeFile(i)} className="ml-2 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-100 transition-all shrink-0">
                          <X className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── FORM ACTIONS ── */}
              <div
                className="flex flex-col sm:flex-row gap-3 pt-2"
                style={{ borderTop: `2px solid rgb(var(--primary-100))` }}
              >
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !!attendanceIncomplete || !logText.trim() || !attendance}
                  className="flex-1 text-white py-3.5 rounded-xl font-semibold shadow hover:shadow-lg transition-all disabled:cursor-not-allowed text-sm"
                  style={
                    isSubmitting || !!attendanceIncomplete || !logText.trim() || !attendance
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
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `rgb(var(--primary-medium))`;
                    e.currentTarget.style.background = `rgb(var(--primary-50))`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = `rgb(var(--primary-300))`;
                    e.currentTarget.style.background = "white";
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            LOG HISTORY
        ══════════════════════════════════════════ */}
        <div
          className="bg-white rounded-2xl shadow-xl overflow-hidden"
          style={{ border: `2px solid rgb(var(--primary-100))` }}
        >
          {/* Section header */}
          <div
            className="px-6 py-5 flex items-center gap-3"
            style={{
              background: `linear-gradient(to right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.5))`,
              borderBottom: `2px solid rgb(var(--primary-100))`,
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `rgb(var(--primary-100))` }}
            >
              <Clock className="w-5 h-5" style={{ color: `rgb(var(--primary-medium))` }} />
            </div>
            <h2 className="text-xl font-bold" style={{ color: `rgb(var(--primary-dark))` }}>Recent Daily Logs</h2>
          </div>

          <div className="p-6 space-y-4">
            {/* SKELETON */}
            {loadingLogs && [1, 2, 3].map((i) => <SkeletonCard key={i} />)}

            {/* EMPTY */}
            {!loadingLogs && logs.length === 0 && (
              <div className="text-center py-16">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: `rgb(var(--primary-50))` }}
                >
                  <FileText className="w-8 h-8" style={{ color: `rgb(var(--primary-300))` }} />
                </div>
                <p className="font-semibold" style={{ color: `rgb(var(--primary))` }}>No logs yet</p>
                <p className="text-sm mt-1" style={{ color: `rgb(var(--primary-500))` }}>
                  Start by adding your first daily log entry above.
                </p>
              </div>
            )}

            {/* LOG CARDS */}
            {!loadingLogs && visibleLogs.map((log) => {
              const st = getStatus(log.status);
              const attachCount = attachmentMap[log.log_id]?.length ?? 0;
              const isRevisionTarget = revisionId && String(log.log_id) === String(revisionId);

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
                    style={{
                      background: `linear-gradient(to right, rgb(var(--primary-50) / 0.6), rgb(var(--primary-100) / 0.4))`,
                      borderBottom: `1px solid rgb(var(--primary-100))`,
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0"
                        style={{ border: `1px solid rgb(var(--primary-100))` }}
                      >
                        <Calendar className="w-4 h-4" style={{ color: `rgb(var(--primary-medium))` }} />
                      </div>
                      <span className="font-bold text-base" style={{ color: `rgb(var(--primary-dark))` }}>
                        {formatDate(log.log_date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {log.status === "revision" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-semibold bg-blue-50 border border-blue-200 px-2 py-1 rounded-full">
                          <MessageSquare className="w-2.5 h-2.5" />
                          Discussion Available
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${st.cls}`}>
                        {st.icon}{st.label}
                      </span>
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-4">
                    {/* Revision consultation banner */}
                    {log.status === "revision" && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <div className="text-sm text-blue-800">
                          This log requires revision. You may review the coordinator feedback below and continue the discussion in the{" "}
                          <button
                            onClick={() => handleConsultLog(log)}
                            className="font-semibold underline underline-offset-2 hover:text-blue-600 transition-colors"
                          >
                            Consultation Hub
                          </button>.
                        </div>
                      </div>
                    )}

                    {/* Attendance pills */}
                    {(log.time_in || log.time_out || log.total_hours) && (
                      <div className="flex flex-wrap gap-2">
                        {log.time_in && (
                          <span className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-200 text-gray-600 rounded-lg px-2.5 py-1.5">
                            <LogIn className="w-3 h-3" /> {formatTime(log.time_in)}
                          </span>
                        )}
                        {log.time_out && (
                          <span className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-200 text-gray-600 rounded-lg px-2.5 py-1.5">
                            <LogOut className="w-3 h-3" /> {formatTime(log.time_out)}
                          </span>
                        )}
                        {log.total_hours && (
                          <span
                            className="inline-flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 font-medium"
                            style={{
                              background: `rgb(var(--primary-50))`,
                              border: `1px solid rgb(var(--primary-200))`,
                              color: `rgb(var(--primary))`,
                            }}
                          >
                            <Timer className="w-3 h-3" /> {log.total_hours}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Log text */}
                    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                      <p className="text-sm text-gray-700 leading-relaxed">{log.narrative || "—"}</p>
                    </div>

                    {/* Coordinator feedback */}
                    {log.status === "revision" && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Coordinator Feedback</span>
                        </div>
                        <p className="text-sm text-amber-800 leading-relaxed">
                          {log.feedback?.trim()
                            ? log.feedback
                            : "Coordinator requested revision. Please consult the coordinator for clarification."}
                        </p>
                      </div>
                    )}

                    {/* Actions row */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {/* View attachments */}
                      <button
                        onClick={() => toggleAttachments(log.log_id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white rounded-xl text-xs font-semibold transition-all"
                        style={{ border: `2px solid rgb(var(--primary-200))`, color: `rgb(var(--primary))` }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = `rgb(var(--primary-medium))`;
                          e.currentTarget.style.background = `rgb(var(--primary-50))`;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = `rgb(var(--primary-200))`;
                          e.currentTarget.style.background = "white";
                        }}
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {attachCount !== undefined ? `Attachments (${attachCount})` : "View Attachments"}
                        {openEvidenceLogId === log.log_id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {/* Consult Coordinator */}
                      {log.status === "revision" && (
                        <button
                          onClick={() => handleConsultLog(log)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl text-xs font-semibold text-blue-700 transition-all"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Consult Coordinator
                        </button>
                      )}

                      {/* Edit & Resubmit */}
                      {(log.status === "revision" || log.status === "draft") && (
                        <button
                          onClick={() => handleEditLog(log)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-semibold shadow hover:shadow-md transition-all"
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
                            <div
                              className="w-4 h-4 rounded-full animate-spin"
                              style={{ border: `2px solid rgb(var(--primary-200))`, borderTopColor: `rgb(var(--primary-medium))` }}
                            />
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
                                onMouseEnter={e => e.currentTarget.style.background = `rgb(var(--primary-50))`}
                                onMouseLeave={e => e.currentTarget.style.background = "white"}
                              >
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                  style={{ background: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-200))` }}
                                >
                                  <Paperclip className="w-4 h-4" style={{ color: `rgb(var(--primary-500))` }} />
                                </div>
                                <span
                                  className="text-sm font-medium group-hover:underline flex-1 truncate"
                                  style={{ color: `rgb(var(--primary))` }}
                                >
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

            {/* VIEW ALL / SHOW LESS */}
            {!loadingLogs && logs.length > 3 && (
              <button
                onClick={() => setShowAllLogs((prev) => !prev)}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 bg-white"
                style={{ border: `2px dashed rgb(var(--primary-300))`, color: `rgb(var(--primary-medium))` }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = `rgb(var(--primary-medium))`;
                  e.currentTarget.style.background = `rgb(var(--primary-50))`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = `rgb(var(--primary-300))`;
                  e.currentTarget.style.background = "white";
                }}
              >
                {showAllLogs
                  ? <><ChevronUp className="w-4 h-4" /> Show Less</>
                  : <><ChevronDown className="w-4 h-4" /> View All Logs ({logs.length})</>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ATTACHMENT MODAL */}
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