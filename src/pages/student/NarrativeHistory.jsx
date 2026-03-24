import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from "../../api/axios";
import {
  FileText, Eye, Edit3, Calendar, MessageSquare,
  ChevronRight, Inbox, CheckCircle2,
  Clock, RotateCcw, BookOpen, AlertCircle, X, FileCheck
} from 'lucide-react';

/* ─────────────────────────────────────────
   Paper size config
   Note: minHeight removed from here — applied
   contextually in the modal vs. print export.
───────────────────────────────────────────*/
const PAPER_SIZES = {
  A4:     { label: "A4",     maxWidth: "794px" },
  Letter: { label: "Letter", maxWidth: "816px" },
  Legal:  { label: "Legal",  maxWidth: "816px" },
};

/* ─────────────────────────────────────────
   Read a CSS variable as a hex string for
   use inside injected <style> blocks and
   print windows that can't access :root vars.
   Returns e.g. "rgb(22, 163, 74)".
───────────────────────────────────────────*/
const cssVarRgb = (name, fallback = "22 163 74") => {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim() || fallback;
  const [r, g, b] = raw.split(/\s+/).map(Number);
  return `rgb(${r}, ${g}, ${b})`;
};
const cssVarRgba = (name, alpha, fallback = "22 163 74") => {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim() || fallback;
  const [r, g, b] = raw.split(/\s+/).map(Number);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/* ─────────────────────────────────────────
   Build PREVIEW_STYLES at inject-time so
   the CSS picks up the active theme vars.
   Includes overflow/word-break fixes and
   improved image, table, pre/code support.
───────────────────────────────────────────*/
const buildPreviewStyles = () => `
.narrative-preview {
  width: 100%;
  overflow: hidden;
  word-break: break-word;
  overflow-wrap: break-word;
}
.narrative-preview h1 {
  font-size: 21px;
  font-weight: 700;
  margin-bottom: 12px;
  border-bottom: 2px solid ${cssVarRgb("--primary-100")};
  padding-bottom: 6px;
  color: #0f172a;
}
.narrative-preview h2 {
  font-size: 17px;
  font-weight: 700;
  margin: 20px 0 8px;
  border-bottom: 1px solid ${cssVarRgb("--primary-200")};
  color: ${cssVarRgb("--primary-800")};
}
.narrative-preview h3 {
  font-size: 15px;
  font-weight: 700;
  margin: 16px 0 6px;
  color: #1e293b;
}
.narrative-preview p {
  margin-bottom: 14px;
  text-align: justify;
  word-break: break-word;
  overflow-wrap: break-word;
}
.narrative-preview ul,
.narrative-preview ol {
  padding-left: 24px;
  margin-bottom: 14px;
}
.narrative-preview li {
  margin-bottom: 5px;
  word-break: break-word;
}
.narrative-preview strong { color: #0f172a; }
.narrative-preview em { color: #374151; }
.narrative-preview img {
  max-width: 100%;
  width: auto;
  height: auto;
  display: block;
  border-radius: 6px;
  margin: 12px auto;
}
.narrative-preview blockquote {
  border-left: 3px solid ${cssVarRgb("--primary-600")};
  padding-left: 16px;
  margin: 16px 0;
  color: #475569;
  font-style: italic;
  word-break: break-word;
}
.narrative-preview a {
  color: ${cssVarRgb("--primary-700")};
  text-decoration: underline;
  word-break: break-all;
}
.narrative-preview table {
  width: 100%;
  display: block;
  overflow-x: auto;
  border-collapse: collapse;
  margin-bottom: 14px;
  font-size: 14px;
}
.narrative-preview th,
.narrative-preview td {
  border: 1px solid #e2e8f0;
  padding: 8px 12px;
  text-align: left;
  word-break: break-word;
}
.narrative-preview th {
  background: #f8fafc;
  font-weight: 700;
  color: #374151;
}
.narrative-preview pre {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 14px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  overflow-x: hidden;
  font-size: 13px;
  color: #1e293b;
}
.narrative-preview code {
  background: #f1f5f9;
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
}
.narrative-preview pre code {
  background: transparent;
  padding: 0;
}
`;

/* ─────────────────────────────────────────
   Status config
───────────────────────────────────────────*/
const statusConfig = {
  draft: {
    label: 'Draft',
    bg: 'bg-slate-100', text: 'text-slate-700',
    border: 'border-slate-200', dot: 'bg-slate-400',
    icon: Edit3,
    inlineStyle: null,
  },
  submitted: {
    label: 'Submitted',
    bg: '', text: '', border: '', dot: '',
    icon: Clock,
    inlineStyle: true,
  },
  revision: {
    label: 'Revision',
    bg: 'bg-amber-50', text: 'text-amber-800',
    border: 'border-amber-200', dot: 'bg-amber-500',
    icon: RotateCcw,
    inlineStyle: null,
  },
  approved: {
    label: 'Approved',
    bg: '', text: '', border: '', dot: '',
    icon: CheckCircle2,
    inlineStyle: true,
  },
};

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────────*/
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return {
    short: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    full:  date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    year:  date.getFullYear(),
  };
};

