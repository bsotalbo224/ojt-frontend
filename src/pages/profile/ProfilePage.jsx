import { useState, useEffect, useRef } from "react";
import {
  User, Mail, Shield, Pencil, CheckCircle2,
  Loader2, AlertCircle, Save, X, Camera,
} from "lucide-react";
import api from "../../api/axios";

const isCloudinary = photo?.startsWith("http");

const BASE_URL = import.meta.env.VITE_BASE_URL;

const ROLE_LABELS = {
  student:     "Student",
  coordinator: "Coordinator",
  admin:       "Admin",
};

// blue/amber are semantic role colours — kept as Tailwind.
// admin ("green") uses primary CSS vars.
const ROLE_COLORS = {
  student:     "bg-blue-50 text-blue-700 border-blue-100",
  coordinator: "bg-amber-50 text-amber-700 border-amber-100",
  admin:       null,   // rendered inline with CSS vars
};

const getRoleBadgeStyle = (key) => {
  const twClass = ROLE_COLORS[key?.toLowerCase()];
  if (twClass !== null && twClass !== undefined) return { twClass, inline: null };
  // admin or unknown → primary vars
  return {
    twClass: "border",
    inline: {
      backgroundColor: `rgb(var(--primary-50))`,
      color:           `rgb(var(--primary-700))`,
      borderColor:     `rgb(var(--primary-100))`,
    },
  };
};

/* ── Avatar ──────────────────────────────────────────────────────────────── */
function Avatar({ photo, name, size = "lg", onUpload }) {
  const [imgError, setImgError] = useState(false);
  const [cacheKey, setCacheKey] = useState(Date.now());
  const inputRef = useRef(null);

  useEffect(() => { setImgError(false); setCacheKey(Date.now()); }, [photo]);

  const sizeClasses = size === "lg" ? "w-24 h-24 text-4xl" : "w-10 h-10 text-base";
  const iconSize    = size === "lg" ? 40 : 18;
  const hasPhoto    = photo?.length > 0 && !imgError;

  return (
    <div className="relative inline-block">
      {hasPhoto ? (
        <img
          src={isCloudinary ? `${photo}?t=${cacheKey}` : `${BASE_URL}${photo}?t=${cacheKey}`}
          alt={name}
          onError={() => setImgError(true)}
          className={`${sizeClasses} rounded-full object-cover shadow`}
          style={{ outline: `4px solid rgb(var(--primary-100))` }}
        />
      ) : (
        <div
          className={`${sizeClasses} rounded-full flex items-center justify-center shadow`}
          style={{
            backgroundColor: `rgb(var(--primary-100))`,
            outline:         `4px solid rgb(var(--primary-50))`,
          }}
        >
          <User size={iconSize} style={{ color: `rgb(var(--primary-600))` }} />
        </div>
      )}

      {onUpload && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-colors"
            style={{ backgroundColor: `rgb(var(--primary-600))` }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}
            title="Change photo"
          >
            <Camera size={13} className="text-white" />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
        </>
      )}
    </div>
  );
}

