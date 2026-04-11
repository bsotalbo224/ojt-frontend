import { useState, useEffect } from "react";
import api from "../../api/axios";
import {
  Plus, Copy, Edit2, Trash2, ChevronDown, ChevronUp,
  GripVertical, ToggleLeft, ToggleRight, CheckSquare,
  AlignLeft, Star, X, BarChart2, Search, Calendar,
  Layers, ListChecks, BookOpen, Send, Link2, Check, Eye,
} from "lucide-react";

/* ── Constants ───────────────────────────────────────────────────────────── */
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

/* ── Shared class tokens ─────────────────────────────────────────────────── */
const card       = "bg-white border border-gray-200 rounded-xl shadow-sm";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors";
const btnOutline = "inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:border-green-500 hover:text-green-700 text-gray-600 text-sm font-medium transition-colors bg-white";
const btnGhost   = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-500 hover:text-green-700 hover:bg-green-50 text-sm transition-colors";
const inputCls   = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition";
const selectCls  = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition bg-white";

/* ══════════════════════════════════════════════════════════════════════════
   PUBLISH CONFIRM DIALOG
══════════════════════════════════════════════════════════════════════════ */
function PublishConfirmDialog({ open, template, onCancel, onConfirm, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex flex-col items-center text-center gap-3 pb-1">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <Send size={20} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Publish Template</h2>
            <p className="text-sm text-gray-500 mt-1">
              Do you want to publish{" "}
              <span className="font-semibold text-gray-700">"{template?.name}"</span>?
              <br />A shareable link will be generated for supervisors.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button onClick={onCancel} disabled={loading} className={`${btnOutline} flex-1 justify-center`}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} className={`${btnPrimary} flex-1 justify-center`}>
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Publishing...
              </>
            ) : (
              <><Send size={14} /> Publish</>
            )}
          </button>
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
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <Link2 size={18} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Evaluation Link</h2>
              <p className="text-xs text-gray-500 mt-0.5">Share this link with your supervisors.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-500">Supervisor Evaluation Link</label>
          <input
            readOnly
            value={link ?? ""}
            className={`${inputCls} bg-gray-50 text-gray-600 cursor-text`}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="h-5 flex items-center">
            {copied && (
              <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                <Check size={13} /> Link copied!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className={btnOutline}>Close</button>
            <button onClick={handleCopy} className={btnPrimary}>
              <Copy size={14} /> {copied ? "Copied!" : "Copy Link"}
            </button>
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
              <button
                key={i}
                type="button"
                className="w-8 h-8 rounded-full border-2 border-yellow-300 bg-yellow-50 hover:bg-yellow-200 text-yellow-600 text-xs font-bold transition-colors"
              >
                {i + 1}
              </button>
            ))}
            {template.ratingSettings?.minLabel && (
              <span className="text-[11px] text-gray-400 ml-1">
                {template.ratingSettings.minLabel} → {template.ratingSettings.maxLabel}
              </span>
            )}
          </div>
        );
      }
      case "yesno":
        return (
          <div className="flex items-center gap-5 mt-2">
            {["Yes", "No"].map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name={`yesno-${criterion.id}`} className="accent-green-600" />
                <span className="text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        );
      case "text":
        return (
          <textarea
            rows={2}
            disabled
            placeholder="Supervisor will type their response here..."
            className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-400 bg-gray-50 resize-none"
          />
        );
      case "multiple_choice": {
        const opts = Array.isArray(criterion.options) ? criterion.options : [];
        if (opts.length === 0) {
          return <p className="mt-2 text-xs text-gray-400 italic">No options defined.</p>;
        }
        return (
          <div className="flex flex-col gap-1.5 mt-2">
            {opts.map((opt, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name={`mc-${criterion.id}`} className="accent-green-600" />
                <span className="text-sm text-gray-700">
                  {opt || <span className="italic text-gray-400">Untitled option</span>}
                </span>
              </label>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
              <Eye size={16} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Template Preview</h2>
              <p className="text-xs text-gray-500">How supervisors will see this form</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Template info */}
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-gray-900">{template.name || "Untitled Template"}</h3>
            {template.description && (
              <p className="text-sm text-gray-500">{template.description}</p>
            )}
            <div className="flex items-center gap-3 pt-1 text-xs text-gray-400">
              {template.courseCode && (
                <span className="flex items-center gap-1">
                  <BookOpen size={11} /> {template.courseCode}
                </span>
              )}
              {template.academicYear && (
                <span className="flex items-center gap-1">
                  <Calendar size={11} /> {template.academicYear}
                </span>
              )}
            </div>
          </div>

          {/* Sections */}
          {sections.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No sections defined in this template.</p>
          ) : (
            sections.map((section, si) => {
              const criteria = Array.isArray(section.criteria) ? section.criteria : [];
              return (
                <div key={section.id || si} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-gray-100" />
                    <h4 className="text-xs font-bold uppercase tracking-widest text-green-600 px-2">
                      {section.title || `Section ${si + 1}`}
                    </h4>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>
                  <div className="space-y-4">
                    {criteria.map((criterion, ci) => (
                      <div key={criterion.id || ci} className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-800">
                            {criterion.title || <span className="italic text-gray-400">Untitled criterion</span>}
                          </p>
                          {criterion.required && (
                            <span className="shrink-0 text-[10px] font-medium bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded-full">
                              Required
                            </span>
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end shrink-0">
          <button onClick={onClose} className={btnOutline}>
            <X size={14} /> Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MULTIPLE CHOICE OPTIONS EDITOR
══════════════════════════════════════════════════════════════════════════ */
function OptionsEditor({ options = [], onChange }) {
  const addOption    = () => onChange([...options, ""]);
  const updateOption = (idx, val) => {
    const next = [...options];
    next[idx] = val;
    onChange(next);
  };
  const deleteOption = (idx) => onChange(options.filter((_, i) => i !== idx));

  return (
    <div className="mt-2 space-y-2 pl-1">
      {options.map((opt, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-16 shrink-0">Option {idx + 1}</span>
          <input
            className={`${inputCls} flex-1`}
            placeholder={`Option ${idx + 1}...`}
            value={opt}
            onChange={(e) => updateOption(idx, e.target.value)}
          />
          <button
            onClick={() => deleteOption(idx)}
            className="shrink-0 text-gray-300 hover:text-red-500 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button
        onClick={addOption}
        className={`${btnGhost} text-green-600 hover:text-green-700 text-xs`}
      >
        <Plus size={13} /> Add Option
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CRITERION ROW
══════════════════════════════════════════════════════════════════════════ */
function CriterionRow({ criterion, onChange, onDelete }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 group">
      <GripVertical size={16} className="mt-2.5 text-gray-300 shrink-0 cursor-grab" />
      <div className="flex-1 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2">
            <input
              className={inputCls}
              placeholder="Criterion title..."
              value={criterion.title}
              onChange={(e) => onChange({ ...criterion, title: e.target.value })}
            />
          </div>
          <select
            className={selectCls}
            value={criterion.type}
            onChange={(e) =>
              onChange({
                ...criterion,
                type: e.target.value,
                options:
                  e.target.value === "multiple_choice"
                    ? (criterion.options?.length ? criterion.options : [""])
                    : (criterion.options || []),
              })
            }
          >
            {QUESTION_TYPES.map((t) => (
              <option key={`${criterion.id}-${t.value}`} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {criterion.type === "multiple_choice" && (
          <OptionsEditor
            options={criterion.options || []}
            onChange={(opts) => onChange({ ...criterion, options: opts })}
          />
        )}
      </div>
      <button
        onClick={() => onChange({ ...criterion, required: !criterion.required })}
        className={`mt-1 shrink-0 transition-colors ${criterion.required ? "text-green-600" : "text-gray-300"}`}
      >
        {criterion.required ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
      </button>
      <button onClick={onDelete} className="mt-1 shrink-0 text-gray-300 hover:text-red-500 transition-colors">
        <Trash2 size={16} />
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SECTION BLOCK
══════════════════════════════════════════════════════════════════════════ */
function SectionBlock({ section, onChange, onDelete, onMoveUp, onMoveDown }) {
  const updateCriterion = (idx, updated) => {
    const criteria = [...section.criteria];
    criteria[idx] = updated;
    onChange({ ...section, criteria });
  };
  const deleteCriterion = (idx) =>
    onChange({ ...section, criteria: section.criteria.filter((_, i) => i !== idx) });
  const addCriterion = () =>
    onChange({ ...section, criteria: [...section.criteria, newCriterion()] });

  return (
    <div className={`${card} p-5 space-y-4`}>
      <div className="flex items-center gap-3">
        <GripVertical size={18} className="text-gray-300 cursor-grab shrink-0" />
        <input
          className={`${inputCls} font-semibold`}
          placeholder="Section title..."
          value={section.title}
          onChange={(e) => onChange({ ...section, title: e.target.value })}
        />
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onMoveUp}   className={btnGhost}><ChevronUp   size={16} /></button>
          <button onClick={onMoveDown} className={btnGhost}><ChevronDown size={16} /></button>
          <button onClick={onDelete} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div className="space-y-2 pl-7">
        {section.criteria.map((c, idx) => (
          <CriterionRow
            key={c.id}
            criterion={c}
            onChange={(updated) => updateCriterion(idx, updated)}
            onDelete={() => deleteCriterion(idx)}
          />
        ))}
        <button onClick={addCriterion} className={`${btnGhost} text-green-600 hover:text-green-700 mt-1`}>
          <Plus size={15} /> Add Criterion
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   RATING SCALE CARD
══════════════════════════════════════════════════════════════════════════ */
function RatingScaleCard({ settings, onChange }) {
  return (
    <div className={`${card} p-5 space-y-4`}>
      <div className="flex items-center gap-2 mb-1">
        <BarChart2 size={16} className="text-green-600" />
        <h3 className="text-sm font-semibold text-gray-800">Rating Scale Settings</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Scale Type</label>
          <select className={selectCls} value={settings.scale} onChange={(e) => onChange({ ...settings, scale: e.target.value })}>
            {RATING_SCALES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Min Label</label>
          <input className={inputCls} placeholder="e.g. Poor" value={settings.minLabel} onChange={(e) => onChange({ ...settings, minLabel: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Max Label</label>
          <input className={inputCls} placeholder="e.g. Excellent" value={settings.maxLabel} onChange={(e) => onChange({ ...settings, maxLabel: e.target.value })} />
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
          academicYear: "2024-2025", isActive: true,
          sections: [newSection()],
          ratingSettings: { scale: "1-5", minLabel: "Poor", maxLabel: "Excellent" },
        }
  );

  const updateSection = (idx, updated) => {
    const sections = [...form.sections];
    sections[idx] = updated;
    setForm({ ...form, sections });
  };
  const deleteSection = (idx) =>
    setForm({ ...form, sections: form.sections.filter((_, i) => i !== idx) });
  const moveSection = (idx, dir) => {
    const sections = [...form.sections];
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    [sections[idx], sections[target]] = [sections[target], sections[idx]];
    setForm({ ...form, sections });
  };

  const handlePublishClick = () => {
    if (!template?.id) {
      alert("Please save the template before publishing.");
      return;
    }
    onPublish(template);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {template?.id ? "Edit Template" : "New Template"}
          </h2>
          <p className="text-sm text-gray-500">Define sections, criteria, and rating settings.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className={btnOutline}><X size={15} /> Cancel</button>
          {template?.id && template?.status === "draft" && (
            <button onClick={handlePublishClick} className={btnPrimary}>
              <Send size={14} /> Publish
            </button>
          )}
          <button onClick={() => onSave(form)} className={btnPrimary}>Save Template</button>
        </div>
      </div>

      {/* Meta fields */}
      <div className={`${card} p-5`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Template Name *</label>
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Course *</label>
            <select className={selectCls} value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
              <option value="">Select course...</option>
              {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.course_code}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
            <textarea rows={2} className={`${inputCls} resize-none`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Academic Year</label>
            <input className={inputCls} value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <button
              onClick={() => setForm({ ...form, isActive: !form.isActive })}
              className={form.isActive ? "text-green-600" : "text-gray-300"}
            >
              {form.isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
            <span className="text-sm text-gray-600">{form.isActive ? "Active" : "Inactive"}</span>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {form.sections.map((sec, idx) => (
          <SectionBlock
            key={sec.id} section={sec}
            onChange={(u) => updateSection(idx, u)}
            onDelete={() => deleteSection(idx)}
            onMoveUp={() => moveSection(idx, -1)}
            onMoveDown={() => moveSection(idx, 1)}
          />
        ))}
        <button
          onClick={() => setForm({ ...form, sections: [...form.sections, newSection()] })}
          className={btnOutline}
        >
          <Plus size={15} /> Add Section
        </button>
      </div>

      <RatingScaleCard
        settings={form.ratingSettings}
        onChange={(rs) => setForm({ ...form, ratingSettings: rs })}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TEMPLATE CARD
══════════════════════════════════════════════════════════════════════════ */
function TemplateCard({ template, onEdit, onDuplicate, onArchive, onPublish, onPreview, onToggleActive }) {
  const sectionCount  = Array.isArray(template.sections) ? template.sections.length  : (template.sections  || 0);
  const criteriaCount = Array.isArray(template.criteria) ? template.criteria.length  : (template.criteria  || 0);
  const createdDate   = template.createdAt
    ? new Date(template.createdAt).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : "-";

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col gap-4 hover:shadow-md hover:border-green-300 transition-all duration-200 group">

      {/* Card header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-base leading-snug wrap-break-words line-clamp-2" title={template.name}>
            {template.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <BookOpen size={13} className="text-green-600 shrink-0" />
            <span className="text-xs text-gray-500 font-medium truncate max-w-35">{template.courseCode || "-"}</span>
          </div>
        </div>

        {/* Clickable active/inactive toggle — always visible */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleActive(template.id); }}
          title={template.isActive ? "Click to deactivate" : "Click to activate"}
          className={`shrink-0 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
            template.isActive
              ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
              : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
          }`}
        >
          {template.isActive ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
          {template.isActive ? "Active" : "Inactive"}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 min-h-18">
        <div className="flex flex-col items-center justify-center bg-gray-50 rounded-lg py-2.5 px-2 border border-gray-100">
          <Layers     size={14} className="text-green-500 mb-1" />
          <span className="text-lg font-bold text-gray-800 leading-none">{sectionCount}</span>
          <span className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">Sections</span>
        </div>
        <div className="flex flex-col items-center justify-center bg-gray-50 rounded-lg py-2.5 px-2 border border-gray-100">
          <ListChecks size={14} className="text-green-500 mb-1" />
          <span className="text-lg font-bold text-gray-800 leading-none">{criteriaCount}</span>
          <span className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">Criteria</span>
        </div>
        <div className="flex flex-col items-center justify-center bg-gray-50 rounded-lg py-2.5 px-2 border border-gray-100">
          <Calendar   size={14} className="text-green-500 mb-1" />
          <span className="text-xs font-semibold text-gray-700 leading-none text-center wrap-break-words">{createdDate}</span>
          <span className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">Created</span>
        </div>
      </div>

      {/* Action buttons — always visible */}
      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(template.id); }}
          className={`${btnGhost} flex-1 justify-center`}
          title="Edit"
        >
          <Edit2 size={14} /><span className="text-xs whitespace-nowrap">Edit</span>
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onPreview(template.id); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors flex-1 justify-center text-sm"
          title="Preview"
        >
          <Eye size={14} /><span className="text-xs whitespace-nowrap">Preview</span>
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(template); }}
          className={`${btnGhost} flex-1 justify-center`}
          title="Duplicate"
        >
          <Copy size={14} /><span className="text-xs whitespace-nowrap">Duplicate</span>
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onArchive(template.id); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-1 justify-center"
          title="Delete"
        >
          <Trash2 size={14} /><span className="text-xs whitespace-nowrap">Delete</span>
        </button>

        {/* Publish button — only for draft templates */}
        {template.status === "draft" && (
          <button
            onClick={(e) => { e.stopPropagation(); onPublish(template); }}
            className={`${btnPrimary} flex-1 justify-center`}
            title="Publish"
          >
            <Send size={14} /><span className="text-xs whitespace-nowrap">Publish</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Templates Grid ──────────────────────────────────────────────────────── */
function TemplatesGrid({ templates, onEdit, onDuplicate, onArchive, onPublish, onPreview, onToggleActive }) {
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Layers size={24} className="text-gray-400" />
        </div>
        <p className="text-gray-500 font-medium">No templates found</p>
        <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((t) => (
        <TemplateCard
          key={t.id} template={t}
          onEdit={onEdit} onDuplicate={onDuplicate}
          onArchive={onArchive} onPublish={onPublish}
          onPreview={onPreview} onToggleActive={onToggleActive}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function AdminEvaluationTemplates() {
  const [templates,    setTemplates]    = useState([]);
  const [courses,      setCourses]      = useState([]);
  const [view,         setView]         = useState("list");
  const [editTarget,   setEditTarget]   = useState(null);
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [loading,      setLoading]      = useState(false);

  // Publish state
  const [confirmTarget,    setConfirmTarget]    = useState(null);
  const [confirmOpen,      setConfirmOpen]      = useState(false);
  const [publishLoading,   setPublishLoading]   = useState(false);
  const [publishLink,      setPublishLink]      = useState(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  // Preview state
  const [previewTemplate,  setPreviewTemplate]  = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  /* ── Data fetching ───────────────────────────────────────────────────── */
  const fetchData = async () => {
    try {
      setLoading(true);
      const [tplRes, courseRes] = await Promise.all([
        api.get("/evaluation-templates/admin"),
        api.get("/courses"),
      ]);
      setTemplates(tplRes.data);
      setCourses(courseRes.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  /* ── CRUD handlers ───────────────────────────────────────────────────── */
  const openNew = () => { setEditTarget(null); setView("editor"); };

  const openEdit = async (id) => {
    try {
      const res = await api.get(`/evaluation-templates/${id}`);
      setEditTarget(res.data);
      setView("editor");
    } catch (err) { console.error("Error loading template details:", err); }
  };

  const handleArchive = async (id) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      await api.delete(`/evaluation-templates/${id}`);
      fetchData();
    } catch (err) { console.error("Error deleting template:", err); }
  };

  const handleSave = async (form) => {
    try {
      const cleanedSections = (form.sections || []).map((section) => ({
        title: section.title,
        criteria: (section.criteria || []).map((criterion) => ({
          title:    criterion.title,
          type:     criterion.type,
          required: criterion.required,
          options: (criterion.options || [])
            .map((opt) =>
              typeof opt === "string" ? opt : (opt?.option_text ?? "")
            )
            .filter((opt) => opt.trim() !== ""),
        })),
      }));

      const payload = {
        name:           form.name,
        description:    form.description,
        courseId:       form.courseId,
        academicYear:   form.academicYear,
        active:         form.isActive,
        ratingSettings: form.ratingSettings,
        sections:       cleanedSections,
      };

      if (editTarget?.id) {
        await api.put(`/evaluation-templates/${editTarget.id}`, payload);
      } else {
        await api.post("/evaluation-templates", payload);
      }

      setView("list");
      fetchData();
    } catch (err) {
      console.error("Error saving template:", err);
    }
  };

  const handleDuplicate = async (t) => {
    try {
      const res  = await api.get(`/evaluation-templates/${t.id}`);
      const copy = { ...res.data, id: undefined, name: `${res.data.name} (Copy)`, isActive: false };
      await api.post("/evaluation-templates", copy);
      fetchData();
    } catch (err) { console.error("Error duplicating:", err); }
  };

  /* ── Toggle active handler ───────────────────────────────────────────── */
  const handleToggleActive = async (id) => {
    try {
      await api.put(`/evaluation-templates/${id}/toggle-active`);
      fetchData();
    } catch (err) {
      console.error("Error toggling active state:", err);
    }
  };

  /* ── Publish handlers ────────────────────────────────────────────────── */
  const handlePublish = (template) => {
    setConfirmTarget(template);
    setConfirmOpen(true);
  };

  const handlePublishConfirm = async () => {
    if (!confirmTarget) return;
    try {
      setPublishLoading(true);
      const res = await api.put(`/evaluation-templates/${confirmTarget.id}/publish`);
      setPublishLink(res.data.link);
      setConfirmOpen(false);
      setConfirmTarget(null);
      setPublishModalOpen(true);
    } catch (err) {
      console.error("Error publishing template:", err);
    } finally {
      setPublishLoading(false);
    }
  };

  const handlePublishCancel     = () => { setConfirmOpen(false); setConfirmTarget(null); };
  const handlePublishModalClose = () => { setPublishModalOpen(false); setPublishLink(null); };

  const handleEditorPublish = async (template) => {
    try {
      const res = await api.put(`/evaluation-templates/${template.id}/publish`);
      setPublishLink(res.data.link);
      setPublishModalOpen(true);
    } catch (err) { console.error("Error publishing template:", err); }
  };

  /* ── Preview handlers ────────────────────────────────────────────────── */
  const handlePreview = async (id) => {
    try {
      const res = await api.get(`/evaluation-templates/${id}`);
      setPreviewTemplate(res.data);
      setPreviewModalOpen(true);
    } catch (err) { console.error("Error loading template for preview:", err); }
  };

  const handlePreviewClose = () => { setPreviewModalOpen(false); setPreviewTemplate(null); };

  /* ── Filters ─────────────────────────────────────────────────────────── */
  const filtered = templates.filter((t) => {
    const matchSearch =
      (t.name       || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.courseCode || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === "All" ||
      (filterStatus === "Active" ? t.isActive === true : t.isActive === false);
    return matchSearch && matchStatus;
  });

  const activeCount   = templates.filter((t) =>  t.isActive).length;
  const inactiveCount = templates.filter((t) => !t.isActive).length;

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Evaluation Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage supervisor evaluation forms.</p>
        </div>
        {view === "list" && (
          <button className={btnPrimary} onClick={openNew}>
            <Plus size={15} /> New Template
          </button>
        )}
      </div>

      {view === "editor" ? (
        <TemplateEditor
          template={editTarget}
          courses={courses}
          onCancel={() => setView("list")}
          onSave={handleSave}
          onPublish={handleEditorPublish}
        />
      ) : (
        <>
          {/* Summary strip */}
          {!loading && templates.length > 0 && (
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{templates.length} total</span>
              <span className="w-px h-4 bg-gray-200" />
              <span className="text-green-600 font-medium">{activeCount} active</span>
              <span className="w-px h-4 bg-gray-200" />
              <span>{inactiveCount} inactive</span>
            </div>
          )}

          {/* Search & filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className={`${inputCls} pl-9`}
                placeholder="Search templates or course codes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              {["All", "Active", "Inactive"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    filterStatus === s
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-green-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Grid or spinner */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <TemplatesGrid
              templates={filtered}
              onEdit={openEdit}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              onPublish={handlePublish}
              onPreview={handlePreview}
              onToggleActive={handleToggleActive}
            />
          )}
        </>
      )}

      {/* Publish confirm dialog */}
      <PublishConfirmDialog
        open={confirmOpen}
        template={confirmTarget}
        onCancel={handlePublishCancel}
        onConfirm={handlePublishConfirm}
        loading={publishLoading}
      />

      {/* Publish link modal */}
      <PublishLinkModal
        open={publishModalOpen}
        link={publishLink}
        onClose={handlePublishModalClose}
      />

      {/* Template preview modal */}
      <TemplatePreviewModal
        open={previewModalOpen}
        template={previewTemplate}
        onClose={handlePreviewClose}
      />
    </div>
  );
}