/* ─────────────────────────────────────────
   StatusBadge
───────────────────────────────────────────*/
const StatusBadge = ({ status }) => {
  const config = statusConfig[status] || statusConfig.draft;

  if (config.inlineStyle) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
        style={{
          backgroundColor: `rgb(var(--primary-50))`,
          color:           `rgb(var(--primary-700))`,
          borderColor:     `rgb(var(--primary-200))`,
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: `rgb(var(--primary-500))` }}
        />
        {config.label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} shrink-0`} />
      {config.label}
    </span>
  );
};

/* ─────────────────────────────────────────
   SkeletonRow
───────────────────────────────────────────*/
const SkeletonRow = () => (
  <div className="flex items-center gap-4 p-4 border-b border-slate-100 animate-pulse">
    <div className="w-14 h-14 rounded-xl bg-slate-100 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-slate-100 rounded w-32" />
      <div className="h-3 bg-slate-100 rounded w-48" />
    </div>
    <div className="h-6 bg-slate-100 rounded-full w-20" />
    <div className="h-8 bg-slate-100 rounded-lg w-16" />
  </div>
);

/* ─────────────────────────────────────────
   exportNarrative — reads CSS vars at call
   time so the print window matches the theme.
   Print layout is unchanged — uses A4 fixed
   dimensions as before.
───────────────────────────────────────────*/
function exportNarrative(narrative) {
  const p50  = cssVarRgb("--primary-50");
  const p200 = cssVarRgb("--primary-200");
  const p600 = cssVarRgb("--primary-600");
  const p700 = cssVarRgb("--primary-700");
  const p800 = cssVarRgb("--primary-800");

  const formattedDate = new Date(narrative.narrative_date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const statusLabel =
    (narrative.status || 'draft').charAt(0).toUpperCase() +
    (narrative.status || 'draft').slice(1);

  const remarksBlock = narrative.coordinator_remarks?.trim()
    ? `<p class="section-label">Coordinator Remarks</p>
       <div class="remarks"><p>${narrative.coordinator_remarks}</p></div>`
    : '';

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>OJT Narrative Report — ${formattedDate}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', serif; font-size: 13pt; line-height: 1.75; color: #1a1a1a; background: #fff; padding: 56px 72px; max-width: 794px; margin: 0 auto; }
    .report-header { border-bottom: 3px solid ${p600}; padding-bottom: 20px; margin-bottom: 28px; }
    .report-header .label { font-size: 9pt; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: ${p600}; margin-bottom: 6px; }
    .report-header h1 { font-size: 22pt; font-weight: 700; color: #0f172a; margin-bottom: 14px; line-height: 1.2; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 32px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 20px; margin-bottom: 32px; font-size: 10pt; }
    .meta-item { display: flex; flex-direction: column; gap: 2px; }
    .meta-item .key { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; }
    .meta-item .val { font-weight: 600; color: #1e293b; }
    .status-pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
    .status-draft     { background: #f1f5f9; color: #475569; }
    .status-submitted { background: ${p50};  color: ${p700}; }
    .status-revision  { background: #fffbeb; color: #b45309; }
    .status-approved  { background: ${p50};  color: ${p800}; }
    .section-label { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 16px; }
    .content-body { margin-bottom: 36px; text-align: justify; word-break: break-word; overflow-wrap: break-word; }
    .content-body h1 { font-size: 16pt; font-weight: 700; color: #0f172a; margin: 0 0 10px; border-bottom: 2px solid ${p200}; padding-bottom: 6px; }
    .content-body h2 { font-size: 13pt; font-weight: 700; color: ${p800}; margin: 20px 0 8px; }
    .content-body p { margin-bottom: 12px; word-break: break-word; }
    .content-body ul { padding-left: 22px; margin-bottom: 12px; }
    .content-body li { margin-bottom: 5px; }
    .content-body strong { color: #0f172a; }
    .content-body em { color: #374151; }
    .content-body img { max-width: 100%; height: auto; display: block; border-radius: 6px; margin: 12px auto; }
    .content-body table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .content-body th, .content-body td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; font-size: 11pt; }
    .content-body th { background: #f8fafc; font-weight: 700; }
    .content-body pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; white-space: pre-wrap; word-break: break-word; font-size: 10pt; }
    .remarks { background: ${p50}; border: 1px solid ${p200}; border-left: 4px solid ${p600}; border-radius: 8px; padding: 16px 20px; margin-top: 8px; margin-bottom: 32px; }
    .remarks p { font-size: 11pt; color: ${p800}; line-height: 1.65; }
    .report-footer { margin-top: 52px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 8.5pt; color: #94a3b8; }
    @media print { body { padding: 40px 56px; } @page { margin: 20mm 18mm; } }
  </style>
</head>
<body>
  <div class="report-header">
    <p class="label">OJT Monitoring System</p>
    <h1>Daily Narrative Report</h1>
  </div>
  <div class="meta-grid">
    <div class="meta-item"><span class="key">Date</span><span class="val">${formattedDate}</span></div>
    <div class="meta-item"><span class="key">Status</span><span class="val"><span class="status-pill status-${narrative.status || 'draft'}">${statusLabel}</span></span></div>
  </div>
  <p class="section-label">Narrative Content</p>
  <div class="content-body">${narrative.content || '<p><em>No content recorded for this entry.</em></p>'}</div>
  ${remarksBlock}
  <div class="report-footer">
    <span>OJT Monitoring System — Narrative Report</span>
    <span>Exported ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
  </div>
  <script>window.onload = function () { window.print(); };<\/script>
</body>
</html>`);
  printWindow.document.close();
}

