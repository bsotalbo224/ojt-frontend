import { useState, useEffect, useCallback } from "react";
import api from "../../api/axios";
import {
  ClipboardList, Eye, Search, X, Star, CheckCircle2,
  XCircle, ListChecks, User, Mail, BookOpen, Calendar,
  Building2, Send, Copy, Link2, Check, Layers, AlignLeft,
  ChevronUp, ChevronDown, GripVertical, ToggleLeft, ToggleRight,
  Plus, Trash2, Edit2, BarChart2, CheckSquare, AlignCenter,
  FileText, Filter, ChevronRight,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════════════════ */
const QUESTION_TYPES = [
  { value: "rating",          label: "Rating Scale",    icon: Star },
  { value: "yesno",           label: "Yes / No",        icon: CheckSquare },
  { value: "text",            label: "Text",             icon: AlignLeft },
  { value: "multiple_choice", label: "Multiple Choice", icon: ListChecks },
];

const RATING_SCALES = [
  { value: "1-5",    label: "1 – 5 Scale" },
  { value: "1-4",    label: "1 – 4 Scale" },
  { value: "custom", label: "Custom Labels" },
];

const uid          = () => Math.random().toString(36).slice(2, 9);
const newCriterion = () => ({ id: uid(), title: "", type: "rating", required: true, options: [] });
const newSection   = () => ({ id: uid(), title: "", criteria: [newCriterion()] });

const resolveOptionText = (opt, fallback = "") => {
  if (!opt) return fallback;
  if (typeof opt === "string") return opt;
  if (typeof opt === "object") return String(opt.option_text || fallback);
  return String(opt);
};

/* ══════════════════════════════════════════════════════════════════════════
   SHARED STYLE TOKENS — unified with CoordinatorNarratives design system
══════════════════════════════════════════════════════════════════════════ */
const card       = "bg-white rounded-2xl shadow-sm";
const cardBorder = { border: "1px solid rgb(var(--primary-50))" };

const btnPrimary = {
  base: "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-all duration-150 shadow-sm",
  style: { backgroundColor: "rgb(var(--primary-600))" },
  hoverStyle: { backgroundColor: "rgb(var(--primary-700))" },
};

const btnOutline = {
  base: "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 bg-white",
  style: { color: "rgb(var(--primary-600))", border: "1px solid rgb(var(--primary-200))" },
};

const btnGhost = {
  base: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
  style: { color: "rgb(var(--primary-500))" },
};

// Inline hover helpers — attach to onMouseEnter/onMouseLeave
const hoverPrimary = {
  enter: (e) => (e.currentTarget.style.backgroundColor = "rgb(var(--primary-700))"),
  leave: (e) => (e.currentTarget.style.backgroundColor = "rgb(var(--primary-600))"),
};
const hoverOutline = {
  enter: (e) => { e.currentTarget.style.borderColor = "rgb(var(--primary-300))"; e.currentTarget.style.color = "rgb(var(--primary-700))"; },
  leave: (e) => { e.currentTarget.style.borderColor = "rgb(var(--primary-200))"; e.currentTarget.style.color = "rgb(var(--primary-600))"; },
};
const hoverGhost = {
  enter: (e) => { e.currentTarget.style.backgroundColor = "rgb(var(--primary-50))"; e.currentTarget.style.color = "rgb(var(--primary-700))"; },
  leave: (e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "rgb(var(--primary-500))"; },
};
const hoverCard = {
  enter: (e) => { e.currentTarget.style.borderColor = "rgb(var(--primary-200))"; e.currentTarget.style.boxShadow = "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)"; },
  leave: (e) => { e.currentTarget.style.borderColor = "rgb(var(--primary-50))"; e.currentTarget.style.boxShadow = "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"; },
};

/* Reusable button components */
function PrimaryBtn({ children, onClick, disabled, style, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${btnPrimary.base} ${className}`}
      style={{ ...btnPrimary.style, ...style }}
      onMouseEnter={hoverPrimary.enter}
      onMouseLeave={hoverPrimary.leave}
    >
      {children}
    </button>
  );
}

function OutlineBtn({ children, onClick, disabled, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${btnOutline.base} ${className}`}
      style={btnOutline.style}
      onMouseEnter={hoverOutline.enter}
      onMouseLeave={hoverOutline.leave}
    >
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`${btnGhost.base} ${className}`}
      style={btnGhost.style}
      onMouseEnter={hoverGhost.enter}
      onMouseLeave={hoverGhost.leave}
    >
      {children}
    </button>
  );
}

const inputCls  = "w-full px-3 py-2 rounded-lg text-sm outline-none transition";
const selectCls = "w-full px-3 py-2 rounded-lg text-sm outline-none transition";

function StyledInput({ className = "", onFocus, onBlur, ...props }) {
  return (
    <input
      className={`${inputCls} ${className}`}
      style={{
        border: "1px solid rgb(var(--primary-200))",
        backgroundColor: "rgba(var(--primary-50), 0.4)",
        color: "rgb(var(--primary-800))",
      }}
      onFocus={(e) => {
        e.target.style.boxShadow = "0 0 0 2px rgb(var(--primary-300))";
        e.target.style.borderColor = "rgb(var(--primary-300))";
        onFocus?.(e);
      }}
      onBlur={(e) => {
        e.target.style.boxShadow = "none";
        e.target.style.borderColor = "rgb(var(--primary-200))";
        onBlur?.(e);
      }}
      {...props}
    />
  );
}

function StyledSelect({ className = "", ...props }) {
  return (
    <select
      className={`${selectCls} ${className}`}
      style={{
        border: "1px solid rgb(var(--primary-200))",
        backgroundColor: "rgba(var(--primary-50), 0.4)",
        color: "rgb(var(--primary-800))",
      }}
      {...props}
    />
  );
}

