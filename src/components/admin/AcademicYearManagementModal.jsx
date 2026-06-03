import { useEffect, useState, useCallback } from "react";
import {
  X,
  GraduationCap,
  Plus,
  Check,
  AlertCircle,
  Calendar,
  Loader2,
  ChevronRight,
} from "lucide-react";
import {
  getAcademicYears,
  getActiveAcademicYear,
  activateAcademicYear,
  createAcademicYear,
} from "../../api/academicYears";

/* ─────────────────────────────────────────────
   Tiny helpers
───────────────────────────────────────────── */
const fmt = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/* ─────────────────────────────────────────────
   Confirmation sub-modal
───────────────────────────────────────────── */
const ConfirmModal = ({ message, onConfirm, onCancel, loading }) => (
  <div className="fixed inset-0 z-10000 flex items-center justify-center px-4">
    {/* backdrop */}
    <div
      className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    />
    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10 animate-modal-in">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: "rgb(var(--primary-light) / 0.12)" }}
      >
        <AlertCircle size={22} style={{ color: "rgb(var(--primary-text))" }} />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        Activate Academic Year
      </h3>
      <p className="text-sm text-gray-500 mb-6">{message}</p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          style={{ backgroundColor: "rgb(var(--primary))" }}
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Confirm
        </button>
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   New Academic Year inline form
───────────────────────────────────────────── */
const NewYearForm = ({ onSuccess, onCancel }) => {
  const [form, setForm] = useState({
    academic_year_name: "",
    start_date: "",
    end_date: "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  const validate = () => {
    const e = {};
    if (!form.academic_year_name.trim())
      e.academic_year_name = "Name is required.";
    if (!form.start_date) e.start_date = "Start date is required.";
    if (!form.end_date) e.end_date = "End date is required.";
    if (form.start_date && form.end_date && form.start_date >= form.end_date)
      e.end_date = "End date must be after start date.";
    return e;
  };

  const handleSubmit = async () => {
    setServerError("");
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    try {
      setSaving(true);
      await createAcademicYear(form);
      onSuccess();
    } catch (err) {
      setServerError(
        err?.response?.data?.message || "Failed to create academic year."
      );
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, type = "text", placeholder = "") => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => {
          setForm((p) => ({ ...p, [key]: e.target.value }));
          setErrors((p) => ({ ...p, [key]: undefined }));
        }}
        placeholder={placeholder}
        className={`w-full px-3 py-2 rounded-xl border text-sm transition-colors outline-none focus:ring-2 ${
          errors[key]
            ? "border-red-300 focus:ring-red-100"
            : "border-gray-200 focus:border-transparent"
        }`}
        style={
          !errors[key]
            ? { "--tw-ring-color": "rgb(var(--primary-light) / 0.3)" }
            : {}
        }
      />
      {errors[key] && (
        <p className="text-xs text-red-500 mt-1">{errors[key]}</p>
      )}
    </div>
  );

  return (
    <div
      className="rounded-2xl border p-5 mt-2 mb-4"
      style={{
        borderColor: "rgb(var(--primary-light) / 0.3)",
        backgroundColor: "rgb(var(--primary-light) / 0.04)",
      }}
    >
      <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "rgb(var(--primary-light) / 0.15)" }}
        >
          <Plus size={13} style={{ color: "rgb(var(--primary-text))" }} />
        </div>
        New Academic Year
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {field("academic_year_name", "Year Name", "text", "e.g. 2025–2026")}
        {field("start_date", "Start Date", "date")}
        {field("end_date", "End Date", "date")}
      </div>

      {serverError && (
        <p className="text-xs text-red-500 mt-3 flex items-center gap-1.5">
          <AlertCircle size={12} /> {serverError}
        </p>
      )}

      <div className="flex gap-2 mt-4 justify-end">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-70 flex items-center gap-2"
          style={{ backgroundColor: "rgb(var(--primary))" }}
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Create Year
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Main Modal
───────────────────────────────────────────── */
const AcademicYearManagementModal = ({ isOpen, onClose, isAdmin = true }) => {
  const [years, setYears] = useState([]);
  const [activeYear, setActiveYear] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [confirm, setConfirm] = useState(null); // { year } | null
  const [activating, setActivating] = useState(false);
  const [successId, setSuccessId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allRes, activeRes] = await Promise.all([
        getAcademicYears(),
        getActiveAcademicYear(),
      ]);
      if (allRes.data?.success) setYears(allRes.data.academicYears || []);
      if (activeRes.data?.success)
        setActiveYear(activeRes.data.academicYear || null);
    } catch (err) {
      console.error("Failed to load academic years:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      load();
      setShowForm(false);
    }
  }, [isOpen, load]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && !confirm) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, confirm]);

  const handleActivate = async () => {
    if (!confirm) return;
    setActivating(true);
    try {
      await activateAcademicYear(confirm.year.academic_year_id);
      const res = await getActiveAcademicYear();
      if (res.data?.success) setActiveYear(res.data.academicYear || null);
      window.dispatchEvent(new CustomEvent("academicYearChanged"));
      setSuccessId(confirm.year.academic_year_id);
      setTimeout(() => setSuccessId(null), 2500);
    } catch (err) {
      console.error("Failed to activate:", err);
    } finally {
      setActivating(false);
      setConfirm(null);
    }
  };

  const handleFormSuccess = async () => {
    setShowForm(false);
    await load();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Confirm sub-modal */}
      {confirm && (
        <ConfirmModal
          message={`Are you sure you want to activate "${confirm.year.academic_year_name}"? The current active year will become inactive.`}
          onConfirm={handleActivate}
          onCancel={() => setConfirm(null)}
          loading={activating}
        />
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-9999 flex items-center justify-center px-4 py-6"
        style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      >
        {/* Panel */}
        <div
          className="relative bg-white w-full rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-modal-in"
          style={{ maxWidth: 900, maxHeight: "calc(100vh - 48px)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div
            className="px-6 py-5 flex items-center justify-between shrink-0"
            style={{
              background: `linear-gradient(135deg, rgb(var(--primary)) 0%, rgb(var(--primary-medium)) 100%)`,
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                <GraduationCap size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">
                  Academic Year Management
                </h2>
                <p className="text-xs text-white/70 mt-0.5">
                  Manage and activate academic years
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center"
            >
              <X size={15} className="text-white" />
            </button>
          </div>

          {/* ── Toolbar ── */}
          {isAdmin && (
            <div className="px-6 pt-5 pb-0 shrink-0 flex items-center justify-between">
              <p className="text-xs text-gray-400 font-medium">
                {years.length} year{years.length !== 1 ? "s" : ""} total
              </p>
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ backgroundColor: "rgb(var(--primary))" }}
                >
                  <Plus size={14} />
                  New Academic Year
                </button>
              )}
            </div>
          )}

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
            {/* Inline create form */}
            {showForm && isAdmin && (
              <NewYearForm
                onSuccess={handleFormSuccess}
                onCancel={() => setShowForm(false)}
              />
            )}

            {/* Loading */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2
                  size={28}
                  className="animate-spin"
                  style={{ color: "rgb(var(--primary))" }}
                />
                <p className="text-sm text-gray-400">Loading academic years…</p>
              </div>
            ) : years.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: "rgb(var(--primary-light) / 0.12)" }}
                >
                  <GraduationCap
                    size={24}
                    style={{ color: "rgb(var(--primary-text))" }}
                  />
                </div>
                <p className="text-sm text-gray-500 font-medium">
                  No academic years found.
                </p>
                {isAdmin && (
                  <p className="text-xs text-gray-400">
                    Create one using the button above.
                  </p>
                )}
              </div>
            ) : (
              /* ── Table ── */
              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                {/* Table head */}
                <div className="grid grid-cols-12 bg-gray-50 border-b border-gray-100 px-4 py-2.5">
                  <div className="col-span-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Academic Year
                  </div>
                  <div className="col-span-3 text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                    <Calendar size={11} /> Start Date
                  </div>
                  <div className="col-span-3 text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                    <Calendar size={11} /> End Date
                  </div>
                  <div className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">
                    Status
                  </div>
                </div>

                {/* Rows */}
                <ul className="divide-y divide-gray-50">
                  {years.map((year) => {
                    const isActive =
                      year.academic_year_id === activeYear?.academic_year_id;
                    const justActivated = successId === year.academic_year_id;

                    return (
                      <li
                        key={year.academic_year_id}
                        className={`grid grid-cols-12 items-center px-4 py-3.5 transition-colors ${
                          isActive ? "bg-emerald-50/60" : "hover:bg-gray-50/80"
                        }`}
                      >
                        {/* Name */}
                        <div className="col-span-4 flex items-center gap-2.5">
                          {isActive && (
                            <div
                              className="w-1.5 h-8 rounded-full"
                              style={{
                                backgroundColor: "rgb(var(--primary))",
                              }}
                            />
                          )}
                          <span
                            className={`text-sm ${
                              isActive
                                ? "font-semibold"
                                : "font-medium text-gray-700"
                            }`}
                            style={
                              isActive
                                ? { color: "rgb(var(--primary-text))" }
                                : {}
                            }
                          >
                            {year.academic_year_name}
                          </span>
                        </div>

                        {/* Start */}
                        <div className="col-span-3 text-sm text-gray-500">
                          {fmt(year.start_date)}
                        </div>

                        {/* End */}
                        <div className="col-span-3 text-sm text-gray-500">
                          {fmt(year.end_date)}
                        </div>

                        {/* Status + action */}
                        <div className="col-span-2 flex items-center justify-center">
                          {isActive ? (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                                justActivated
                                  ? "ring-2 ring-emerald-300"
                                  : ""
                              }`}
                              style={{
                                backgroundColor:
                                  "rgb(var(--primary-light) / 0.15)",
                                color: "rgb(var(--primary-text))",
                              }}
                            >
                              <Check size={11} strokeWidth={2.5} />
                              Active
                            </span>
                          ) : isAdmin ? (
                            <button
                              onClick={() => setConfirm({ year })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors group"
                            >
                              Set Active
                              <ChevronRight
                                size={11}
                                className="group-hover:translate-x-0.5 transition-transform"
                              />
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-gray-400 bg-gray-100">
                              Inactive
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Animation keyframes injected once */}
      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        .animate-modal-in { animation: modal-in 0.22s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>
    </>
  );
};

export default AcademicYearManagementModal;