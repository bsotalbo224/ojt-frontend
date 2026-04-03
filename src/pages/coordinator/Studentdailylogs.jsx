import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText, Eye, CheckCircle, RefreshCcw, X, Paperclip,
  ArrowLeft, Loader2, InboxIcon, MessageSquare, User, BookOpen, Download,
  Building2, Clock, CalendarDays, Briefcase,
} from 'lucide-react';
import {
  getCoordinatorLogs, getCoordinatorLogDetails, approveLog, rejectLog,
} from '../../api/logs';
import Avatar from "../../components/ui/Avatar";

const BASE_URL = import.meta.env.VITE_BASE_URL;

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  submitted: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  approved:  null,
  revision:  'bg-red-100 text-red-800 border border-red-200',
};

const STATUS_DOT = {
  submitted: 'bg-yellow-400',
  approved:  null,
  revision:  'bg-red-400',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isImage = (file) => {
  if (file.file_type && file.file_type.startsWith("image/")) return true;
  const name = file.file_name?.toLowerCase() || "";
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].some((ext) => name.endsWith(ext));
};

const loadAttachment = async (file) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE_URL}/api/logs/attachments/${file.attachment_id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load attachment');
  return URL.createObjectURL(await res.blob());
};

const downloadAttachment = async (file) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE_URL}/api/logs/attachments/${file.attachment_id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Download failed');
  const url = window.URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url; a.download = file.file_name;
  document.body.appendChild(a); a.click(); a.remove();
  window.URL.revokeObjectURL(url);
};

const formatTime = (value) => {
  if (!value) return '—';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      // Try parsing as plain time string like "08:00:00"
      const [h, m] = value.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
};

const formatDate = (value) => {
  if (!value) return '—';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '—';
  }
};

// ─── StatusBadge ──────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  if (status === 'approved') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border"
        style={{
          backgroundColor: `rgb(var(--primary-100))`,
          color:           `rgb(var(--primary-800))`,
          borderColor:     `rgb(var(--primary-200))`,
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `rgb(var(--primary-500))` }} />
        approved
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700 border border-gray-200'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] ?? 'bg-gray-400'}`} />
      {status}
    </span>
  );
};

// ─── SectionLabel ─────────────────────────────────────────────────────────────