function StyledTextarea({ className = "", ...props }) {
  return (
    <textarea
      className={`${inputCls} resize-none ${className}`}
      style={{
        border: "1px solid rgb(var(--primary-200))",
        backgroundColor: "rgba(var(--primary-50), 0.4)",
        color: "rgb(var(--primary-800))",
      }}
      onFocus={(e) => {
        e.target.style.boxShadow = "0 0 0 2px rgb(var(--primary-300))";
        e.target.style.borderColor = "rgb(var(--primary-300))";
      }}
      onBlur={(e) => {
        e.target.style.boxShadow = "none";
        e.target.style.borderColor = "rgb(var(--primary-200))";
      }}
      {...props}
    />
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SKELETON CARD
══════════════════════════════════════════════════════════════════════════ */
const SkeletonCard = () => (
  <div
    className={`${card} p-5 space-y-4 animate-pulse`}
    style={cardBorder}
  >
    <div className="space-y-2">
      <div className="h-4 rounded w-3/4" style={{ backgroundColor: "rgb(var(--primary-100))" }} />
      <div className="h-3 rounded w-1/3" style={{ backgroundColor: "rgb(var(--primary-50))" }} />
    </div>
    <div className="grid grid-cols-3 gap-2">
      {[0,1,2].map(i => (
        <div key={i} className="h-16 rounded-lg" style={{ backgroundColor: "rgb(var(--primary-50))" }} />
      ))}
    </div>
    <div className="h-9 rounded-lg" style={{ backgroundColor: "rgb(var(--primary-100))" }} />
  </div>
);

/* ══════════════════════════════════════════════════════════════════════════
   PUBLISH CONFIRM DIALOG
══════════════════════════════════════════════════════════════════════════ */
function PublishConfirmDialog({ open, template, onCancel, onConfirm, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" style={{ border: "1px solid rgb(var(--primary-100))" }}>
        <div className="flex flex-col items-center text-center gap-3 pb-1">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgb(var(--primary-50))" }}>
            <Send size={20} style={{ color: "rgb(var(--primary-600))" }} />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: "rgb(var(--primary-800))" }}>Publish Template</h2>
            <p className="text-sm mt-1" style={{ color: "rgb(var(--primary-500))" }}>
              Publish{" "}
              <span className="font-semibold" style={{ color: "rgb(var(--primary-700))" }}>"{template?.name}"</span>?
              <br />A shareable link will be generated for supervisors.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <OutlineBtn onClick={onCancel} disabled={loading} className="flex-1 justify-center">Cancel</OutlineBtn>
          <PrimaryBtn onClick={onConfirm} disabled={loading} className="flex-1 justify-center">
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Publishing...</>
            ) : (
              <><Send size={14} /> Publish</>
            )}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PUBLISH LINK MODAL
══════════════════════════════════════════════════════════════════════════ */
function PublishLinkModal({ open, link, onClose }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5" style={{ border: "1px solid rgb(var(--primary-100))" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgb(var(--primary-50))" }}>
              <Link2 size={18} style={{ color: "rgb(var(--primary-600))" }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: "rgb(var(--primary-800))" }}>Evaluation Link</h2>
              <p className="text-xs mt-0.5" style={{ color: "rgb(var(--primary-500))" }}>Share this link with your supervisors.</p>
            </div>
          </div>
          <button onClick={onClose} className="transition-colors mt-0.5" style={{ color: "rgb(var(--primary-400))" }}
            onMouseEnter={e => e.currentTarget.style.color = "rgb(var(--primary-700))"}
            onMouseLeave={e => e.currentTarget.style.color = "rgb(var(--primary-400))"}
          >
            <X size={18} />
          </button>
        </div>

        {/* Link input — Google Forms-style */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "rgb(var(--primary-500))" }}>
            Supervisor Evaluation Link
          </label>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgb(var(--primary-50))", border: "1px solid rgb(var(--primary-200))" }}>
            <Link2 size={14} style={{ color: "rgb(var(--primary-400))" }} className="shrink-0" />
            <input
              readOnly
              value={link ?? ""}
              className="flex-1 bg-transparent text-sm outline-none cursor-text"
              style={{ color: "rgb(var(--primary-700))" }}
              onFocus={e => e.target.select()}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="h-5 flex items-center">
            {copied && (
              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "rgb(var(--primary-600))" }}>
                <Check size={13} /> Link copied!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <OutlineBtn onClick={onClose}>Close</OutlineBtn>
            <PrimaryBtn onClick={handleCopy}>
              <Copy size={14} /> {copied ? "Copied!" : "Copy Link"}
            </PrimaryBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TEMPLATE PREVIEW MODAL