/* ── Read-only info row ──────────────────────────────────────────────────── */
function InfoRow({ icon: Icon, label, value, highlight, colorKey }) {
  const badge = highlight ? getRoleBadgeStyle(colorKey ?? value) : null;

  return (
    <div className="flex items-start gap-3 py-3 last:border-0" style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}>
      <div
        className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `rgb(var(--primary-50))` }}
      >
        <Icon size={16} style={{ color: `rgb(var(--primary-600))` }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
        {highlight ? (
          <span
            className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-0.5 rounded-full ${badge.twClass}`}
            style={badge.inline ?? {}}
          >
            <CheckCircle2 size={12} />{value}
          </span>
        ) : (
          <p className="text-sm font-medium text-gray-800 truncate">{value || "—"}</p>
        )}
      </div>
    </div>
  );
}

/* ── Editable field ──────────────────────────────────────────────────────── */
function EditField({ icon: Icon, label, name, value, onChange, type = "text" }) {
  return (
    <div className="flex items-start gap-3 py-3 last:border-0" style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}>
      <div
        className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `rgb(var(--primary-50))` }}
      >
        <Icon size={16} style={{ color: `rgb(var(--primary-600))` }} />
      </div>
      <div className="flex-1 min-w-0">
        <label htmlFor={name} className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 block">
          {label}
        </label>
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          className="w-full text-sm font-medium text-gray-800 rounded-lg px-3 py-1.5 outline-none transition"
          style={{
            backgroundColor: `rgb(var(--primary-50) / 0.6)`,
            border:          `1px solid rgb(var(--primary-200))`,
          }}
          onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-400))`; e.target.style.borderColor = 'transparent'; }}
          onBlur={e =>  { e.target.style.boxShadow = 'none'; e.target.style.borderColor = `rgb(var(--primary-200))`; }}
        />
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function ProfilePage() {
  const [user,      setUser]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [editMode,  setEditMode]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [form,      setForm]      = useState({ f_name: "", l_name: "", email: "" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/auth/me");
        if (!cancelled && data.success) setUser(data.user);
      } catch {
        if (!cancelled) setError("Failed to load profile. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const activeRole   = localStorage.getItem("activeRole") || user?.role;
  const roles        = user?.roles || (user?.role ? [user.role] : []);
  const orderedRoles = [activeRole, ...roles.filter(r => r !== activeRole)];
  const roleDisplay  = orderedRoles
    .filter(Boolean)
    .map(r => ROLE_LABELS[r?.toLowerCase()] ?? (r?.charAt(0).toUpperCase() + r?.slice(1)))
    .join(" / ");

  function startEdit() {
    if (!user) return;
    const [f_name, ...rest] = user.name.split(" ");
    setForm({ f_name: f_name ?? "", l_name: rest.join(" ") ?? "", email: user.email ?? "" });
    setSaveError(null);
    setEditMode(true);
  }

  function cancelEdit() { setEditMode(false); setSaveError(null); }
  function handleChange(e) { setForm((prev) => ({ ...prev, [e.target.name]: e.target.value })); }

  async function saveProfile() {
    setSaving(true); setSaveError(null);
    try {
      const { data } = await api.put("/auth/update-profile", {
        f_name: form.f_name.trim(), l_name: form.l_name.trim(), email: form.email.trim(),
      });
      if (data.success) { setUser(data.user); setEditMode(false); }
      else setSaveError(data.message ?? "Update failed. Please try again.");
    } catch (err) {
      setSaveError(err.response?.data?.message ?? "Update failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(file) {
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const { data } = await api.post("/auth/upload-avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (data.success) setUser(data.user);
    } catch { /* silently ignore */ }
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: `rgb(var(--primary-50))` }}
      >
        <div className="flex flex-col items-center gap-3" style={{ color: `rgb(var(--primary-700))` }}>
          <Loader2 size={36} className="animate-spin" />
          <span className="text-sm font-medium">Loading your profile…</span>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: `rgb(var(--primary-50))` }}
      >
        <div className="bg-white rounded-2xl shadow border border-red-100 p-8 max-w-sm w-full text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-sm font-medium hover:underline"
            style={{ color: `rgb(var(--primary-600))` }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const activeBadge = getRoleBadgeStyle(activeRole);

  /* ── Profile ── */
  return (
    <div
      className="min-h-screen py-10 px-4"
      style={{ backgroundColor: `rgb(var(--primary-50))` }}
    >
      {/* Page Header */}
      <div className="max-w-2xl mx-auto mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: `rgb(var(--primary-800))` }}>
          My Profile
        </h1>
        <p className="text-sm mt-1" style={{ color: `rgb(var(--primary-600))` }}>
          View and manage your account information
        </p>
      </div>

      {/* Profile Card */}
      <div
        className="max-w-2xl mx-auto bg-white rounded-2xl shadow overflow-hidden"
        style={{ border: `1px solid rgb(var(--primary-100))` }}
      >
        {/* Banner */}
        <div
          className="h-24 relative"
          style={{ background: `linear-gradient(to right, rgb(var(--primary-600)), rgb(var(--primary-500)))` }}
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(255,255,255,.15) 10px,rgba(255,255,255,.15) 20px)",
            }}
          />
        </div>

        {/* Avatar + action buttons */}
        <div className="px-6 pb-0 -mt-12 flex items-end justify-between">
          <Avatar photo={user?.photo} name={user?.name} size="lg" onUpload={handleAvatarUpload} />

          {!editMode ? (
            <button
              type="button"
              onClick={startEdit}
              className="mb-2 inline-flex items-center gap-2 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors shadow-sm"
              style={{ backgroundColor: `rgb(var(--primary-600))` }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}
            >
              <Pencil size={14} />Edit Profile
            </button>
          ) : (
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg px-3 py-2 transition-colors shadow-sm disabled:opacity-50"
              >
                <X size={14} />Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors shadow-sm disabled:opacity-60"
                style={{ backgroundColor: `rgb(var(--primary-600))` }}
                onMouseEnter={e => { if (!saving) e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`; }}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-600))`}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        {/* Name & Role */}
        <div className="px-6 pt-4 pb-2">
          <h2 className="text-xl font-bold text-gray-900 leading-tight">{user?.name ?? "—"}</h2>
          <span
            className={`mt-1 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${activeBadge.twClass}`}
            style={activeBadge.inline ?? {}}
          >
            <CheckCircle2 size={11} />{roleDisplay}
          </span>
        </div>

        {/* Save error banner */}
        {saveError && (
          <div className="mx-6 mb-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{saveError}</p>
          </div>
        )}

        {/* Divider */}
        <div className="mx-6 mt-2" style={{ borderTop: `1px solid rgb(var(--primary-50))` }} />

        {/* Info / Edit rows */}
        <div className="px-6 py-2">
          {editMode ? (
            <>
              <EditField icon={User}  label="First Name"    name="f_name" value={form.f_name} onChange={handleChange} />
              <EditField icon={User}  label="Last Name"     name="l_name" value={form.l_name} onChange={handleChange} />
              <EditField icon={Mail}  label="Email Address" name="email"  type="email" value={form.email} onChange={handleChange} />
              <InfoRow   icon={Shield} label="Role" value={roleDisplay} colorKey={activeRole} highlight />
            </>
          ) : (
            <>
              <InfoRow icon={User}   label="Full Name"     value={user?.name} />
              <InfoRow icon={Mail}   label="Email Address" value={user?.email} />
              <InfoRow icon={Shield} label="Role" value={roleDisplay} colorKey={activeRole} highlight />
            </>
          )}
        </div>

        {/* Card Footer */}
        <div
          className="px-6 py-4 flex items-center justify-between rounded-b-2xl"
          style={{ backgroundColor: `rgb(var(--primary-50))` }}
        >
          <p className="text-xs" style={{ color: `rgb(var(--primary-600))` }}>
            OJT Monitoring System &mdash; Account #{user?.user_id}
          </p>
          <span className="text-xs font-medium" style={{ color: `rgb(var(--primary-500))` }}>
            {activeRole?.charAt(0).toUpperCase() + activeRole?.slice(1)} Account
          </span>
        </div>
      </div>
    </div>
  );
}