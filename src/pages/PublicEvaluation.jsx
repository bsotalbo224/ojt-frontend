import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";
import {
  Building2, Calendar, CheckCircle2, AlertCircle,
  Send, ClipboardList, BookOpen, UserCheck, RefreshCw, X
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const maxMap = { "1-5": 5, "1-4": 4, "yesno": 2 };

const getSafeMax = (ratingScale) =>
  ratingScale?.max || maxMap[ratingScale?.type] || 5;

// ─── Shared Field ─────────────────────────────────────────────────────────────
const FieldInput = ({ label, value, onChange, placeholder = "", required = false, disabled = false }) => (
  <div>
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type="text"
      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400 bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  </div>
);

// ─── Rating Input ─────────────────────────────────────────────────────────────
const RatingInput = ({ criterionId, ratingScale, value, onChange, disabled }) => {
  const safeMax = getSafeMax(ratingScale);
  const minLabel = ratingScale?.minLabel || "Poor";
  const maxLabel = ratingScale?.maxLabel || "Excellent";

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: safeMax }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(criterionId, "rating", n)}
            className={`w-11 h-11 rounded-lg border-2 text-sm font-bold transition-all
              focus:outline-none focus:ring-2 focus:ring-green-400 shadow-sm
              disabled:cursor-not-allowed disabled:opacity-60
              ${value === n
                ? "bg-green-600 border-green-600 text-white shadow-md scale-105"
                : "border-green-200 bg-white text-gray-700 hover:bg-green-600 hover:text-white hover:border-green-600"
              }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1.5 px-0.5">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
};

// ─── YesNo Input ──────────────────────────────────────────────────────────────
const YesNoInput = ({ criterionId, value, onChange, disabled }) => (
  <div className="flex gap-4 mt-3">
    {["Yes", "No"].map(opt => (
      <label
        key={opt}
        className={`flex items-center gap-2.5 cursor-pointer px-4 py-2.5 rounded-lg border-2 transition-all
          ${disabled ? "cursor-not-allowed opacity-60" : ""}
          ${value === opt
            ? "border-green-500 bg-green-50"
            : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50"
          }`}
      >
        <input
          type="radio"
          name={`yn-${criterionId}`}
          className="w-4 h-4 accent-green-600"
          checked={value === opt}
          onChange={() => onChange(criterionId, "yesno", opt)}
          disabled={disabled}
        />
        <span className={`text-sm font-semibold transition-colors
          ${value === opt ? "text-green-700" : "text-gray-600"}`}>
          {opt}
        </span>
      </label>
    ))}
  </div>
);

// ─── Text Input ───────────────────────────────────────────────────────────────
const TextInput = ({ criterionId, value, onChange, disabled }) => (
  <textarea
    className="w-full mt-3 text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50
               focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400
               resize-none disabled:opacity-60 disabled:cursor-not-allowed"
    rows={3}
    placeholder="Enter your response..."
    value={value || ""}
    onChange={e => onChange(criterionId, "text", e.target.value)}
    disabled={disabled}
  />
);

// ─── Multiple Choice Input ────────────────────────────────────────────────────
const MultipleChoiceInput = ({ criterionId, options = [], value, onChange, disabled }) => (
  <div className="flex flex-col gap-2 mt-3">
    {options.map(option => (
      <label
        key={option.id}
        className={`flex items-center gap-3 cursor-pointer px-4 py-2.5 rounded-lg border-2 transition-all
          ${disabled ? "cursor-not-allowed opacity-60" : ""}
          ${value === option.id
            ? "border-green-500 bg-green-50"
            : "border-gray-200 bg-white hover:border-green-400 hover:bg-green-50"
          }`}
      >
        <input
          type="radio"
          name={`mc-${criterionId}`}
          className="w-4 h-4 accent-green-600 shrink-0"
          checked={value === option.id}
          onChange={() => onChange(criterionId, "multiple_choice", option.id)}
          disabled={disabled}
        />
        <span className={`text-sm font-medium transition-colors
          ${value === option.id ? "text-green-700 font-semibold" : "text-gray-600"}`}>
          {option.option_text}
        </span>
      </label>
    ))}
  </div>
);

// ─── Loading Screen ───────────────────────────────────────────────────────────
const LoadingScreen = () => (
  <div className="min-h-screen bg-linear-to-b from-green-50 via-white to-green-50 flex items-center justify-center">
    <div className="text-center">
      <div className="w-14 h-14 bg-linear-to-br from-green-600 to-green-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse">
        <ClipboardList className="w-7 h-7 text-white" />
      </div>
      <p className="text-green-700 font-bold text-lg">Loading Evaluation Form...</p>
      <p className="text-gray-400 text-sm mt-1">Please wait a moment.</p>
    </div>
  </div>
);

// ─── Error Screen ─────────────────────────────────────────────────────────────
const ErrorScreen = ({ message }) => (
  <div className="min-h-screen bg-linear-to-b from-red-50 via-white to-red-50 flex items-center justify-center p-6">
    <div className="bg-white rounded-2xl border border-red-200 shadow-xl p-10 max-w-md w-full text-center">
      <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-7 h-7 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Link Unavailable</h2>
      <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
    </div>
  </div>
);

// ─── Success Screen ───────────────────────────────────────────────────────────
const SuccessScreen = ({ formTitle, onEvaluateAnother }) => (
  <div className="min-h-screen bg-linear-to-b from-green-50 via-white to-green-50 flex items-center justify-center p-6">
    <div className="bg-white rounded-2xl border border-green-200 shadow-xl p-10 max-w-md w-full text-center">
      <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Evaluation Submitted!</h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-1">
        Thank you for completing the evaluation.
      </p>
      {formTitle && (
        <p className="text-sm font-semibold text-green-700">{formTitle}</p>
      )}
      <div className="mt-6 bg-green-50 border border-green-200 rounded-xl px-5 py-3 mb-6">
        <p className="text-xs text-gray-500">
          Your responses have been recorded. You may evaluate another student or close this page.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onEvaluateAnother}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700
                     text-white text-sm font-bold rounded-xl border border-green-600 shadow-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Evaluate Another Student
        </button>
        <button
          onClick={() => window.close()}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50
                     text-gray-600 text-sm font-semibold rounded-xl border border-gray-200 shadow-sm transition-colors"
        >
          <X className="w-4 h-4" />
          Close Page
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────
const PublicEvaluation = () => {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Supervisor / Evaluator Info ──
  const [studentName, setStudentName] = useState("");
  const [supervisor, setSupervisor] = useState({ name: "", position: "", company: "" });

  // ── Answers: { [criterionId]: { type, value } } ──
  const [answers, setAnswers] = useState({});

  // ── Load form on mount ──
  useEffect(() => {
    const loadForm = async () => {
      try {
        const res = await api.get(`/public-evaluation/template/${token}`);
        setForm(res.data);
      } catch {
        setError("This evaluation link is invalid or expired. Please contact your coordinator.");
      } finally {
        setLoading(false);
      }
    };
    loadForm();
  }, [token]);

  // ── Prefill supervisor info from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem("supervisorInfo");
      if (saved) {
        const parsed = JSON.parse(saved);
        setSupervisor(prev => ({
          name: parsed.name || prev.name,
          position: parsed.position || prev.position,
          company: parsed.company || prev.company,
        }));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // ── Persist supervisor info on change ──
  useEffect(() => {
    if (supervisor.name || supervisor.position || supervisor.company) {
      try {
        localStorage.setItem("supervisorInfo", JSON.stringify(supervisor));
      } catch {
        // Ignore storage errors
      }
    }
  }, [supervisor]);

  const handleAnswer = (criterionId, type, value) => {
    setAnswers(prev => ({ ...prev, [criterionId]: { type, value } }));
  };

  // ── Reset for next student (keep supervisor info) ──
  const handleEvaluateAnother = () => {
    setSubmitted(false);
    setStudentName("");
    setAnswers({});
    setSubmitError("");
  };

  const handleSubmit = async () => {
    setSubmitError("");

    if (!studentName.trim()) {
      setSubmitError("Please enter the student name.");
      return;
    }
    if (!supervisor.name.trim()) {
      setSubmitError("Please enter the supervisor name.");
      return;
    }

    const allCriteria = form.sections?.flatMap(s => s.criteria) || [];
    const missing = allCriteria.filter(c => c.required && !answers[c.id]?.value);
    if (missing.length > 0) {
      setSubmitError(`Please answer all required fields (${missing.length} remaining).`);
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        templateId: token,
        studentName,
        supervisorName: supervisor.name,
        supervisorEmail: null,
        answers: Object.entries(answers).map(([criterionId, { type, value }]) => ({
          criterionId,
          type,
          value
        }))
      };
      await api.post(`/public-evaluation/submit`, payload);
      setSubmitted(true);
    } catch {
      setSubmitError("Submission failed. Please try again or contact your coordinator.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Guards ──
  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;
  if (submitted) return (
    <SuccessScreen
      formTitle={form?.formSettings?.title}
      onEvaluateAnother={handleEvaluateAnother}
    />
  );

  const { formSettings, sections, ratingScale } = form;
  const isDisabled = submitting;

  return (
    <div className="min-h-screen bg-linear-to-b from-green-50 via-white to-green-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* ── Branding ── */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 bg-linear-to-br from-green-600 to-green-700 rounded-lg flex items-center justify-center shadow-sm">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs font-bold text-green-700 uppercase tracking-widest">
            OJT Monitoring System
          </span>
        </div>

        {/* ── Form Header ── */}
        <div className="bg-linear-to-br from-green-600 to-green-700 rounded-2xl p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold leading-tight">
            {formSettings?.title || "Evaluation Form"}
          </h1>
          {formSettings?.description && (
            <p className="text-green-100 text-sm mt-2 leading-relaxed">
              {formSettings.description}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            {formSettings?.courseId && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/20 border border-white/30 text-white px-2.5 py-1 rounded-lg">
                <Building2 className="w-3.5 h-3.5" />
                {formSettings.courseId}
              </span>
            )}
            {formSettings?.academicYear && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/20 border border-white/30 text-white px-2.5 py-1 rounded-lg">
                <Calendar className="w-3.5 h-3.5" />
                {formSettings.academicYear}
              </span>
            )}
          </div>
        </div>

        {/* ── Evaluator Information ── */}
        <div className="bg-white rounded-xl border border-green-200 shadow-md p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="w-5 h-5 text-green-700" />
            <h2 className="text-base font-bold text-gray-900">Evaluator Information</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldInput
                label="Student Name"
                value={studentName}
                onChange={setStudentName}
                placeholder="Full name of the student being evaluated"
                required
                disabled={isDisabled}
              />
            </div>
            <FieldInput
              label="Supervisor Name"
              value={supervisor.name}
              onChange={v => setSupervisor(s => ({ ...s, name: v }))}
              placeholder="Your full name"
              required
              disabled={isDisabled}
            />
            <FieldInput
              label="Supervisor Position"
              value={supervisor.position}
              onChange={v => setSupervisor(s => ({ ...s, position: v }))}
              placeholder="e.g. Senior Developer"
              disabled={isDisabled}
            />
            <div className="sm:col-span-2">
              <FieldInput
                label="Company / Organization"
                value={supervisor.company}
                onChange={v => setSupervisor(s => ({ ...s, company: v }))}
                placeholder="Name of the company or organization"
                disabled={isDisabled}
              />
            </div>
          </div>
        </div>

        {/* ── Sections & Criteria ── */}
        {(!sections || sections.length === 0) && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center text-gray-400">
            <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No evaluation criteria found.</p>
          </div>
        )}

        {sections?.map((section, sIdx) => (
          <div key={section.id} className="bg-white rounded-xl border border-green-200 shadow-md overflow-hidden">

            {/* Section Header */}
            <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">
                {sIdx + 1}
              </span>
              <h2 className="text-sm font-bold text-gray-800">
                {section.title || "Untitled Section"}
              </h2>
              <span className="ml-auto text-xs text-gray-400 font-medium shrink-0">
                {section.criteria?.length || 0}{" "}
                {section.criteria?.length === 1 ? "criterion" : "criteria"}
              </span>
            </div>

            {/* Criteria */}
            <div className="divide-y divide-gray-100">
              {(!section.criteria || section.criteria.length === 0) && (
                <p className="text-xs text-gray-400 italic px-5 py-4">
                  No criteria in this section.
                </p>
              )}

              {section.criteria?.map((criterion, cIdx) => (
                <div key={criterion.id} className="px-5 py-5">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-gray-400 mt-0.5 shrink-0 w-6 text-right">
                      {cIdx + 1}.
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800 leading-snug">
                        {criterion.title || "Untitled Criterion"}
                        {criterion.required && (
                          <span className="text-red-500 ml-1 font-bold">*</span>
                        )}
                      </p>

                      {criterion.type === "rating" && (
                        <RatingInput
                          criterionId={criterion.id}
                          ratingScale={ratingScale}
                          value={answers[criterion.id]?.value}
                          onChange={handleAnswer}
                          disabled={isDisabled}
                        />
                      )}

                      {criterion.type === "yesno" && (
                        <YesNoInput
                          criterionId={criterion.id}
                          value={answers[criterion.id]?.value}
                          onChange={handleAnswer}
                          disabled={isDisabled}
                        />
                      )}

                      {criterion.type === "text" && (
                        <TextInput
                          criterionId={criterion.id}
                          value={answers[criterion.id]?.value}
                          onChange={handleAnswer}
                          disabled={isDisabled}
                        />
                      )}

                      {criterion.type === "multiple_choice" && (
                        <MultipleChoiceInput
                          criterionId={criterion.id}
                          options={criterion.options || []}
                          value={answers[criterion.id]?.value}
                          onChange={handleAnswer}
                          disabled={isDisabled}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ── Submit Block ── */}
        <div className="bg-white rounded-xl border border-green-200 shadow-md p-5">
          {submitError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 font-medium">{submitError}</p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-gray-400 leading-relaxed">
              By submitting, you confirm that all information provided is accurate and complete.
            </p>
            <button
              onClick={handleSubmit}
              disabled={isDisabled}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700
                         text-white text-sm font-bold rounded-xl border border-green-600 shadow-sm
                         transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Submitting..." : "Submit Evaluation"}
            </button>
          </div>
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-xs text-gray-400 pb-6">
          OJT Monitoring System · Evaluation Form · Responses are recorded securely.
        </p>

      </div>
    </div>
  );
};

export default PublicEvaluation;