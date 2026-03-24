import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, BookOpen, CheckCircle, AlertCircle,
  Clock, MessageSquare, ChevronDown, X, Download, Paperclip,
} from 'lucide-react';
import { getCoordinatorNarratives, updateNarrativeReview } from '../../api/narrative';
import Avatar from "../../components/ui/Avatar";
const BASE_URL = import.meta.env.VITE_BASE_URL;

// ─── Constants ────────────────────────────────────────────────────────────────
// "approved" uses primary CSS vars; amber/red are semantic — kept as Tailwind

const STATUS_CONFIG = {
  submitted: { label: 'Submitted',    pill: 'bg-amber-50 text-amber-700 border border-amber-200', icon: Clock        },
  revision:  { label: 'For Revision', pill: 'bg-red-50 text-red-600 border border-red-200',       icon: AlertCircle  },
  approved:  { label: 'Approved',     pill: null, icon: CheckCircle }, // rendered with CSS vars
};

const STATUS_OPTIONS = ['submitted', 'revision', 'approved'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const resolveFullName = (n) => {
  if (n.student_name && n.student_name.trim()) return n.student_name.trim();
  const f = (n.f_name ?? '').trim();
  const l = (n.l_name ?? '').trim();
  return [f, l].filter(Boolean).join(' ') || 'Unknown Student';
};

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const isImageFile = (url = '') =>
  /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);

// ─── StatusBadge ──────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  if (status === 'approved') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap border"
        style={{
          backgroundColor: `rgb(var(--primary-100))`,
          color:           `rgb(var(--primary-700))`,
          borderColor:     `rgb(var(--primary-200))`,
        }}
      >
        <CheckCircle className="w-3 h-3" />
        Approved
      </span>
    );
  }
  const config = STATUS_CONFIG[status] ?? { label: status, pill: 'bg-gray-100 text-gray-600 border border-gray-200', icon: Clock };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${config.pill}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

// ─── SkeletonRow ──────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <tr style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}>
    {[1, 2, 3].map((i) => (
      <td key={i} className="py-4 px-4">
        <div className="h-4 rounded animate-pulse" style={{ backgroundColor: `rgb(var(--primary-50))` }} />
      </td>
    ))}
  </tr>
);

// ─── SectionLabel ──────────────────────────────────────────────────────────────

const SectionLabel = ({ icon: Icon, label }) => (
  <div className="flex items-center gap-2 mb-4">
    <Icon className="w-4 h-4" style={{ color: `rgb(var(--primary-500))` }} />
    <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: `rgb(var(--primary-800))` }}>
      {label}
    </h3>
  </div>
);

// ─── ReviewModal ──────────────────────────────────────────────────────────────

