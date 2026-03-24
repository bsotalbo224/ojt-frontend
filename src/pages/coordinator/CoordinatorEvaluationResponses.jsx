import { useState, useEffect } from "react";
import api from "../../api/axios";
import {
  ClipboardList, Eye, Search, X, Star, CheckCircle2,
  XCircle, ListChecks, User, Mail, BookOpen, Calendar,
  Building2,
} from "lucide-react";

/* ── Shared tokens ───────────────────────────────────────────────────────── */
const inputCls   = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none transition bg-white";
const btnOutline = "inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium transition-colors bg-white";

/* ── Answer renderers ────────────────────────────────────────────────────── */
function RatingAnswer({ value }) {
  const max = 5;
  return (
    <div className="flex items-center gap-1 mt-1">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={16}
          className={i < value ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}
        />
      ))}
      <span className="ml-1.5 text-xs text-gray-500 font-medium">{value} / {max}</span>
    </div>
  );
}

function YesNoAnswer({ value }) {
  const isYes = value === 1 || value === true || value === "1";
  return (
    <div className="mt-1">
      {isYes ? (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border"
          style={{
            backgroundColor: `rgb(var(--primary-100))`,
            color:           `rgb(var(--primary-700))`,
            borderColor:     `rgb(var(--primary-200))`,
          }}
        >
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
    <div className="mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 leading-relaxed">
      {value || <span className="italic text-gray-400">No response provided.</span>}
    </div>
  );
}

function MultipleChoiceAnswer({ value }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <ListChecks size={14} className="shrink-0" style={{ color: `rgb(var(--primary-600))` }} />
      <span className="text-sm text-gray-800">
        Selected Option:{" "}
        <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>
          {value || "—"}
        </span>
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
      default:                return <span className="text-xs text-gray-400 italic">Unknown type</span>;
    }
  };
  return (
    <div className="py-3 px-4 border-b border-gray-100 last:border-b-0">
      <p className="text-sm font-semibold text-gray-800">{answer.criterion_title}</p>
      {renderValue()}
    </div>
  );
}

/* ── Response Detail Modal ───────────────────────────────────────────────── */
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
    ? new Date(data.response.submitted_at).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      })
    : "—";

  const metaIconStyle = { color: `rgb(var(--primary-600))` };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `rgb(var(--primary-100))` }}
            >
              <ClipboardList size={16} style={{ color: `rgb(var(--primary-600))` }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Evaluation Response</h2>
              <p className="text-xs text-gray-500">Submitted supervisor feedback</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div
                className="w-8 h-8 rounded-full animate-spin"
                style={{ border: `2px solid rgb(var(--primary-500))`, borderTopColor: 'transparent' }}
              />
            </div>
          ) : !data ? (
            <p className="text-sm text-gray-500 text-center py-10">Failed to load response details.</p>
          ) : (
            <>
              {/* Meta info card */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { Icon: User,      label: "Student",          value: data.response.student_name },
                    { Icon: Building2, label: "Supervisor",       value: data.response.supervisor_name },
                    { Icon: Mail,      label: "Supervisor Email", value: data.response.supervisor_email },
                    { Icon: Calendar,  label: "Submitted",        value: submittedDate },
                  ].map(({ Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-2.5">
                      <Icon size={14} className="mt-0.5 shrink-0" style={metaIconStyle} />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                        <p className="text-sm font-semibold text-gray-800">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-2.5 border-t border-gray-200 pt-3">
                  <BookOpen size={14} className="mt-0.5 shrink-0" style={metaIconStyle} />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Template</p>
                    <p className="text-sm font-semibold text-gray-800">{data.response.template_name}</p>
                  </div>
                </div>
              </div>

              {/* Answers grouped by section */}
              {Object.keys(sections).length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-6">No answers recorded.</p>
              ) : (
                Object.entries(sections).map(([sectionTitle, answers]) => (
                  <div key={sectionTitle} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: `rgb(var(--primary-500))` }}
                      />
                      <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: `rgb(var(--primary-700))` }}>
                        {sectionTitle}
                      </h4>
                    </div>
                    <div>
                      {answers.map((ans, i) => <AnswerBlock key={i} answer={ans} />)}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className={btnOutline}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `rgb(var(--primary-500))`; e.currentTarget.style.color = `rgb(var(--primary-700))`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#4b5563'; }}
          >
            <X size={14} /> Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page Component ─────────────────────────────────────────────────── */
export default function CoordinatorEvaluationResponses() {
  const [responses,  setResponses]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen,  setModalOpen]  = useState(false);

  useEffect(() => {
    const fetchResponses = async () => {
      try {
        setLoading(true);
        const res = await api.get("/evaluations/responses");
        setResponses(res.data);
      } catch (err) {
        console.error("Error fetching responses:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchResponses();
  }, []);

  const filtered = responses.filter((r) => {
    const q = search.toLowerCase();
    return (
      (r.student_name    || "").toLowerCase().includes(q) ||
      (r.supervisor_name || "").toLowerCase().includes(q)
    );
  });

  const handleView = (id) => { setSelectedId(id); setModalOpen(true); };
  const handleCloseModal = () => { setModalOpen(false); setSelectedId(null); };

  const formatDate = (dateStr) =>
    dateStr
      ? new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "—";

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm"
            style={{ backgroundColor: `rgb(var(--primary-600))` }}
          >
            <ClipboardList size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Supervisor Evaluations</h1>
            <p className="text-sm text-gray-500 mt-0.5">Review supervisor feedback for student OJT performance.</p>
          </div>
        </div>
        {!loading && (
          <span className="text-sm text-gray-500">
            <span className="font-semibold" style={{ color: `rgb(var(--primary-700))` }}>
              {responses.length}
            </span>{" "}
            response{responses.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className={`${inputCls} pl-9`}
          placeholder="Search by student or supervisor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-400))`; e.target.style.borderColor = 'transparent'; }}
          onBlur={e =>  { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#e5e7eb'; }}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="w-8 h-8 rounded-full animate-spin"
            style={{ border: `2px solid rgb(var(--primary-500))`, borderTopColor: 'transparent' }}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <ClipboardList size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">
            {search ? "No results match your search." : "No supervisor evaluations submitted yet."}
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="mt-2 text-sm hover:underline transition-colors"
              style={{ color: `rgb(var(--primary-600))` }}
              onMouseEnter={e => e.currentTarget.style.color = `rgb(var(--primary-800))`}
              onMouseLeave={e => e.currentTarget.style.color = `rgb(var(--primary-600))`}
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Supervisor</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Template</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Submitted Date</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5"><span className="font-medium text-gray-900">{r.student_name}</span></td>
                    <td className="px-5 py-3.5 text-gray-600">{r.supervisor_name}</td>
                    <td className="px-5 py-3.5 text-gray-500 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen size={12} className="shrink-0" style={{ color: `rgb(var(--primary-500))` }} />
                        {r.template_name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar size={12} className="text-gray-400 shrink-0" />
                        {formatDate(r.submitted_at)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleView(r.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                        style={{ backgroundColor: `rgb(var(--primary-50))`, color: `rgb(var(--primary-700))`, borderColor: `rgb(var(--primary-200))` }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-100))`}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50))`}
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
        <ResponseModal responseId={selectedId} onClose={handleCloseModal} />
      )}
    </div>
  );
}