/* ─────────────────────────────────────────
   PaperSizeSelector
───────────────────────────────────────────*/
const PaperSizeSelector = ({ value, onChange }) => (
  <div className="flex items-center gap-1.5">
    <span className="text-xs text-slate-500 font-medium hidden sm:inline select-none">Size:</span>
    <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
      {Object.keys(PAPER_SIZES).map((key) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className="px-2.5 py-1 text-xs font-semibold transition-colors duration-150"
          style={
            value === key
              ? { backgroundColor: `rgb(var(--primary-600))`, color: 'white' }
              : { color: '#475569' }
          }
          onMouseEnter={e => { if (value !== key) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
          onMouseLeave={e => { if (value !== key) e.currentTarget.style.backgroundColor = ''; }}
        >
          {PAPER_SIZES[key].label}
        </button>
      ))}
    </div>
  </div>
);

/* ─────────────────────────────────────────
   Narrative Preview Modal
   
   Layout fixes applied:
   - Modal body is the ONLY scroll container
   - Paper uses auto height (not fixed A4 px)
   - Paper content has overflow:hidden + word-break
   - Smooth scrolling on body
───────────────────────────────────────────*/
const NarrativeModal = ({ narrative, onClose, onConsult }) => {
  const [paperSize, setPaperSize] = useState('A4');

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    const styleId = 'narrative-preview-styles';
    const existing = document.getElementById(styleId);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = buildPreviewStyles();
    document.head.appendChild(style);
    // Cleanup on unmount
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, [narrative]);

  if (!narrative) return null;

  const date   = formatDate(narrative.narrative_date);
  const config = statusConfig[narrative.status] || statusConfig.draft;
  const isRevision = narrative.status === 'revision';
  const paper  = PAPER_SIZES[paperSize];

  const handleBackdropClick = (e) => { if (e.target === e.currentTarget) onClose(); };

  const dateIconStyle = config.inlineStyle
    ? {
        backgroundColor: `rgb(var(--primary-50))`,
        borderColor:     `rgb(var(--primary-200))`,
      }
    : {};
  const dateIconTextClass = config.inlineStyle ? '' : `${config.text}`;
  const dateIconTextStyle = config.inlineStyle
    ? { color: `rgb(var(--primary-700))` }
    : {};

  return (
    <div
      className="fixed inset-0 z-[9999] isolate flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-5xl bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ maxHeight: '92vh' }}
      >
        {/* Modal Header — fixed, never scrolls */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center border shrink-0 ${!config.inlineStyle ? `${config.border} ${config.bg}` : ''}`}
              style={dateIconStyle}
            >
              <span className={`text-[9px] font-bold uppercase tracking-wide leading-tight ${dateIconTextClass}`} style={dateIconTextStyle}>
                {date.short.split(' ')[0]}
              </span>
              <span className={`text-sm font-bold leading-tight ${dateIconTextClass}`} style={dateIconTextStyle}>
                {date.short.split(' ')[1]}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-800">Narrative Entry</h2>
              <p className="text-xs text-slate-500 truncate">{date.full}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <PaperSizeSelector value={paperSize} onChange={setPaperSize} />
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors duration-150"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Modal Body — SOLE scroll container ── */}
        <div className="flex-1 overflow-y-auto scroll-smooth">

          {/* Revision notice banner */}
          {isRevision && (
            <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800">
                This narrative requires revision. Review the coordinator remarks below and continue the discussion in the{' '}
                <button onClick={onConsult} className="font-semibold underline underline-offset-2 hover:text-blue-600 transition-colors">
                  Consultation Hub
                </button>.
              </div>
            </div>
          )}

          {/* ── Paper area ──
              - bg-slate-100 "desk" behind the paper
              - Paper: auto height, overflow hidden, word-break
              - maxWidth controls paper size switching
              - No fixed minHeight — lets content dictate height
          */}
          <div className="bg-slate-100 mx-6 my-4 rounded-xl p-4">
            <div
              className="bg-white mx-auto shadow-lg rounded-sm transition-all duration-300"
              style={{
                maxWidth: paper.maxWidth,
                // height is auto — grows with content, no overflow
                width: '100%',
                padding: '56px 64px',
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: '15.5px',
                lineHeight: '1.85',
                color: '#1e293b',
                // Prevent paper itself from overflowing its wrapper
                overflow: 'hidden',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                boxSizing: 'border-box',
              }}
            >
              {narrative.content ? (
                <div
                  className="narrative-preview"
                  dangerouslySetInnerHTML={{ __html: narrative.content }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <FileText className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="text-sm text-slate-400 italic" style={{ fontFamily: 'system-ui, sans-serif' }}>
                    No content available for this entry.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Coordinator Remarks */}
          <div className="mx-6 mb-5 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-3.5 h-3.5" style={{ color: `rgb(var(--primary-600))` }} />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Coordinator Remarks</span>
            </div>
            {narrative.coordinator_remarks?.trim() ? (
              <div
                className="rounded-xl px-4 py-3"
                style={{
                  backgroundColor: `rgb(var(--primary-50))`,
                  border: `1px solid rgb(var(--primary-200))`,
                }}
              >
                <p className="text-sm leading-relaxed" style={{ color: `rgb(var(--primary-800))` }}>
                  {narrative.coordinator_remarks}
                </p>
              </div>
            ) : isRevision ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-sm text-amber-800 leading-relaxed italic">
                  Coordinator requested revision. Please consult the coordinator for clarification.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No remarks provided.</p>
            )}
          </div>
        </div>
        {/* ── end modal body ── */}

        {/* Modal Footer — fixed, never scrolls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0 flex-wrap gap-2">
          <StatusBadge status={narrative.status} />
          <div className="flex items-center gap-2">
            {isRevision && (
              <button
                onClick={onConsult}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 transition-colors duration-150"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Consult Coordinator
              </button>
            )}
            <button
              onClick={() => exportNarrative(narrative)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 transition-colors duration-150"
            >
              <FileCheck className="w-3.5 h-3.5" />
              Export
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors duration-150 shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   Main Component — unchanged from original
───────────────────────────────────────────*/
const NarrativesHistory = () => {
  const [narratives, setNarratives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState(null);
  const [viewNarrative, setViewNarrative] = useState(null);
  const navigate = useNavigate();

  const location  = useLocation();
  const revisionId = new URLSearchParams(location.search).get('revision');

  const loadNarratives = () => {
    setLoading(true);
    api.get('/narratives/student/me')
      .then((res) => {
        const data = res.data || [];
        data.sort((a, b) => new Date(b.narrative_date) - new Date(a.narrative_date));
        setNarratives(data);
      })
      .catch((err) => console.error("Failed to load narratives", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadNarratives(); }, []);

  useEffect(() => {
    const handleFocus = () => loadNarratives();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  useEffect(() => {
    if (!revisionId || narratives.length === 0) return;
    const target = narratives.find((n) => String(n.narrative_id) === String(revisionId));
    if (target) setViewNarrative(target);
  }, [revisionId, narratives]);

  const canEdit = (status) => status === 'draft' || status === 'revision';

  const handleConsultNarrative = (narrative) => {
    const narrativeDate = new Date(narrative.narrative_date).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
    navigate(`/student/messages?narrative=${narrative.narrative_id}&date=${encodeURIComponent(narrativeDate)}`);
  };

  const stats = {
    total:    narratives.length,
    approved: narratives.filter((n) => n.status === 'approved').length,
    pending:  narratives.filter((n) => n.status === 'submitted').length,
    revision: narratives.filter((n) => n.status === 'revision').length,
  };

  return (
    <div
      className="min-h-screen font-sans"
      style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-50)), rgb(var(--primary-100) / 0.4), rgb(var(--primary-50)))` }}
    >
      <NarrativeModal
        narrative={viewNarrative}
        onClose={() => setViewNarrative(null)}
        onConsult={() => { handleConsultNarrative(viewNarrative); setViewNarrative(null); }}
      />

      {/* ── Header ── */}
      <div
        className="bg-white shadow-sm"
        style={{ borderBottom: `1px solid rgb(var(--primary-100))` }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-1.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
              style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-500)), rgb(var(--primary-600)))` }}
            >
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Narratives History</h1>
          </div>
          <p className="text-slate-500 text-sm ml-13">
            Review your daily OJT narrative submissions and coordinator feedback.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Stats Row ── */}
        {!loading && narratives.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Entries', value: stats.total,    usePrimary: false, tw: { bg: 'bg-white', text: 'text-slate-700', border: 'border-slate-200' } },
              { label: 'Approved',      value: stats.approved, usePrimary: true  },
              { label: 'Under Review',  value: stats.pending,  usePrimary: true  },
              { label: 'For Revision',  value: stats.revision, usePrimary: false, tw: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' } },
            ].map((stat) => (
              stat.usePrimary ? (
                <div
                  key={stat.label}
                  className="rounded-xl px-4 py-3 text-center shadow-sm"
                  style={{
                    backgroundColor: `rgb(var(--primary-50))`,
                    border: `1px solid rgb(var(--primary-200))`,
                  }}
                >
                  <p className="text-2xl font-bold" style={{ color: `rgb(var(--primary-700))` }}>{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">{stat.label}</p>
                </div>
              ) : (
                <div key={stat.label} className={`${stat.tw.bg} border ${stat.tw.border} rounded-xl px-4 py-3 text-center shadow-sm`}>
                  <p className={`text-2xl font-bold ${stat.tw.text}`}>{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">{stat.label}</p>
                </div>
              )
            ))}
          </div>
        )}

        {/* ── Info Banner ── */}
        <div
          className="bg-white rounded-xl p-4 flex items-start gap-3 shadow-sm"
          style={{ border: `1px solid rgb(var(--primary-200))` }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: `rgb(var(--primary-100))` }}
          >
            <AlertCircle className="w-4 h-4" style={{ color: `rgb(var(--primary-600))` }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Read-Only View</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Approved and submitted narratives are view-only. You may edit entries marked as{' '}
              <span className="font-medium text-slate-600">Draft</span> or{' '}
              <span className="font-medium text-amber-600">Revision</span>.
            </p>
          </div>
        </div>

        {/* ── Table Card ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          <div className="hidden sm:grid grid-cols-[1fr_140px_1fr_220px] gap-4 px-6 py-3.5 bg-slate-50 border-b border-slate-200">
            {[
              { label: 'Date',                 icon: <Calendar className="w-3.5 h-3.5" /> },
              { label: 'Status',               icon: null },
              { label: 'Coordinator Remarks',  icon: <MessageSquare className="w-3.5 h-3.5" /> },
              { label: 'Action',               icon: null, right: true },
            ].map(({ label, icon, right }) => (
              <span key={label} className={`text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 ${right ? 'justify-end' : ''}`}>
                {icon}{label}
              </span>
            ))}
          </div>

          {loading && <div>{[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}</div>}

          {!loading && narratives.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: `linear-gradient(to bottom right, rgb(var(--primary-100)), rgb(var(--primary-50)))` }}
              >
                <Inbox className="w-8 h-8" style={{ color: `rgb(var(--primary-400))` }} />
              </div>
              <h3 className="text-base font-semibold text-slate-700 mb-1">No narratives yet</h3>
              <p className="text-sm text-slate-400 max-w-xs">
                You haven't submitted any narratives yet. Start logging your OJT experiences daily.
              </p>
            </div>
          )}

          {!loading && narratives.map((narrative) => {
            const date      = formatDate(narrative.narrative_date);
            const isHovered = hoveredId === narrative.narrative_id;
            const editable  = canEdit(narrative.status);
            const isRevision = narrative.status === 'revision';
            const config    = statusConfig[narrative.status] || statusConfig.draft;

            const dateIconStyle = config.inlineStyle
              ? { backgroundColor: `rgb(var(--primary-50))`, borderColor: `rgb(var(--primary-200))` }
              : {};
            const dateIconTextClass = config.inlineStyle ? '' : `${config.text}`;
            const dateIconTextStyle = config.inlineStyle ? { color: `rgb(var(--primary-700))` } : {};

            return (
              <div
                key={narrative.narrative_id}
                className={`group border-b border-slate-100 last:border-b-0 transition-colors duration-150 ${isRevision ? 'border-l-4 border-l-amber-400' : ''} ${isHovered ? 'bg-slate-50/80' : 'bg-white'}`}
                onMouseEnter={() => setHoveredId(narrative.narrative_id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* ── Desktop Row ── */}
                <div className="hidden sm:grid grid-cols-[1fr_140px_1fr_220px] gap-4 items-center px-6 py-4">

                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 border ${!config.inlineStyle ? `${config.border} ${config.bg}` : ''}`}
                      style={dateIconStyle}
                    >
                      <span className={`text-[10px] font-bold uppercase tracking-wider leading-tight ${dateIconTextClass}`} style={dateIconTextStyle}>
                        {date.short.split(' ')[0]}
                      </span>
                      <span className={`text-base font-bold leading-tight ${dateIconTextClass}`} style={dateIconTextStyle}>
                        {date.short.split(' ')[1]}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{date.full.split(',').slice(0, 2).join(',')}</p>
                      <p className="text-xs text-slate-400">{date.year}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <StatusBadge status={narrative.status} />
                    {isRevision && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-semibold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full w-fit">
                        <MessageSquare className="w-2.5 h-2.5" />
                        Discussion Available
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 space-y-1.5">
                    {narrative.coordinator_remarks?.trim() ? (
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-slate-600 truncate">{narrative.coordinator_remarks}</p>
                      </div>
                    ) : isRevision ? (
                      <p className="text-xs text-amber-600 italic">
                        Coordinator requested revision. Please consult the coordinator for clarification.
                      </p>
                    ) : (
                      <span className="text-xs text-slate-300 italic">No remarks</span>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 flex-wrap">
                    {isRevision && (
                      <button
                        onClick={() => handleConsultNarrative(narrative)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-xs rounded-lg font-semibold transition-colors duration-150"
                      >
                        <MessageSquare className="w-3 h-3" /> Consult
                      </button>
                    )}
                    <button
                      onClick={() => exportNarrative(narrative)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all duration-150 shadow-sm"
                    >
                      <FileCheck className="w-3.5 h-3.5" /> Export
                    </button>
                    <button
                      onClick={() => {
                        if (editable) {
                          navigate(`/student/narrative?revision=${narrative.narrative_id}`, {
                            state: { narrativeId: narrative.narrative_id },
                          });
                        } else {
                          setViewNarrative(narrative);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 shadow-sm text-white
                        ${editable ? 'bg-amber-500 hover:bg-amber-600 hover:shadow-amber-200 hover:shadow-md' : ''}
                      `}
                      style={!editable ? {
                        backgroundColor: `rgb(var(--primary-500))`,
                      } : {}}
                      onMouseEnter={e => { if (!editable) e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`; }}
                      onMouseLeave={e => { if (!editable) e.currentTarget.style.backgroundColor = `rgb(var(--primary-500))`; }}
                    >
                      {editable
                        ? <><Edit3 className="w-3.5 h-3.5" /> Edit</>
                        : <><Eye   className="w-3.5 h-3.5" /> View</>
                      }
                    </button>
                  </div>
                </div>

                {/* ── Mobile Row ── */}
                <div className="sm:hidden p-4">
                  <div
                    className="cursor-pointer"
                    onClick={() => {
                      if (editable) {
                        navigate(`/student/narrative?revision=${narrative.narrative_id}`, {
                          state: { narrativeId: narrative.narrative_id },
                        });
                      } else {
                        setViewNarrative(narrative);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 border ${!config.inlineStyle ? `${config.border} ${config.bg}` : ''}`}
                          style={dateIconStyle}
                        >
                          <span className={`text-[9px] font-bold uppercase leading-tight ${dateIconTextClass}`} style={dateIconTextStyle}>
                            {date.short.split(' ')[0]}
                          </span>
                          <span className={`text-sm font-bold leading-tight ${dateIconTextClass}`} style={dateIconTextStyle}>
                            {date.short.split(' ')[1]}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-800">{date.full.split(',').slice(0, 2).join(',')}</p>
                          <StatusBadge status={narrative.status} />
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                    </div>

                    {narrative.coordinator_remarks?.trim() ? (
                      <div className="ml-13 flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-700">{narrative.coordinator_remarks}</p>
                      </div>
                    ) : isRevision ? (
                      <div className="ml-13 mt-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                        <p className="text-xs text-amber-700 italic">
                          Coordinator requested revision. Please consult the coordinator for clarification.
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {isRevision && (
                    <div className="mt-3 space-y-2">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-800">
                          This narrative requires revision. You may continue the discussion in the Consultation Hub.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConsultNarrative(narrative)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-xs rounded-lg font-semibold transition-colors duration-150"
                        >
                          <MessageSquare className="w-3 h-3" /> Consult
                        </button>
                        <button
                          onClick={() => exportNarrative(narrative)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 text-xs rounded-lg font-semibold transition-colors duration-150"
                        >
                          <FileCheck className="w-3 h-3" /> Export
                        </button>
                      </div>
                    </div>
                  )}

                  {!isRevision && (
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); exportNarrative(narrative); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 text-xs rounded-lg font-semibold transition-colors duration-150"
                      >
                        <FileCheck className="w-3 h-3" /> Export
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!loading && narratives.length > 0 && (
          <p className="text-xs text-center text-slate-400 pb-4">
            Showing {narratives.length}{' '}
            {narratives.length === 1 ? 'entry' : 'entries'} · Updated in real-time
          </p>
        )}
      </div>
    </div>
  );
};

export default NarrativesHistory;