══════════════════════════════════════════════════════════════════════════ */
function TemplatePreviewModal({ open, template, onClose }) {
  if (!open || !template) return null;
  const sections = Array.isArray(template.sections) ? template.sections : [];

  const renderInput = (criterion) => {
    switch (criterion.type) {
      case "rating": {
        const max = template.ratingSettings?.scale === "1-4" ? 4 : 5;
        return (
          <div className="flex items-center gap-1.5 mt-2">
            {Array.from({ length: max }, (_, i) => (
              <button key={i} type="button"
                className="w-8 h-8 rounded-full text-xs font-bold transition-colors"
                style={{ border: "2px solid rgb(var(--primary-200))", backgroundColor: "rgb(var(--primary-50))", color: "rgb(var(--primary-600))" }}
              >{i + 1}</button>
            ))}
            {template.ratingSettings?.minLabel && (
              <span className="text-[11px] ml-1" style={{ color: "rgb(var(--primary-400))" }}>
                {template.ratingSettings.minLabel} → {template.ratingSettings.maxLabel}
              </span>
            )}
          </div>
        );
      }
      case "yesno":
        return (
          <div className="flex items-center gap-5 mt-2">
            {["Yes", "No"].map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name={`yesno-${criterion.id}`} style={{ accentColor: "rgb(var(--primary-600))" }} />
                <span className="text-sm" style={{ color: "rgb(var(--primary-700))" }}>{opt}</span>
              </label>
            ))}
          </div>
        );
      case "text":
        return (
          <textarea rows={2} disabled placeholder="Supervisor will type their response here..."
            className="mt-2 w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{ border: "1px solid rgb(var(--primary-100))", backgroundColor: "rgb(var(--primary-50))", color: "rgb(var(--primary-400))" }}
          />
        );
      case "multiple_choice": {
        const opts = Array.isArray(criterion.options) ? criterion.options : [];
        if (opts.length === 0) return <p className="mt-2 text-xs italic" style={{ color: "rgb(var(--primary-400))" }}>No options defined.</p>;
        return (
          <div className="flex flex-col gap-1.5 mt-2">
            {opts.map((opt, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name={`mc-${criterion.id}`} style={{ accentColor: "rgb(var(--primary-600))" }} />
                <span className="text-sm" style={{ color: "rgb(var(--primary-700))" }}>{resolveOptionText(opt, "Untitled option")}</span>
              </label>
            ))}
          </div>
        );
      }
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" style={{ border: "1px solid rgb(var(--primary-100))" }}>
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid rgb(var(--primary-100))" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgb(var(--primary-50))" }}>
              <Eye size={16} style={{ color: "rgb(var(--primary-600))" }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: "rgb(var(--primary-800))" }}>Template Preview</h2>
              <p className="text-xs" style={{ color: "rgb(var(--primary-500))" }}>How supervisors will see this form</p>
            </div>
          </div>
          <button onClick={onClose} className="transition-colors" style={{ color: "rgb(var(--primary-400))" }}
            onMouseEnter={e => e.currentTarget.style.color = "rgb(var(--primary-700))"}
            onMouseLeave={e => e.currentTarget.style.color = "rgb(var(--primary-400))"}
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold" style={{ color: "rgb(var(--primary-800))" }}>{template.name || "Untitled Template"}</h3>
            {template.description && <p className="text-sm" style={{ color: "rgb(var(--primary-500))" }}>{template.description}</p>}
            <div className="flex items-center gap-3 pt-1 text-xs" style={{ color: "rgb(var(--primary-400))" }}>
              {template.courseCode && <span className="flex items-center gap-1"><BookOpen size={11} /> {template.courseCode}</span>}
              {template.academicYear && <span className="flex items-center gap-1"><Calendar size={11} /> {template.academicYear}</span>}
            </div>
          </div>

          {sections.length === 0 ? (
            <p className="text-sm italic" style={{ color: "rgb(var(--primary-400))" }}>No sections defined in this template.</p>
          ) : (
            sections.map((section, si) => {
              const criteria = Array.isArray(section.criteria) ? section.criteria : [];
              return (
                <div key={section.id || si} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1" style={{ backgroundColor: "rgb(var(--primary-100))" }} />
                    <h4 className="text-xs font-bold uppercase tracking-widest px-2" style={{ color: "rgb(var(--primary-600))" }}>
                      {section.title || `Section ${si + 1}`}
                    </h4>
                    <div className="h-px flex-1" style={{ backgroundColor: "rgb(var(--primary-100))" }} />
                  </div>
                  <div className="space-y-4">
                    {criteria.map((criterion, ci) => (
                      <div key={criterion.id || ci} className="rounded-xl p-4" style={{ backgroundColor: "rgb(var(--primary-50))", border: "1px solid rgb(var(--primary-100))" }}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold" style={{ color: "rgb(var(--primary-800))" }}>
                            {criterion.title || <span className="italic" style={{ color: "rgb(var(--primary-400))" }}>Untitled criterion</span>}
                          </p>
                          {criterion.required && (
                            <span className="shrink-0 text-[10px] font-medium bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded-full">Required</span>
                          )}
                        </div>
                        {renderInput(criterion)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-6 py-4 flex justify-end shrink-0" style={{ borderTop: "1px solid rgb(var(--primary-100))" }}>
          <OutlineBtn onClick={onClose}><X size={14} /> Close Preview</OutlineBtn>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   OPTIONS EDITOR
══════════════════════════════════════════════════════════════════════════ */
function OptionsEditor({ options = [], onChange }) {
  const addOption    = () => onChange([...options, ""]);
  const updateOption = (idx, val) => { const next = [...options]; next[idx] = val; onChange(next); };
  const deleteOption = (idx) => onChange(options.filter((_, i) => i !== idx));
  return (
    <div className="mt-2 space-y-2 pl-1">
      {options.map((opt, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className="text-xs w-16 shrink-0" style={{ color: "rgb(var(--primary-400))" }}>Option {idx + 1}</span>
          <StyledInput className="flex-1" placeholder={`Option ${idx + 1}...`} value={resolveOptionText(opt, "")} onChange={e => updateOption(idx, e.target.value)} />
          <button onClick={() => deleteOption(idx)} className="shrink-0 transition-colors" style={{ color: "rgb(var(--primary-300))" }}
            onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
            onMouseLeave={e => e.currentTarget.style.color = "rgb(var(--primary-300))"}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <GhostBtn onClick={addOption} className="text-xs">
        <Plus size={13} /> Add Option
      </GhostBtn>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CRITERION ROW
══════════════════════════════════════════════════════════════════════════ */
function CriterionRow({ criterion, onChange, onDelete }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg group" style={{ backgroundColor: "rgb(var(--primary-50))", border: "1px solid rgb(var(--primary-100))" }}>
      <GripVertical size={16} className="mt-2.5 shrink-0 cursor-grab" style={{ color: "rgb(var(--primary-300))" }} />
      <div className="flex-1 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2">
            <StyledInput placeholder="Criterion title..." value={criterion.title} onChange={e => onChange({ ...criterion, title: e.target.value })} />
          </div>
          <StyledSelect value={criterion.type} onChange={e => onChange({ ...criterion, type: e.target.value, options: e.target.value === "multiple_choice" ? (criterion.options?.length ? criterion.options : [""]) : (criterion.options || []) })}>
            {QUESTION_TYPES.map(t => <option key={`${criterion.id}-${t.value}`} value={t.value}>{t.label}</option>)}
          </StyledSelect>
        </div>
        {criterion.type === "multiple_choice" && (
          <OptionsEditor options={criterion.options || []} onChange={opts => onChange({ ...criterion, options: opts })} />
        )}
      </div>
      <button onClick={() => onChange({ ...criterion, required: !criterion.required })} className="mt-1 shrink-0 transition-colors"
        style={{ color: criterion.required ? "rgb(var(--primary-600))" : "rgb(var(--primary-200))" }}
      >
        {criterion.required ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
      </button>
      <button onClick={onDelete} className="mt-1 shrink-0 transition-colors" style={{ color: "rgb(var(--primary-300))" }}
        onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
        onMouseLeave={e => e.currentTarget.style.color = "rgb(var(--primary-300))"}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION BLOCK
══════════════════════════════════════════════════════════════════════════ */
function SectionBlock({ section, onChange, onDelete, onMoveUp, onMoveDown }) {
  const updateCriterion = (idx, updated) => { const criteria = [...section.criteria]; criteria[idx] = updated; onChange({ ...section, criteria }); };
  const deleteCriterion = (idx) => onChange({ ...section, criteria: section.criteria.filter((_, i) => i !== idx) });
  const addCriterion    = () => onChange({ ...section, criteria: [...section.criteria, newCriterion()] });

  return (
    <div className={`${card} p-5 space-y-4`} style={cardBorder}>
      <div className="flex items-center gap-3">
        <GripVertical size={18} className="shrink-0 cursor-grab" style={{ color: "rgb(var(--primary-300))" }} />
        <StyledInput
          className="font-semibold"
          placeholder="Section title..."
          value={section.title}
          onChange={e => onChange({ ...section, title: e.target.value })}
        />
        <div className="flex items-center gap-1 shrink-0">
          <GhostBtn onClick={onMoveUp}><ChevronUp size={16} /></GhostBtn>
          <GhostBtn onClick={onMoveDown}><ChevronDown size={16} /></GhostBtn>
          <button onClick={onDelete} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors" style={{ color: "rgb(var(--primary-400))" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.backgroundColor = "#fef2f2"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgb(var(--primary-400))"; e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div className="space-y-2 pl-7">
        {section.criteria.map((c, idx) => (
          <CriterionRow key={c.id} criterion={c} onChange={updated => updateCriterion(idx, updated)} onDelete={() => deleteCriterion(idx)} />
        ))}
        <GhostBtn onClick={addCriterion} className="mt-1">
          <Plus size={15} /> Add Criterion
        </GhostBtn>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   RATING SCALE CARD
══════════════════════════════════════════════════════════════════════════ */
function RatingScaleCard({ settings, onChange }) {
  return (
    <div className={`${card} p-5 space-y-4`} style={cardBorder}>
      <div className="flex items-center gap-2 mb-1">
        <BarChart2 size={16} style={{ color: "rgb(var(--primary-600))" }} />
        <h3 className="text-sm font-semibold" style={{ color: "rgb(var(--primary-800))" }}>Rating Scale Settings</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "rgb(var(--primary-500))" }}>Scale Type</label>
          <StyledSelect value={settings.scale} onChange={e => onChange({ ...settings, scale: e.target.value })}>
            {RATING_SCALES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </StyledSelect>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "rgb(var(--primary-500))" }}>Min Label</label>
          <StyledInput placeholder="e.g. Poor" value={settings.minLabel} onChange={e => onChange({ ...settings, minLabel: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "rgb(var(--primary-500))" }}>Max Label</label>
          <StyledInput placeholder="e.g. Excellent" value={settings.maxLabel} onChange={e => onChange({ ...settings, maxLabel: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TEMPLATE EDITOR
══════════════════════════════════════════════════════════════════════════ */
function TemplateEditor({ template, courses, onCancel, onSave, onPublish }) {
  const [form, setForm] = useState(
    template
      ? { ...template, courseId: template.course }
      : {
          name: "", description: "", courseId: "",
          academicYear: "2024-2025",
          sections: [newSection()],
          ratingSettings: { scale: "1-5", minLabel: "Poor", maxLabel: "Excellent" },
        }
  );

  const updateSection = (idx, updated) => { const sections = [...form.sections]; sections[idx] = updated; setForm({ ...form, sections }); };
  const deleteSection = (idx) => setForm({ ...form, sections: form.sections.filter((_, i) => i !== idx) });
  const moveSection   = (idx, dir) => {
    const sections = [...form.sections];
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    [sections[idx], sections[target]] = [sections[target], sections[idx]];
    setForm({ ...form, sections });
  };

  const handlePublishClick = () => {
    if (!template?.id) { alert("Please save the template before publishing."); return; }
    onPublish(template);
  };

  return (
    <div className="space-y-6">
      {/* Editor Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "rgb(var(--primary-800))" }}>
            {template?.id ? "Edit Template" : "New Template"}
          </h2>
          <p className="text-sm" style={{ color: "rgb(var(--primary-500))" }}>Define sections, criteria, and rating settings.</p>
        </div>
        <div className="flex items-center gap-2">
          <OutlineBtn onClick={onCancel}><X size={15} /> Cancel</OutlineBtn>
          {template?.id && template?.status === "draft" && (
            <PrimaryBtn onClick={handlePublishClick}><Send size={14} /> Publish</PrimaryBtn>
          )}
          <PrimaryBtn onClick={() => onSave(form)}>Save Template</PrimaryBtn>
        </div>
      </div>

      {/* Meta fields */}
      <div className={`${card} p-5`} style={cardBorder}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "rgb(var(--primary-500))" }}>Template Name *</label>
            <StyledInput value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "rgb(var(--primary-500))" }}>Course *</label>
            <StyledSelect value={form.courseId} onChange={e => setForm({ ...form, courseId: e.target.value })}>
              <option value="">Select course...</option>
              {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_code}</option>)}
            </StyledSelect>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "rgb(var(--primary-500))" }}>Description</label>
            <StyledTextarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "rgb(var(--primary-500))" }}>Academic Year</label>
            <StyledInput value={form.academicYear} onChange={e => setForm({ ...form, academicYear: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {form.sections.map((sec, idx) => (
          <SectionBlock key={sec.id} section={sec} onChange={u => updateSection(idx, u)} onDelete={() => deleteSection(idx)} onMoveUp={() => moveSection(idx, -1)} onMoveDown={() => moveSection(idx, 1)} />
        ))}
        <OutlineBtn onClick={() => setForm({ ...form, sections: [...form.sections, newSection()] })}>
          <Plus size={15} /> Add Section
        </OutlineBtn>
      </div>

      <RatingScaleCard settings={form.ratingSettings} onChange={rs => setForm({ ...form, ratingSettings: rs })} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TEMPLATE CARD — unified with CoordinatorNarratives card style
══════════════════════════════════════════════════════════════════════════ */
function TemplateCard({ template, onEdit, onDuplicate, onPublish, onPreview, onViewResponses, responseCount }) {
  const sectionCount  = Array.isArray(template.sections) ? template.sections.length  : (template.sections  || 0);
  const criteriaCount = Array.isArray(template.criteria) ? template.criteria.length  : (template.criteria  || 0);
  const createdDate   = template.createdAt
    ? new Date(template.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "-";

  const isPublished = template.status === "published";

  return (
    <div
      className={`${card} flex flex-col overflow-hidden group transition-all duration-200`}
      style={cardBorder}
      onMouseEnter={hoverCard.enter}
      onMouseLeave={hoverCard.leave}
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate leading-snug" style={{ color: "rgb(var(--primary-800))" }} title={template.name}>
              {template.name}
            </p>
            {template.courseCode && (
              <div className="flex items-center gap-1.5 mt-1">
                <BookOpen size={12} style={{ color: "rgb(var(--primary-500))" }} className="shrink-0" />
                <span className="text-xs truncate" style={{ color: "rgb(var(--primary-500))" }}>{template.courseCode}</span>
              </div>
            )}
          </div>
          {/* Status badge — published uses primary; draft uses amber (semantic) */}
          <span
            className={`shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              isPublished ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-amber-50 text-amber-600 border-amber-200"
            }`}
            style={isPublished ? {
              backgroundColor: "rgb(var(--primary-50))",
              color: "rgb(var(--primary-700))",
              border: "1px solid rgb(var(--primary-200))",
            } : {}}
          >
            {isPublished ? <CheckCircle2 size={11} /> : <FileText size={11} />}
            {isPublished ? "Published" : "Draft"}
          </span>
        </div>
      </div>

      {/* Stats — approved uses primary vars; pending/revision stay semantic */}
      <div className="px-5 pb-4 grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center rounded-lg py-2" style={{ backgroundColor: "rgb(var(--primary-50))", border: "1px solid rgb(var(--primary-100))" }}>
          <Layers size={13} style={{ color: "rgb(var(--primary-500))" }} className="mb-1" />
          <span className="text-lg font-bold leading-none" style={{ color: "rgb(var(--primary-800))" }}>{sectionCount}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: "rgb(var(--primary-500))" }}>Sections</span>
        </div>
        <div className="flex flex-col items-center rounded-lg py-2" style={{ backgroundColor: "rgb(var(--primary-50))", border: "1px solid rgb(var(--primary-100))" }}>
          <ListChecks size={13} style={{ color: "rgb(var(--primary-500))" }} className="mb-1" />
          <span className="text-lg font-bold leading-none" style={{ color: "rgb(var(--primary-800))" }}>{criteriaCount}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: "rgb(var(--primary-500))" }}>Criteria</span>
        </div>
        <div className="flex flex-col items-center rounded-lg py-2" style={{ backgroundColor: "rgb(var(--primary-50))", border: "1px solid rgb(var(--primary-100))" }}>
          <ClipboardList size={13} style={{ color: "rgb(var(--primary-500))" }} className="mb-1" />
          <span className="text-lg font-bold leading-none" style={{ color: "rgb(var(--primary-800))" }}>{responseCount ?? 0}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: "rgb(var(--primary-500))" }}>Responses</span>
        </div>
      </div>

      {/* Created date */}
      <div className="px-5 pb-3">
        <p className="text-xs" style={{ color: "rgb(var(--primary-500))" }}>
          <span className="font-semibold" style={{ color: "rgb(var(--primary-700))" }}>
            <Calendar size={11} className="inline mr-1" />
            {createdDate}
          </span>
        </p>
      </div>

      {/* Action row */}
      <div className="px-5 pb-3 flex items-center gap-1" style={{ borderTop: "1px solid rgb(var(--primary-50))", paddingTop: "12px" }}>
        <GhostBtn onClick={e => { e.stopPropagation(); onEdit(template.id); }} className="flex-1 justify-center">
          <Edit2 size={13} /><span className="text-xs">Edit</span>
        </GhostBtn>
        <GhostBtn onClick={e => { e.stopPropagation(); onPreview(template.id); }} className="flex-1 justify-center">
          <Eye size={13} /><span className="text-xs">Preview</span>
        </GhostBtn>
        <GhostBtn onClick={e => { e.stopPropagation(); onDuplicate(template); }} className="flex-1 justify-center">
          <Copy size={13} /><span className="text-xs">Duplicate</span>
        </GhostBtn>
        {template.status === "draft" && (
          <button
            onClick={e => { e.stopPropagation(); onPublish(template); }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-all duration-150 flex-1 justify-center"
            style={{ backgroundColor: "rgb(var(--primary-600))" }}
            onMouseEnter={hoverPrimary.enter}
            onMouseLeave={hoverPrimary.leave}
          >
            <Send size={12} /><span>Publish</span>
          </button>
        )}
      </div>

      {/* View Responses CTA */}
      <div className="mt-auto px-5 pb-5">
        <button
          onClick={e => { e.stopPropagation(); onViewResponses(template); }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-lg active:scale-[0.98] transition-all duration-150 shadow-sm group-hover:shadow-md"
          style={{ backgroundColor: "rgb(var(--primary-600))" }}
          onMouseEnter={hoverPrimary.enter}
          onMouseLeave={hoverPrimary.leave}
        >
          <ClipboardList className="w-4 h-4" />
          View Responses
          <ChevronRight className="w-4 h-4 ml-auto" />
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ANSWER BLOCKS (Responses Tab)
══════════════════════════════════════════════════════════════════════════ */
function RatingAnswer({ value }) {
  const max = 5;
  return (
    <div className="flex items-center gap-1 mt-1">
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} size={16} className={i < value ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200"} />
      ))}
      <span className="ml-1.5 text-xs font-medium" style={{ color: "rgb(var(--primary-500))" }}>{value} / {max}</span>
    </div>
  );
}

function YesNoAnswer({ value }) {
  const isYes = value === 1 || value === true || value === "1";
  return (
    <div className="mt-1">
      {isYes ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: "rgb(var(--primary-50))", color: "rgb(var(--primary-700))", border: "1px solid rgb(var(--primary-200))" }}>
          <CheckCircle2 size={12} /> Yes
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600 border border-red-200">
          <XCircle size={12} /> No
        </span>
      )}
    </div>
  );
}

function TextAnswer({ value }) {
  return (
    <div className="mt-1 px-3 py-2.5 rounded-lg text-sm leading-relaxed" style={{ backgroundColor: "rgb(var(--primary-50))", border: "1px solid rgb(var(--primary-100))", color: "rgb(var(--primary-700))" }}>
      {value || <span className="italic" style={{ color: "rgb(var(--primary-400))" }}>No response provided.</span>}
    </div>
  );
}

function MultipleChoiceAnswer({ value }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <ListChecks size={14} style={{ color: "rgb(var(--primary-600))" }} className="shrink-0" />
      <span className="text-sm" style={{ color: "rgb(var(--primary-800))" }}>
        Selected:{" "}
        <span className="font-semibold" style={{ color: "rgb(var(--primary-700))" }}>{value || "—"}</span>
      </span>
    </div>
  );
}

function AnswerBlock({ answer }) {
  const renderValue = () => {
    switch (answer.criterion_type) {
      case "rating":          return <RatingAnswer         value={answer.rating_value} />;
      case "yesno":           return <YesNoAnswer          value={answer.yesno_value} />;
      case "text":            return <TextAnswer           value={answer.text_value} />;
      case "multiple_choice": return <MultipleChoiceAnswer value={answer.selected_option} />;
      default:                return <span className="text-xs italic" style={{ color: "rgb(var(--primary-400))" }}>Unknown type</span>;
    }
  };
  return (
    <div className="py-3 px-4" style={{ borderBottom: "1px solid rgb(var(--primary-50))" }}>
      <p className="text-sm font-semibold" style={{ color: "rgb(var(--primary-800))" }}>{answer.criterion_title}</p>
      {renderValue()}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   RESPONSE DETAIL MODAL
══════════════════════════════════════════════════════════════════════════ */
function ResponseModal({ responseId, onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/evaluations/responses/${responseId}`);
        setData(res.data);
      } catch (err) {
        console.error("Error fetching response details:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [responseId]);

  const sections = data
    ? data.answers.reduce((acc, ans) => {
        const key = ans.section_title || "General";
        if (!acc[key]) acc[key] = [];
        acc[key].push(ans);
        return acc;
      }, {})
    : {};

  const submittedDate = data?.response?.submitted_at
    ? new Date(data.response.submitted_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" style={{ border: "1px solid rgb(var(--primary-100))" }}>
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid rgb(var(--primary-100))" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgb(var(--primary-50))" }}>
              <ClipboardList size={16} style={{ color: "rgb(var(--primary-600))" }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: "rgb(var(--primary-800))" }}>Evaluation Response</h2>
              <p className="text-xs" style={{ color: "rgb(var(--primary-500))" }}>Submitted supervisor feedback</p>
            </div>
          </div>
          <button onClick={onClose} className="transition-colors" style={{ color: "rgb(var(--primary-400))" }}
            onMouseEnter={e => e.currentTarget.style.color = "rgb(var(--primary-700))"}
            onMouseLeave={e => e.currentTarget.style.color = "rgb(var(--primary-400))"}
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "2px solid rgb(var(--primary-500))", borderTopColor: "transparent" }} />
            </div>
          ) : !data ? (
            <p className="text-sm text-center py-10" style={{ color: "rgb(var(--primary-500))" }}>Failed to load response details.</p>
          ) : (
            <>
              <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "rgb(var(--primary-50))", border: "1px solid rgb(var(--primary-100))" }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { Icon: User,      label: "Student",          value: data.response.student_name },
                    { Icon: Building2, label: "Supervisor",       value: data.response.supervisor_name },
                    { Icon: Mail,      label: "Supervisor Email", value: data.response.supervisor_email },
                    { Icon: Calendar,  label: "Submitted",        value: submittedDate },
                  ].map(({ Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-2.5">
                      <Icon size={14} className="mt-0.5 shrink-0" style={{ color: "rgb(var(--primary-600))" }} />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgb(var(--primary-400))" }}>{label}</p>
                        <p className="text-sm font-semibold" style={{ color: "rgb(var(--primary-800))" }}>{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-2.5 pt-3" style={{ borderTop: "1px solid rgb(var(--primary-200))" }}>
                  <BookOpen size={14} className="mt-0.5 shrink-0" style={{ color: "rgb(var(--primary-600))" }} />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgb(var(--primary-400))" }}>Template</p>
                    <p className="text-sm font-semibold" style={{ color: "rgb(var(--primary-800))" }}>{data.response.template_name}</p>
                  </div>
                </div>
              </div>

              {Object.keys(sections).length === 0 ? (
                <p className="text-sm italic text-center py-6" style={{ color: "rgb(var(--primary-400))" }}>No answers recorded.</p>
              ) : (
                Object.entries(sections).map(([sectionTitle, answers]) => (
                  <div key={sectionTitle} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgb(var(--primary-100))" }}>
                    <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: "rgb(var(--primary-50))", borderBottom: "1px solid rgb(var(--primary-100))" }}>
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: "rgb(var(--primary-500))" }} />
                      <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgb(var(--primary-700))" }}>{sectionTitle}</h4>
                    </div>
                    <div>{answers.map((ans, i) => <AnswerBlock key={i} answer={ans} />)}</div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 flex justify-end shrink-0" style={{ borderTop: "1px solid rgb(var(--primary-100))" }}>
          <OutlineBtn onClick={onClose}><X size={14} /> Close</OutlineBtn>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SUMMARY CARD — mirrors CoordinatorNarratives SummaryCard
══════════════════════════════════════════════════════════════════════════ */
function SummaryCard({ title, value, icon: Icon, accent, loading }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow duration-200" style={{ border: "1px solid rgb(var(--primary-50))" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "rgb(var(--primary-500))" }}>{title}</p>
          <p className={`text-3xl font-bold ${accent}`}>{loading ? "—" : value}</p>
        </div>
        <div className="p-3 rounded-lg" style={{ backgroundColor: "rgb(var(--primary-50))" }}>
          <Icon className="w-5 h-5" style={{ color: "rgb(var(--primary-600))" }} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TAB 1: FORMS
══════════════════════════════════════════════════════════════════════════ */
function FormsTab({ onViewResponses }) {
  const [templates,    setTemplates]    = useState([]);
  const [courses,      setCourses]      = useState([]);
  const [editorView,   setEditorView]   = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [loading,      setLoading]      = useState(false);
  const [responseCounts, setResponseCounts] = useState({});

  const [confirmTarget,    setConfirmTarget]    = useState(null);
  const [confirmOpen,      setConfirmOpen]      = useState(false);
  const [publishLoading,   setPublishLoading]   = useState(false);
  const [publishLink,      setPublishLink]      = useState(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [previewTemplate,  setPreviewTemplate]  = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tplRes, courseRes] = await Promise.all([
        api.get("/evaluation-templates/"),
        api.get("/courses"),
      ]);
      setTemplates(tplRes.data);
      setCourses(courseRes.data);
      try {
        const countsRes = await api.get("/evaluations/responses/counts");
        const countsMap = {};
        (countsRes.data || []).forEach(item => { countsMap[item.template_id] = item.count; });
        setResponseCounts(countsMap);
      } catch (_) {}
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openNew  = () => { setEditTarget(null); setEditorView(true); };
  const openEdit = async (id) => {
    try {
      const res = await api.get(`/evaluation-templates/${id}`);
      setEditTarget(res.data);
      setEditorView(true);
    } catch (err) { console.error("Error loading template:", err); }
  };

  const handleSave = async (form) => {
    try {
      const cleanedSections = (form.sections || []).map(section => ({
        title: section.title,
        criteria: (section.criteria || []).map(criterion => ({
          title:    criterion.title,
          type:     criterion.type,
          required: criterion.required,
          options:  (criterion.options || []).map(opt => resolveOptionText(opt, "")).filter(opt => opt.trim() !== ""),
        })),
      }));
      const payload = { name: form.name, description: form.description, courseId: form.courseId, academicYear: form.academicYear, ratingSettings: form.ratingSettings, sections: cleanedSections };
      if (editTarget?.id) {
        await api.put(`/evaluation-templates/${editTarget.id}`, payload);
      } else {
        await api.post("/evaluation-templates", payload);
      }
      setEditorView(false);
      fetchData();
    } catch (err) { console.error("Error saving template:", err); }
  };

  const handleDuplicate = async (t) => {
    try {
      const res  = await api.get(`/evaluation-templates/${t.id}`);
      const copy = { ...res.data, id: undefined, name: `${res.data.name} (Copy)` };
      await api.post("/evaluation-templates", copy);
      fetchData();
    } catch (err) { console.error("Error duplicating:", err); }
  };

  const handlePublish        = (template) => { setConfirmTarget(template); setConfirmOpen(true); };
  const handlePublishConfirm = async () => {
    if (!confirmTarget) return;
    try {
      setPublishLoading(true);
      const res = await api.put(`/evaluation-templates/${confirmTarget.id}/publish`);
      setPublishLink(res.data.link);
      setConfirmOpen(false);
      setConfirmTarget(null);
      setPublishModalOpen(true);
      fetchData();
    } catch (err) { console.error("Error publishing:", err); }
    finally { setPublishLoading(false); }
  };
  const handlePublishCancel     = () => { setConfirmOpen(false); setConfirmTarget(null); };
  const handlePublishModalClose = () => { setPublishModalOpen(false); setPublishLink(null); };

  const handleEditorPublish = async (template) => {
    try {
      const res = await api.put(`/evaluation-templates/${template.id}/publish`);
      setPublishLink(res.data.link);
      setPublishModalOpen(true);
      fetchData();
    } catch (err) { console.error("Error publishing:", err); }
  };

  const handlePreview = async (id) => {
    try {
      const res = await api.get(`/evaluation-templates/${id}`);
      setPreviewTemplate(res.data);
      setPreviewModalOpen(true);
    } catch (err) { console.error("Error loading preview:", err); }
  };

  const filtered = templates.filter(t => {
    const matchSearch = (t.name || "").toLowerCase().includes(search.toLowerCase()) || (t.courseCode || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || (filterStatus === "Published" ? t.status === "published" : t.status === "draft");
    return matchSearch && matchStatus;
  });

  const stats = {
    total:     templates.length,
    published: templates.filter(t => t.status === "published").length,
    draft:     templates.filter(t => t.status === "draft").length,
  };

  if (editorView) {
    return (
      <>
        <TemplateEditor template={editTarget} courses={courses} onCancel={() => setEditorView(false)} onSave={handleSave} onPublish={handleEditorPublish} />
        <PublishLinkModal open={publishModalOpen} link={publishLink} onClose={handlePublishModalClose} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards — mirrors CoordinatorNarratives layout */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow duration-200" style={{ border: "1px solid rgb(var(--primary-50))" }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "rgb(var(--primary-500))" }}>Total Templates</p>
              <p className="text-3xl font-bold" style={{ color: "rgb(var(--primary-800))" }}>{loading ? "—" : stats.total}</p>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: "rgb(var(--primary-50))" }}>
              <FileText className="w-5 h-5" style={{ color: "rgb(var(--primary-600))" }} />
            </div>
          </div>
        </div>
        <SummaryCard title="Published" value={stats.published} icon={CheckCircle2} accent="text-amber-600" loading={loading} />
        <SummaryCard title="Drafts" value={stats.draft} icon={FileText} accent="text-red-500" loading={loading} />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-sm px-6 py-4" style={{ border: "1px solid rgb(var(--primary-50))" }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <h2 className="text-lg font-bold" style={{ color: "rgb(var(--primary-800))" }}>Evaluation Templates</h2>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "rgb(var(--primary-400))" }} />
              <input
                type="text"
                placeholder="Search templates or courses…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm rounded-lg w-64 transition outline-none"
                style={{ border: "1px solid rgb(var(--primary-200))", backgroundColor: "rgba(var(--primary-50), 0.4)", color: "rgb(var(--primary-800))" }}
                onFocus={e => { e.target.style.boxShadow = "0 0 0 2px rgb(var(--primary-300))"; e.target.style.borderColor = "rgb(var(--primary-300))"; }}
                onBlur={e => { e.target.style.boxShadow = "none"; e.target.style.borderColor = "rgb(var(--primary-200))"; }}
              />
            </div>
            {/* Filter pills */}
            <div className="flex items-center gap-1">
              {["All", "Published", "Draft"].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={filterStatus === s
                    ? { backgroundColor: "rgb(var(--primary-600))", color: "white", border: "1px solid rgb(var(--primary-600))" }
                    : { backgroundColor: "white", color: "rgb(var(--primary-600))", border: "1px solid rgb(var(--primary-200))" }
                  }
                  onMouseEnter={e => { if (filterStatus !== s) e.currentTarget.style.borderColor = "rgb(var(--primary-400))"; }}
                  onMouseLeave={e => { if (filterStatus !== s) e.currentTarget.style.borderColor = "rgb(var(--primary-200))"; }}
                >{s}</button>
              ))}
            </div>
            <PrimaryBtn onClick={openNew}><Plus size={15} /> New Template</PrimaryBtn>
          </div>
        </div>
        {search.trim() && !loading && (
          <p className="text-xs mt-2" style={{ color: "rgb(var(--primary-500))" }}>
            Showing{" "}
            <span className="font-semibold" style={{ color: "rgb(var(--primary-700))" }}>{filtered.length}</span>
            {" "}of {templates.length} templates
          </p>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgb(var(--primary-50))" }}>
              <FileText className="w-8 h-8" style={{ color: "rgb(var(--primary-300))" }} />
            </div>
            <p className="text-base font-semibold" style={{ color: "rgb(var(--primary-800))" }}>
              {search ? "No matching templates" : "No templates yet"}
            </p>
            <p className="text-sm max-w-xs" style={{ color: "rgb(var(--primary-500))" }}>
              {search ? "Try adjusting your search or filter." : "Create your first evaluation template to get started."}
            </p>
          </div>
        ) : (
          filtered.map(t => (
            <TemplateCard
              key={t.id} template={t}
              onEdit={openEdit}
              onDuplicate={handleDuplicate}
              onPublish={handlePublish}
              onPreview={handlePreview}
              onViewResponses={onViewResponses}
              responseCount={responseCounts[t.id] ?? 0}
            />
          ))
        )}
      </div>

      <PublishConfirmDialog open={confirmOpen} template={confirmTarget} onCancel={handlePublishCancel} onConfirm={handlePublishConfirm} loading={publishLoading} />
      <PublishLinkModal open={publishModalOpen} link={publishLink} onClose={handlePublishModalClose} />
      <TemplatePreviewModal open={previewModalOpen} template={previewTemplate} onClose={() => { setPreviewModalOpen(false); setPreviewTemplate(null); }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TAB 2: RESPONSES
══════════════════════════════════════════════════════════════════════════ */
function ResponsesTab({ filteredTemplateId, filteredTemplateName, onClearFilter }) {
  const [responses,  setResponses]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen,  setModalOpen]  = useState(false);

  const fetchResponses = useCallback(async () => {
    try {
      setLoading(true);
      const url = filteredTemplateId ? `/evaluations/responses?templateId=${filteredTemplateId}` : "/evaluations/responses";
      const res = await api.get(url);
      setResponses(res.data);
    } catch (err) {
      console.error("Error fetching responses:", err);
    } finally {
      setLoading(false);
    }
  }, [filteredTemplateId]);

  useEffect(() => { fetchResponses(); }, [fetchResponses]);

  const filtered = responses.filter(r => {
    const q = search.toLowerCase();
    return (r.student_name || "").toLowerCase().includes(q) || (r.supervisor_name || "").toLowerCase().includes(q);
  });

  const formatDate = dateStr =>
    dateStr ? new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  return (
    <div className="space-y-5">
      {/* Filter banner */}
      {filteredTemplateId && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: "rgb(var(--primary-50))", border: "1px solid rgb(var(--primary-200))" }}>
          <Filter size={14} style={{ color: "rgb(var(--primary-600))" }} className="shrink-0" />
          <span style={{ color: "rgb(var(--primary-800))" }}>
            Showing responses for:{" "}
            <span className="font-semibold" style={{ color: "rgb(var(--primary-700))" }}>{filteredTemplateName || "Selected Template"}</span>
          </span>
          <button
            onClick={onClearFilter}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white transition-colors"
            style={{ border: "1px solid rgb(var(--primary-200))", color: "rgb(var(--primary-600))" }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgb(var(--primary-50))"}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}
          >
            <X size={12} /> Clear Filter
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-sm px-6 py-4" style={{ border: "1px solid rgb(var(--primary-50))" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold" style={{ color: "rgb(var(--primary-800))" }}>Supervisor Responses</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "rgb(var(--primary-400))" }} />
              <input
                type="text"
                placeholder="Search by student or supervisor…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm rounded-lg w-64 transition outline-none"
                style={{ border: "1px solid rgb(var(--primary-200))", backgroundColor: "rgba(var(--primary-50), 0.4)", color: "rgb(var(--primary-800))" }}
                onFocus={e => { e.target.style.boxShadow = "0 0 0 2px rgb(var(--primary-300))"; e.target.style.borderColor = "rgb(var(--primary-300))"; }}
                onBlur={e => { e.target.style.boxShadow = "none"; e.target.style.borderColor = "rgb(var(--primary-200))"; }}
              />
            </div>
            {!loading && (
              <span className="text-sm shrink-0" style={{ color: "rgb(var(--primary-500))" }}>
                <span className="font-semibold" style={{ color: "rgb(var(--primary-700))" }}>{responses.length}</span>{" "}
                response{responses.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "2px solid rgb(var(--primary-500))", borderTopColor: "transparent" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="col-span-full py-20 flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgb(var(--primary-50))" }}>
            <ClipboardList className="w-8 h-8" style={{ color: "rgb(var(--primary-300))" }} />
          </div>
          <p className="text-base font-semibold" style={{ color: "rgb(var(--primary-800))" }}>
            {search ? "No results match your search." : "No supervisor evaluations submitted yet."}
          </p>
          {search && (
            <button onClick={() => setSearch("")} className="mt-1 text-sm underline transition-colors" style={{ color: "rgb(var(--primary-600))" }}>
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid rgb(var(--primary-50))" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgb(var(--primary-100))", backgroundColor: "rgb(var(--primary-50))" }}>
                  {["Student", "Supervisor", "Template", "Submitted", ""].map(h => (
                    <th key={h} className={`text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide ${h === "Template" ? "hidden md:table-cell" : h === "Submitted" ? "hidden sm:table-cell" : ""} ${h === "" ? "text-right" : ""}`}
                      style={{ color: "rgb(var(--primary-500))" }}
                    >{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="transition-colors"
                    style={{ borderBottom: "1px solid rgb(var(--primary-50))" }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgb(var(--primary-50))"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-semibold" style={{ color: "rgb(var(--primary-800))" }}>{r.student_name}</span>
                    </td>
                    <td className="px-5 py-3.5" style={{ color: "rgb(var(--primary-600))" }}>{r.supervisor_name}</td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5" style={{ color: "rgb(var(--primary-500))" }}>
                        <BookOpen size={12} style={{ color: "rgb(var(--primary-500))" }} className="shrink-0" />
                        {r.template_name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1.5" style={{ color: "rgb(var(--primary-500))" }}>
                        <Calendar size={12} style={{ color: "rgb(var(--primary-400))" }} className="shrink-0" />
                        {formatDate(r.submitted_at)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => { setSelectedId(r.id); setModalOpen(true); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-[0.98]"
                        style={{ backgroundColor: "rgb(var(--primary-50))", color: "rgb(var(--primary-700))", border: "1px solid rgb(var(--primary-200))" }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgb(var(--primary-100))"; e.currentTarget.style.borderColor = "rgb(var(--primary-300))"; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgb(var(--primary-50))"; e.currentTarget.style.borderColor = "rgb(var(--primary-200))"; }}
                      >
                        <Eye size={13} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && selectedId && (
        <ResponseModal responseId={selectedId} onClose={() => { setModalOpen(false); setSelectedId(null); }} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function CoordinatorEvaluationPage() {
  const [activeTab,            setActiveTab]            = useState("forms");
  const [selectedTemplateId,   setSelectedTemplateId]   = useState(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState(null);

  const handleViewResponses = (template) => {
    setSelectedTemplateId(template.id);
    setSelectedTemplateName(template.name);
    setActiveTab("responses");
  };

  const handleClearFilter = () => {
    setSelectedTemplateId(null);
    setSelectedTemplateName(null);
  };

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: "linear-gradient(to bottom right, rgb(var(--primary-50)), white)" }}
    >
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Page Header — mirrors CoordinatorNarratives header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "rgb(var(--primary-800))" }}>
              Evaluations
            </h1>
            <p className="mt-1 text-sm" style={{ color: "rgb(var(--primary-500))" }}>
              Manage evaluation forms and review supervisor responses.
            </p>
          </div>
          <div
            className="hidden lg:flex items-center gap-2 text-xs font-medium bg-white rounded-lg px-3 py-2 shadow-sm"
            style={{ color: "rgb(var(--primary-400))", border: "1px solid rgb(var(--primary-100))" }}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            {activeTab === "forms" ? "Forms" : "Responses"}
          </div>
        </div>

        {/* Tab navigation — same pill style as CoordinatorNarratives */}
        <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: "rgb(var(--primary-50))" }}>
          {[
            { key: "forms",     label: "Evaluation Forms", icon: FileText },
            { key: "responses", label: "Responses",        icon: ClipboardList },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
              style={activeTab === key
                ? { backgroundColor: "white", color: "rgb(var(--primary-700))", boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)", border: "1px solid rgb(var(--primary-100))" }
                : { color: "rgb(var(--primary-500))", border: "1px solid transparent" }
              }
              onMouseEnter={e => { if (activeTab !== key) e.currentTarget.style.color = "rgb(var(--primary-700))"; }}
              onMouseLeave={e => { if (activeTab !== key) e.currentTarget.style.color = "rgb(var(--primary-500))"; }}
            >
              <Icon size={15} />
              {label}
              {key === "responses" && selectedTemplateId && (
                <span className="w-2 h-2 rounded-full absolute top-1.5 right-1.5" style={{ backgroundColor: "rgb(var(--primary-600))" }} />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "forms" ? (
          <FormsTab onViewResponses={handleViewResponses} />
        ) : (
          <ResponsesTab
            filteredTemplateId={selectedTemplateId}
            filteredTemplateName={selectedTemplateName}
            onClearFilter={handleClearFilter}
          />
        )}
      </div>
    </div>
  );
}