const ReviewModal = ({ narrative, onClose, onSave }) => {
  const [status,   setStatus]   = useState(narrative.status);
  const [feedback, setFeedback] = useState(narrative.coordinator_remarks ?? '');
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  const hasContent  = narrative.content?.trim().length > 0;
  const attachments = useMemo(() => {
    if (Array.isArray(narrative.attachments) && narrative.attachments.length > 0)
      return narrative.attachments;
    if (narrative.attachment_url) return [narrative.attachment_url];
    return [];
  }, [narrative]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(narrative.narrative_id, { status, coordinator_feedback: feedback });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        style={{ border: `1px solid rgb(var(--primary-100))` }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{
            borderBottom: `1px solid rgb(var(--primary-100))`,
            background:   `linear-gradient(to right, rgb(var(--primary-50)), white)`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-400)), rgb(var(--primary-600)))` }}
            >
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: `rgb(var(--primary-800))` }}>
                Narrative Entry — {formatDate(narrative.created_at)}
              </h2>
              <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>
                {narrative.course}{narrative.company ? ` · ${narrative.company}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: `rgb(var(--primary-400))` }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`; e.currentTarget.style.color = `rgb(var(--primary-600))`; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = `rgb(var(--primary-400))`; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">

          {/* Left — Narrative Content + Attachments */}
          <div
            className="flex-1 overflow-y-auto p-6 border-b lg:border-b-0 lg:border-r space-y-6"
            style={{ borderColor: `rgb(var(--primary-100))` }}
          >
            {/* Narrative Content */}
            <div>
              <SectionLabel icon={FileText} label="Narrative Report" />
              {hasContent ? (
                <>
                  <style>{`
                    .narrative-body { font-size: 14px; line-height: 1.8; color: #1e293b; }
                    .narrative-body::after { content: ""; display: table; clear: both; }
                    .narrative-body h1 { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 10px;
                      border-bottom: 2px solid rgb(var(--primary-300)); padding-bottom: 6px;
                      text-transform: uppercase; letter-spacing: 0.05em; }
                    .narrative-body h2 { font-size: 16px; font-weight: 700; color: #1e293b; margin-top: 20px;
                      margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em;
                      border-bottom: 1px solid rgb(var(--primary-200)); padding-bottom: 4px; }
                    .narrative-body p  { margin-bottom: 12px; text-align: justify; }
                    .narrative-body ul { padding-left: 22px; margin-bottom: 12px; list-style-type: disc; }
                    .narrative-body ol { padding-left: 22px; margin-bottom: 12px; list-style-type: decimal; }
                    .narrative-body li { margin-bottom: 5px; }
                    .narrative-body strong { font-weight: 700; }
                    .narrative-body em    { font-style: italic; }
                    .narrative-body img   { max-width: 100%; height: auto; border-radius: 6px; margin: 12px 0; }
                    .narrative-body img[style*="float: left"], .narrative-body img[style*="float:left"]   { margin-right: 16px; margin-bottom: 8px; }
                    .narrative-body img[style*="float: right"], .narrative-body img[style*="float:right"] { margin-left: 16px; margin-bottom: 8px; }
                    .narrative-body a { color: rgb(var(--primary-600)); text-decoration: underline; }
                  `}</style>
                  <div className="narrative-body prose prose-sm max-w-none overflow-hidden">
                    <div dangerouslySetInnerHTML={{ __html: narrative.content }} />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `rgb(var(--primary-50))` }}
                  >
                    <FileText className="w-6 h-6" style={{ color: `rgb(var(--primary-300))` }} />
                  </div>
                  <p className="text-sm italic" style={{ color: `rgb(var(--primary-400))` }}>
                    No narrative content submitted yet.
                  </p>
                </div>
              )}
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Paperclip className="w-4 h-4" style={{ color: `rgb(var(--primary-500))` }} />
                  <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: `rgb(var(--primary-800))` }}>
                    Attachments ({attachments.length})
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {attachments.map((url, idx) =>
                    isImageFile(url) ? (
                      <div
                        key={idx}
                        className="rounded-xl overflow-hidden shadow-sm group relative"
                        style={{ border: `1px solid rgb(var(--primary-100))` }}
                      >
                        <img src={url} alt={`Attachment ${idx + 1}`} className="w-full h-28 object-cover" />
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all duration-200"
                        >
                          <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-black/50 px-2 py-1 rounded-lg transition-opacity">
                            View
                          </span>
                        </a>
                      </div>
                    ) : (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-3 py-3 rounded-xl transition group"
                        style={{
                          backgroundColor: `rgb(var(--primary-50))`,
                          border:          `1px solid rgb(var(--primary-100))`,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-100))`; e.currentTarget.style.borderColor = `rgb(var(--primary-300))`; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`;  e.currentTarget.style.borderColor = `rgb(var(--primary-100))`; }}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `rgb(var(--primary-200))` }}
                        >
                          <Download className="w-4 h-4" style={{ color: `rgb(var(--primary-700))` }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: `rgb(var(--primary-800))` }}>
                            {url.split('/').pop().split('?')[0] || `File ${idx + 1}`}
                          </p>
                          <p className="text-[10px]" style={{ color: `rgb(var(--primary-500))` }}>Click to download</p>
                        </div>
                      </a>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right — Review Panel */}
          <div
            className="w-full lg:w-72 xl:w-80 shrink-0 flex flex-col overflow-y-auto p-6 space-y-5"
            style={{ backgroundColor: `rgb(var(--primary-50) / 0.3)` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4" style={{ color: `rgb(var(--primary-500))` }} />
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: `rgb(var(--primary-800))` }}>Review</h3>
            </div>

            {/* Submission Meta */}
            <div className="bg-white rounded-xl p-4 space-y-3" style={{ border: `1px solid rgb(var(--primary-100))` }}>
              <div>
                <p className="text-xs font-medium" style={{ color: `rgb(var(--primary-500))` }}>Submitted</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: `rgb(var(--primary-800))` }}>
                  {formatDate(narrative.created_at)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: `rgb(var(--primary-500))` }}>Current Status</p>
                <StatusBadge status={narrative.status} />
              </div>
            </div>

            {/* Status Dropdown */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: `rgb(var(--primary-700))` }}>
                Update Status
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full appearance-none bg-white text-sm rounded-lg px-3 py-2.5 pr-8 cursor-pointer transition outline-none"
                  style={{ border: `1px solid rgb(var(--primary-200))`, color: `rgb(var(--primary-800))` }}
                  onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                  onBlur={e =>  { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{STATUS_CONFIG[opt]?.label ?? opt}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `rgb(var(--primary-400))` }} />
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>Preview:</span>
                <StatusBadge status={status} />
              </div>
            </div>

            {/* Feedback textarea */}
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: `rgb(var(--primary-700))` }}>
                Coordinator Feedback
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Write your feedback or comments here…"
                rows={7}
                className="w-full text-sm bg-white rounded-lg px-3 py-2.5 resize-none outline-none transition leading-relaxed"
                style={{ border: `1px solid rgb(var(--primary-200))`, color: `rgb(var(--primary-800))` }}
                onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = `rgb(var(--primary-300))`; }}
                onBlur={e =>  { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
              />
              <p className="text-xs mt-1 text-right" style={{ color: `rgb(var(--primary-400))` }}>
                {feedback.length} characters
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-lg active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 shadow-sm"
                style={{ backgroundColor: `rgb(var(--primary-600))` }}
                onMouseEnter={e => { if (!saving) e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`; }}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}
              >
                {saving ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                ) : saved ? (
                  <><CheckCircle className="w-4 h-4" />Saved!</>
                ) : (
                  <><CheckCircle className="w-4 h-4" />Save Changes</>
                )}
              </button>
              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 text-sm font-semibold bg-white rounded-lg active:scale-[0.98] transition-all duration-150"
                style={{ color: `rgb(var(--primary-700))`, border: `1px solid rgb(var(--primary-200))` }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const StudentNarrative = () => {
  const { studentId } = useParams();
  const navigate      = useNavigate();

  const [narratives, setNarratives] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [selected,   setSelected]   = useState(null);

  useEffect(() => {
    getCoordinatorNarratives()
      .then((data) => {
        const studentNarratives = (data ?? [])
          .filter((n) => String(n.student_id) === String(studentId));
        studentNarratives.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setNarratives(studentNarratives);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [studentId]);

  const student = useMemo(() => {
    if (narratives.length === 0) return null;
    const n = narratives[0];
    return { full_name: resolveFullName(n), student_id: n.student_id, course: n.course ?? '', company: n.company ?? '', photo: n.photo ?? '' };
  }, [narratives]);

  const stats = useMemo(() => ({
    total:     narratives.length,
    submitted: narratives.filter((n) => n.status === 'submitted').length,
    approved:  narratives.filter((n) => n.status === 'approved').length,
    revision:  narratives.filter((n) => n.status === 'revision').length,
  }), [narratives]);

  const handleSave = async (narrativeId, updates) => {
    try {
      await updateNarrativeReview(narrativeId, { status: updates.status, remarks: updates.coordinator_feedback });
      setNarratives((prev) =>
        prev.map((n) => n.narrative_id === narrativeId
          ? { ...n, status: updates.status, coordinator_remarks: updates.coordinator_feedback }
          : n)
      );
      setSelected((prev) =>
        prev?.narrative_id === narrativeId
          ? { ...prev, status: updates.status, coordinator_remarks: updates.coordinator_feedback }
          : prev
      );
    } catch (err) {
      console.error('Failed to update narrative:', err);
    }
  };

  return (
    <>
      <div
        className="min-h-screen p-6"
        style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), white)` }}
      >
        <div className="max-w-5xl mx-auto space-y-5">

          {/* Back Button */}
          <button
            onClick={() => navigate('/coordinator/narratives')}
            className="flex items-center gap-1.5 text-sm font-semibold transition-colors"
            style={{ color: `rgb(var(--primary-600))` }}
            onMouseEnter={e => e.currentTarget.style.color = `rgb(var(--primary-800))`}
            onMouseLeave={e => e.currentTarget.style.color = `rgb(var(--primary-600))`}
          >
            <ArrowLeft className="w-4 h-4" />Back to Narratives
          </button>

          {/* Student Info Card */}
          {!loading && student && (
            <div className="bg-white rounded-2xl shadow-sm px-6 py-5" style={{ border: `1px solid rgb(var(--primary-50))` }}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <Avatar name={student.full_name} src={student.photo ? `${BASE_URL}${student.photo}` : ""} size="lg" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-bold" style={{ color: `rgb(var(--primary-800))` }}>{student.full_name}</h1>
                  <p className="text-sm mt-0.5" style={{ color: `rgb(var(--primary-500))` }}>
                    {student.course}{student.company ? ` · ${student.company}` : ''}
                  </p>
                </div>
                {/* Mini stats — approved uses primary; pending (amber) + revision (red) stay semantic */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex flex-col items-center bg-amber-50 border border-amber-100 rounded-lg px-4 py-2">
                    <span className="text-lg font-bold text-amber-600">{stats.submitted}</span>
                    <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Pending</span>
                  </div>
                  <div
                    className="flex flex-col items-center rounded-lg px-4 py-2"
                    style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}
                  >
                    <span className="text-lg font-bold" style={{ color: `rgb(var(--primary-600))` }}>{stats.approved}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--primary-500))` }}>Approved</span>
                  </div>
                  <div className="flex flex-col items-center bg-red-50 border border-red-100 rounded-lg px-4 py-2">
                    <span className="text-lg font-bold text-red-500">{stats.revision}</span>
                    <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wide">Revision</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Narrative List Table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid rgb(var(--primary-50))` }}>

            {/* Table Header Bar */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" style={{ color: `rgb(var(--primary-500))` }} />
                <h2 className="text-base font-bold" style={{ color: `rgb(var(--primary-800))` }}>Narrative Entries</h2>
              </div>
              {!loading && (
                <span className="text-xs font-medium" style={{ color: `rgb(var(--primary-400))` }}>
                  {stats.total} entr{stats.total !== 1 ? 'ies' : 'y'}
                </span>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: `rgb(var(--primary-50) / 0.6)` }}>
                    {['Date Submitted', 'Status', 'Action'].map((col) => (
                      <th
                        key={col}
                        className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: `rgb(var(--primary-600))` }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : error ? (
                    <tr>
                      <td colSpan={3} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                            <AlertCircle className="w-6 h-6 text-red-300" />
                          </div>
                          <p className="text-sm font-semibold text-red-600">Failed to load narratives</p>
                          <p className="text-xs text-red-400">Please refresh the page or try again later.</p>
                        </div>
                      </td>
                    </tr>
                  ) : narratives.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `rgb(var(--primary-50))` }}>
                            <FileText className="w-6 h-6" style={{ color: `rgb(var(--primary-300))` }} />
                          </div>
                          <p className="text-sm font-semibold" style={{ color: `rgb(var(--primary-700))` }}>No narrative submissions yet</p>
                          <p className="text-xs" style={{ color: `rgb(var(--primary-400))` }}>This student has not submitted any narratives.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    narratives.map((narrative, idx) => (
                      <tr
                        key={narrative.narrative_id}
                        className="transition-colors duration-150 group"
                        style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50) / 0.5)`}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                      >
                        {/* Date */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}
                            >
                              <FileText className="w-4 h-4" style={{ color: `rgb(var(--primary-400))` }} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold" style={{ color: `rgb(var(--primary-800))` }}>
                                {formatDate(narrative.created_at)}
                              </p>
                              <p className="text-xs" style={{ color: `rgb(var(--primary-400))` }}>Entry {narratives.length - idx}</p>
                            </div>
                          </div>
                        </td>
                        {/* Status */}
                        <td className="py-4 px-6"><StatusBadge status={narrative.status} /></td>
                        {/* Action */}
                        <td className="py-4 px-6">
                          <button
                            onClick={() => setSelected(narrative)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-sm font-medium rounded-lg active:scale-95 transition-all duration-150 shadow-sm group-hover:shadow-md whitespace-nowrap"
                            style={{ backgroundColor: `rgb(var(--primary-600))` }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}
                          >
                            <BookOpen className="w-3.5 h-3.5" />View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            {!loading && !error && narratives.length > 0 && (
              <div
                className="px-6 py-3 flex items-center justify-between"
                style={{ borderTop: `1px solid rgb(var(--primary-50))`, backgroundColor: `rgb(var(--primary-50) / 0.3)` }}
              >
                <p className="text-xs" style={{ color: `rgb(var(--primary-500))` }}>
                  {stats.total} entr{stats.total !== 1 ? 'ies' : 'y'} total
                </p>
                <div className="flex items-center gap-4 text-xs" style={{ color: `rgb(var(--primary-500))` }}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: `rgb(var(--primary-500))` }} />
                    Approved
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Pending
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Revision
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <ReviewModal narrative={selected} onClose={() => setSelected(null)} onSave={handleSave} />
      )}
    </>
  );
};

export default StudentNarrative;