const SectionLabel = ({ icon: Icon, label }) => (
  <div className="flex items-center gap-1.5 mb-1.5">
    <Icon className="w-3.5 h-3.5" style={{ color: `rgb(var(--primary-500))` }} />
    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--primary-700))` }}>
      {label}
    </span>
  </div>
);

// ─── DetailField ──────────────────────────────────────────────────────────────

const DetailField = ({ icon: Icon, label, value }) => (
  <div className="flex flex-col gap-0.5">
    <div className="flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" style={{ color: `rgb(var(--primary-400))` }} />}
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: `rgb(var(--primary-500))` }}>
        {label}
      </span>
    </div>
    <span className="text-sm font-semibold pl-0.5" style={{ color: `rgb(var(--primary-800))` }}>
      {value || '—'}
    </span>
  </div>
);

// ─── useModalOverlay ──────────────────────────────────────────────────────────

const useModalOverlay = (isOpen) => {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);
};

// ─── ImagePreviewModal ────────────────────────────────────────────────────────

const ImagePreviewModal = ({ src, fileName, onClose }) => {
  useModalOverlay(!!src);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 animate-overlayIn bg-black/70 backdrop-blur-md"
      style={{ zIndex: 9999 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative max-w-3xl w-full animate-fadeIn">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 bg-white rounded-full p-1.5 shadow-lg text-gray-500 hover:text-gray-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
          <img src={src} alt={fileName} className="w-full max-h-[75vh] object-contain" />
          {fileName && (
            <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500 truncate">{fileName}</span>
              <a
                href={src}
                download={fileName}
                className="inline-flex items-center gap-1 text-xs font-medium shrink-0 ml-3 transition-colors"
                style={{ color: `rgb(var(--primary-600))` }}
                onMouseEnter={e => e.currentTarget.style.color = `rgb(var(--primary-800))`}
                onMouseLeave={e => e.currentTarget.style.color = `rgb(var(--primary-600))`}
              >
                <Download className="w-3.5 h-3.5" />Download
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── LogModal ─────────────────────────────────────────────────────────────────

const LogModal = ({ log, onClose, onApprove, onRevision, startRevision }) => {
  const [feedback,        setFeedback]        = useState('');
  const [revisionMode,    setRevisionMode]    = useState(startRevision || false);
  const [previewImage,    setPreviewImage]    = useState(null);
  const [previewFileName, setPreviewFileName] = useState('');

  useModalOverlay(!!log);

  if (!log) return null;

  const handleRevisionSubmit = () => {
    onRevision(log.log_id, feedback);
    setFeedback('');
    setRevisionMode(false);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 flex items-center justify-center p-4 animate-overlayIn bg-black/60 backdrop-blur-md"
        style={{ zIndex: 9998 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fadeIn"
          style={{ zIndex: 9999 }}
        >

          {/* Modal Header */}
          <div
            className="sticky top-0 bg-white px-6 py-4 flex items-center justify-between rounded-t-2xl z-10"
            style={{ borderBottom: `1px solid rgb(var(--primary-100))` }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `rgb(var(--primary-100))` }}>
                <FileText className="w-5 h-5" style={{ color: `rgb(var(--primary-600))` }} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: `rgb(var(--primary-800))` }}>
                  Daily Log Entry
                </h2>
                <p className="text-xs" style={{ color: `rgb(var(--primary-600))` }}>
                  {log.f_name} {log.l_name} &bull;{' '}
                  {log.log_date
                    ? new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                    : '—'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={log.status} />
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="px-6 py-5 space-y-5">

            {/* Student Info */}
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}
            >
              <div className="p-2.5 rounded-full" style={{ backgroundColor: `rgb(var(--primary-200))` }}>
                <User className="w-4 h-4" style={{ color: `rgb(var(--primary-700))` }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
                {log.f_name} {log.l_name}
              </p>
            </div>

            {/* ── Log Details ─────────────────────────────────────────────── */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <SectionLabel icon={Briefcase} label="Log Details" />
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <DetailField
                  icon={User}
                  label="Student Name"
                  value={log.f_name && log.l_name ? `${log.f_name} ${log.l_name}` : null}
                />
                <DetailField
                  icon={Building2}
                  label="Company"
                  value={log.company_name}
                />
                <DetailField
                  icon={Briefcase}
                  label="Department"
                  value={log.department_name}
                />
                <DetailField
                  icon={CalendarDays}
                  label="Date"
                  value={formatDate(log.log_date)}
                />
                <DetailField
                  icon={Clock}
                  label="Time In"
                  value={formatTime(log.time_in)}
                />
                <DetailField
                  icon={Clock}
                  label="Time Out"
                  value={formatTime(log.time_out)}
                />
                <DetailField
                  icon={Clock}
                  label="Total Hours"
                  value={log.total_hours != null ? `${log.total_hours} hours` : null}
                />
              </div>
            </div>

            {/* Daily Narrative */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <SectionLabel icon={BookOpen} label="Daily Logs" />
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                {log.narrative || <span className="italic text-gray-400">No narrative recorded.</span>}
              </p>
            </div>

            {/* Attachments */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <SectionLabel icon={Paperclip} label="Attachments" />
              {log.attachments && log.attachments.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-1">
                  {log.attachments.map((file) =>
                    isImage(file) ? (
                      <button
                        key={file.attachment_id}
                        onClick={async () => {
                          const src = await loadAttachment(file);
                          setPreviewImage(src);
                          setPreviewFileName(file.file_name);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium transition-colors"
                        style={{ border: `1px solid rgb(var(--primary-200))`, color: `rgb(var(--primary-700))` }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                      >
                        <Paperclip className="w-3 h-3" />{file.file_name}
                      </button>
                    ) : (
                      <button
                        key={file.attachment_id}
                        onClick={() => downloadAttachment(file)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium transition-colors"
                        style={{ border: `1px solid rgb(var(--primary-200))`, color: `rgb(var(--primary-700))` }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                      >
                        <Download className="w-3 h-3" />{file.file_name}
                      </button>
                    )
                  )}
                </div>
              ) : (
                <p className="text-sm italic text-gray-400">No attachments.</p>
              )}
            </div>

            {/* Coordinator Feedback */}
            {log.status === 'revision' && log.feedback && (
              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <SectionLabel icon={MessageSquare} label="Coordinator Feedback" />
                <p className="text-sm text-red-800 leading-relaxed whitespace-pre-line">{log.feedback}</p>
              </div>
            )}

            {/* Revision Textarea */}
            {revisionMode && (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <SectionLabel icon={MessageSquare} label="Revision Feedback" />
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Describe what the student needs to revise or improve..."
                  rows={4}
                  className="w-full mt-1 text-sm border border-amber-200 rounded-lg p-3 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
              </div>
            )}
          </div>

          {/* Modal Footer */}
          {log.status === 'submitted' && (
            <div
              className="sticky bottom-0 bg-white px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl"
              style={{ borderTop: `1px solid rgb(var(--primary-100))` }}
            >
              {!revisionMode ? (
                <>
                  <button
                    onClick={() => setRevisionMode(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
                  >
                    <RefreshCcw className="w-4 h-4" />Mark for Revision
                  </button>
                  <button
                    onClick={() => { onApprove(log.log_id); onClose(); }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
                    style={{ backgroundColor: `rgb(var(--primary-600))` }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}
                  >
                    <CheckCircle className="w-4 h-4" />Approve
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setRevisionMode(false); setFeedback(''); }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRevisionSubmit}
                    disabled={!feedback.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCcw className="w-4 h-4" />Submit Revision Request
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {previewImage && (
        <ImagePreviewModal
          src={previewImage}
          fileName={previewFileName}
          onClose={() => { setPreviewImage(null); setPreviewFileName(''); }}
        />
      )}
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const StudentDailyLogs = () => {
  const { studentId } = useParams();
  const navigate      = useNavigate();

  const [logs,        setLogs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await getCoordinatorLogs();
        const all      = Array.isArray(data) ? data : [];
        const filtered = all.filter((log) => String(log.student_id) === String(studentId));
        setLogs(filtered);
        if (filtered.length > 0) {
          setStudentInfo({ f_name: filtered[0].f_name, l_name: filtered[0].l_name, photo: filtered[0].photo });
        }
      } catch (err) {
        console.error('Failed to fetch logs:', err);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [studentId]);

  const handleApprove = async (logId) => {
    await approveLog(logId);
    setLogs((prev) => prev.map((log) => log.log_id === logId ? { ...log, status: 'approved' } : log));
  };

  const handleRevision = async (logId, feedback) => {
    await rejectLog(logId, feedback);
    setLogs((prev) => prev.map((log) => log.log_id === logId ? { ...log, status: 'revision', feedback } : log));
  };

  const truncate = (text, limit = 80) =>
    text && text.length > limit ? `${text.slice(0, limit)}…` : text || '—';

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), white)` }}
    >
      <div className="max-w-7xl mx-auto">

        {/* Back button */}
        <button
          onClick={() => navigate('/coordinator/daily-logs')}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: `rgb(var(--primary-600))` }}
          onMouseEnter={e => e.currentTarget.style.color = `rgb(var(--primary-800))`}
          onMouseLeave={e => e.currentTarget.style.color = `rgb(var(--primary-600))`}
        >
          <ArrowLeft className="w-4 h-4" />Back to Students
        </button>

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="flex items-center gap-4">
            <Avatar
              name={`${studentInfo?.f_name} ${studentInfo?.l_name}`}
              src={studentInfo?.photo}
              size="xl"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: `rgb(var(--primary-800))` }}>
                {studentInfo ? `${studentInfo.f_name} ${studentInfo.l_name}` : studentId}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: `rgb(var(--primary-600))` }}>Daily Log History</p>
            </div>
          </div>
          <div
            className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-1.5 shadow-sm self-start sm:self-auto"
            style={{ border: `1px solid rgb(var(--primary-200))` }}
          >
            <FileText className="w-4 h-4" style={{ color: `rgb(var(--primary-500))` }} />
            <span className="text-sm font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
              {logs.length}{' '}
              <span className="font-normal" style={{ color: `rgb(var(--primary-600))` }}>
                {logs.length === 1 ? 'log' : 'total logs'}
              </span>
            </span>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24" style={{ color: `rgb(var(--primary-500))` }}>
              <Loader2 className="w-10 h-10 animate-spin mb-3" />
              <p className="text-sm font-medium" style={{ color: `rgb(var(--primary-600))` }}>Loading logs…</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
              <div
                className="p-5 rounded-2xl mb-4"
                style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}
              >
                <InboxIcon className="w-10 h-10" style={{ color: `rgb(var(--primary-300))` }} />
              </div>
              <h3 className="text-base font-semibold mb-1" style={{ color: `rgb(var(--primary-800))` }}>No logs found</h3>
              <p className="text-sm max-w-xs" style={{ color: `rgb(var(--primary-500))` }}>
                This student hasn't submitted any daily logs yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: `rgb(var(--primary-50))`, borderBottom: `1px solid rgb(var(--primary-100))` }}>
                    {['Date', 'Logs', 'Status', 'Actions'].map((col, i) => (
                      <th
                        key={col}
                        className={`text-left py-3.5 px-${i === 0 || i === 3 ? '5' : '4'} text-xs font-semibold uppercase tracking-wide ${i === 1 ? 'hidden md:table-cell' : ''}`}
                        style={{ color: `rgb(var(--primary-700))` }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.log_id}
                      className="transition-colors"
                      style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50) / 0.6)`}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                    >
                      {/* Date */}
                      <td className="py-3.5 px-5">
                        <span className="text-sm font-medium whitespace-nowrap" style={{ color: `rgb(var(--primary-700))` }}>
                          {log.log_date
                            ? new Date(log.log_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : '—'}
                        </span>
                      </td>
                      {/* Narrative preview */}
                      <td className="py-3.5 px-4 hidden md:table-cell">
                        <span className="text-sm text-gray-600">{truncate(log.narrative)}</span>
                      </td>
                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={log.status} />
                      </td>
                      {/* Actions */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* View */}
                          <button
                            onClick={async () => {
                              const fullLog = await getCoordinatorLogDetails(log.log_id);
                              setSelectedLog(fullLog);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors"
                            style={{ backgroundColor: `rgb(var(--primary-600))` }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}
                          >
                            <Eye className="w-3.5 h-3.5" />View
                          </button>
                          {/* Approve */}
                          {log.status === 'submitted' && (
                            <button
                              onClick={() => handleApprove(log.log_id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-xs font-medium rounded-lg transition-colors"
                              style={{ color: `rgb(var(--primary-700))`, border: `1px solid rgb(var(--primary-200))` }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Approve</span>
                            </button>
                          )}
                          {/* Revise */}
                          {log.status === 'submitted' && (
                            <button
                              onClick={async () => {
                                const fullLog = await getCoordinatorLogDetails(log.log_id);
                                setSelectedLog({ ...fullLog, _startRevision: true });
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-600 border border-red-200 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <RefreshCcw className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Revise</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Table Footer */}
              <div
                className="px-5 py-3 flex items-center justify-between"
                style={{ borderTop: `1px solid rgb(var(--primary-50))`, backgroundColor: `rgb(var(--primary-50) / 0.5)` }}
              >
                <p className="text-xs" style={{ color: `rgb(var(--primary-600))` }}>
                  Showing{' '}
                  <span className="font-semibold" style={{ color: `rgb(var(--primary-800))` }}>{logs.length}</span>{' '}
                  {logs.length === 1 ? 'log' : 'logs'}
                </p>
                <p className="text-xs italic" style={{ color: `rgb(var(--primary-500))` }}>
                  Attendance determines official hours. Daily logs are for documentation only.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedLog && (
        <LogModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onApprove={handleApprove}
          onRevision={handleRevision}
          startRevision={selectedLog._startRevision}
        />
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes overlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .animate-fadeIn    { animation: fadeIn    0.2s ease-out both; }
        .animate-overlayIn { animation: overlayIn 0.2s ease-out both; }
      `}</style>
    </div>
  );
};

export default StudentDailyLogs;