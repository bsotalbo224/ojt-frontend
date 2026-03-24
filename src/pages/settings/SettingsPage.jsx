import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Lock, KeyRound, ShieldCheck, User, Mail, Eye, EyeOff,
  CheckCircle2, AlertCircle, Loader2, Settings, BadgeCheck, Palette,
  ImagePlus, UploadCloud, X, CheckCircle, Sparkles,
} from "lucide-react";
import api from "../../api/axios";
import { THEMES } from "../../components/themes/themes";

// ─── Theme classification ─────────────────────────────────────────────────────

const isSpecialTheme = (key) =>
  key.includes("dark") ||
  key.includes("ccs")  ||
  key.includes("gold") ||
  key.includes("ember");

const normalThemes  = Object.entries(THEMES).filter(([key]) => !isSpecialTheme(key));
const specialThemes = Object.entries(THEMES).filter(([key]) =>  isSpecialTheme(key));

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS = {
  student:     "Student",
  coordinator: "Coordinator",
  admin:       "Admin",
};

const MAX_FILE_SIZE_MB = 2;
const ACCEPTED_TYPES   = ["image/png", "image/jpeg", "image/svg+xml"];

// ─── PasswordInput ────────────────────────────────────────────────────────────

function PasswordInput({ label, value, onChange, show, onToggle, placeholder }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-gray-600">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "••••••••"}
          required
          className="w-full px-4 py-2.5 pr-11 rounded-xl text-gray-800 placeholder-gray-400 outline-none transition text-sm"
          style={{
            border:          `1px solid rgb(var(--primary-200))`,
            backgroundColor: `rgb(var(--primary-50) / 0.4)`,
          }}
          onFocus={(e) => {
            e.target.style.boxShadow   = `0 0 0 2px rgb(var(--primary-400))`;
            e.target.style.borderColor = "transparent";
          }}
          onBlur={(e) => {
            e.target.style.boxShadow   = "none";
            e.target.style.borderColor = `rgb(var(--primary-200))`;
          }}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition"
          onMouseEnter={(e) => (e.currentTarget.style.color = `rgb(var(--primary-600))`)}
          onMouseLeave={(e) => (e.currentTarget.style.color = "")}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  );
}

// ─── LogoDropZone ─────────────────────────────────────────────────────────────

function LogoDropZone({ preview, onFileSelect, onClear }) {
  const inputRef                = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div
      onClick={() => !preview && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200 overflow-hidden cursor-pointer select-none"
      style={{
        minHeight:       "140px",
        borderColor:     dragging
          ? `rgb(var(--primary-500))`
          : preview
            ? `rgb(var(--primary-300))`
            : `rgb(var(--primary-200))`,
        backgroundColor: dragging
          ? `rgb(var(--primary-50))`
          : preview
            ? `rgb(var(--primary-50) / 0.3)`
            : `rgb(var(--primary-50) / 0.4)`,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.target.value = "";
        }}
      />

      {preview ? (
        <>
          <img
            src={preview}
            alt="Logo preview"
            className="max-h-24 max-w-50 object-contain drop-shadow-sm transition-all duration-300"
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-sm border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 transition-all"
          >
            <X size={13} />
          </button>
          <p className="text-xs text-gray-400 mt-2">Click to replace</p>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 py-6 px-4 text-center pointer-events-none">
          <div className="p-3 rounded-xl" style={{ backgroundColor: `rgb(var(--primary-100))` }}>
            <UploadCloud size={22} style={{ color: `rgb(var(--primary-500))` }} />
          </div>
          <p className="text-sm font-semibold text-gray-700">
            {dragging ? "Drop to upload" : "Drag & drop or click to upload"}
          </p>
          <p className="text-xs text-gray-400">PNG, JPG, SVG · max {MAX_FILE_SIZE_MB} MB</p>
        </div>
      )}
    </div>
  );
}

// ─── ThemeButton ──────────────────────────────────────────────────────────────

function ThemeButton({ themeKey, theme, selected, onClick, disabled }) {
  const primaryRgb =
    theme.vars["--primary"] ||
    theme.vars["--primary-600"] ||
    "100 116 139";

  // Dual-tone swatch for special/dark themes that expose an accent
  const accentRgb = theme.vars["--accent"] || null;

  return (
    <button
      type="button"
      onClick={() => !disabled && onClick(themeKey)}
      disabled={disabled}
      title={theme.name}
      className={`
        relative flex items-center gap-2 px-3 py-2.5 rounded-xl border-2
        transition-all duration-150 text-sm font-semibold text-left w-full
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
      style={
        selected
          ? {
              borderColor:     `rgb(${primaryRgb})`,
              backgroundColor: `rgb(${primaryRgb} / 0.08)`,
              color:           `rgb(${primaryRgb})`,
              boxShadow:       `0 0 0 1px rgb(${primaryRgb} / 0.25)`,
            }
          : {
              borderColor:     "#e5e7eb",
              backgroundColor: "white",
              color:           "#6b7280",
            }
      }
      onMouseEnter={(e) => {
        if (!disabled && !selected) {
          e.currentTarget.style.borderColor     = `rgb(${primaryRgb} / 0.5)`;
          e.currentTarget.style.backgroundColor = `rgb(${primaryRgb} / 0.05)`;
          e.currentTarget.style.color           = `rgb(${primaryRgb})`;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !selected) {
          e.currentTarget.style.borderColor     = "#e5e7eb";
          e.currentTarget.style.backgroundColor = "white";
          e.currentTarget.style.color           = "#6b7280";
        }
      }}
    >
      {/* Color swatch — dual-tone when accent is present */}
      <span
        className="relative shrink-0 w-4 h-4 rounded-full ring-1 ring-black/10 overflow-hidden"
      >
        <span
          className="absolute inset-0"
          style={{ backgroundColor: `rgb(${primaryRgb})` }}
        />
        {accentRgb && (
          <span
            className="absolute right-0 top-0 w-1/2 h-full"
            style={{ backgroundColor: `rgb(${accentRgb})` }}
          />
        )}
      </span>

      <span className="truncate">{theme.name}</span>

      {selected && (
        <CheckCircle2
          size={13}
          className="ml-auto shrink-0"
          style={{ color: `rgb(${primaryRgb})` }}
        />
      )}
    </button>
  );
}

// ─── ThemeSelector ────────────────────────────────────────────────────────────

function ThemeSelector({ selectedTheme, onSelect, isAdmin, selectedDept }) {
  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-gray-600">Theme Color</label>

      {/* ── Standard Themes ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Standard
          </p>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {normalThemes.map(([key, theme]) => (
            <ThemeButton
              key={key}
              themeKey={key}
              theme={theme}
              selected={selectedTheme === key}
              onClick={onSelect}
              disabled={!isAdmin}
            />
          ))}
        </div>
      </div>

      {/* ── Special Themes ── */}
      {specialThemes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles
              size={12}
              className="shrink-0"
              style={{ color: `rgb(var(--primary-400))` }}
            />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Special &amp; Branded
            </p>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {specialThemes.map(([key, theme]) => (
              <ThemeButton
                key={key}
                themeKey={key}
                theme={theme}
                selected={selectedTheme === key}
                onClick={onSelect}
                disabled={!isAdmin}
              />
            ))}
          </div>

          {/* Contextual note when a special theme is active */}
          {isSpecialTheme(selectedTheme) && (
            <div
              className="flex items-start gap-2 text-xs rounded-xl px-3 py-2.5 mt-1"
              style={{
                backgroundColor: `rgb(var(--primary-50))`,
                border:          `1px solid rgb(var(--primary-100))`,
                color:           `rgb(var(--primary-700))`,
              }}
            >
              <Sparkles size={13} className="mt-0.5 shrink-0" />
              <span>
                This is a special or dark theme. It may override background and
                text colors across the department interface.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Selected label */}
      {selectedDept && (
        <p className="text-xs text-gray-400 pt-0.5">
          Selected:{" "}
          <span className="font-semibold text-gray-600">
            {THEMES[selectedTheme]?.name ?? selectedTheme}
          </span>
        </p>
      )}

      {/* Non-admin notice */}
      {!isAdmin && (
        <p className="text-xs text-gray-400 italic">
          Only administrators can change the department theme.
        </p>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const navigate = useNavigate();

  // Seed from localStorage so the page never flashes empty on mount
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loadingUser, setLoadingUser] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg,   setErrorMsg]   = useState("");

  // Theme state
  const [departments,   setDepartments]   = useState([]);
  const [selectedDept,  setSelectedDept]  = useState("");
  const [selectedTheme, setSelectedTheme] = useState("green");
  const [savingTheme,   setSavingTheme]   = useState(false);
  const [loadingDepts,  setLoadingDepts]  = useState(false);

  // Logo state
  const [logoFile,      setLogoFile]      = useState(null);
  const [logoPreview,   setLogoPreview]   = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoSuccess,   setLogoSuccess]   = useState("");
  const [logoError,     setLogoError]     = useState("");
  const [logoDept,      setLogoDept]      = useState("");

  // ── Single source of truth ───────────────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    const res = await api.get("/auth/me");
    const raw = res.data?.user ?? res.data;

    const normalized = {
      ...raw,
      name:
        raw.name ||
        raw.full_name ||
        [raw.f_name, raw.l_name].filter(Boolean).join(" ") ||
        raw.email ||
        "Unknown",
    };

    localStorage.setItem("user", JSON.stringify(normalized));
    setUser(normalized);
    window.dispatchEvent(new Event("userUpdated"));
    return normalized;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refreshUser();
      } catch {
        setErrorMsg("Failed to load user information.");
      } finally {
        setLoadingUser(false);
      }
    })();
  }, [refreshUser]);

  // Load departments (admin only)
  useEffect(() => {
    if (!user?.roles?.includes("admin")) return;
    setLoadingDepts(true);
    (async () => {
      try {
        const res = await api.get("/admin/departments/theme-list");
        if (res.data?.success) setDepartments(res.data.departments || []);
      } catch {
        setDepartments([]);
      } finally {
        setLoadingDepts(false);
      }
    })();
  }, [user?.roles]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const activeRole   = localStorage.getItem("activeRole") || user?.role;
  const roles        = user?.roles || (user?.role ? [user.role] : []);
  const orderedRoles = [activeRole, ...roles.filter((r) => r !== activeRole)];
  const roleDisplay  = orderedRoles
    .filter(Boolean)
    .map((r) => ROLE_LABELS[r?.toLowerCase()] ?? (r?.charAt(0).toUpperCase() + r?.slice(1)))
    .join(" / ");

  const roleBadgeClass = (role) => {
    switch (role) {
      case "admin":
        return { tw: "bg-purple-100 text-purple-700 border-purple-200", inline: null };
      case "coordinator":
        return { tw: "bg-blue-100 text-blue-700 border-blue-200", inline: null };
      default:
        return {
          tw: "border",
          inline: {
            backgroundColor: `rgb(var(--primary-100))`,
            color:           `rgb(var(--primary-700))`,
            borderColor:     `rgb(var(--primary-200))`,
          },
        };
    }
  };

  const isAdmin = activeRole === "admin";
  const clearMessages = () => { setSuccessMsg(""); setErrorMsg(""); };

  // ── Password handlers ────────────────────────────────────────────────────────
  const handleFirstLogin = async (e) => {
    e.preventDefault();
    clearMessages();
    if (newPassword !== confirmPassword) { setErrorMsg("Passwords do not match."); return; }
    if (newPassword.length < 8)          { setErrorMsg("Password must be at least 8 characters."); return; }
    setSubmitting(true);
    try {
      await api.put("/auth/change-password-first", { new_password: newPassword });
      setSuccessMsg("Password set successfully! Redirecting…");
      setTimeout(() => navigate(`/${activeRole}/dashboard`), 1500);
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to set password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    clearMessages();
    if (newPassword !== confirmPassword) { setErrorMsg("New passwords do not match."); return; }
    if (newPassword.length < 8)          { setErrorMsg("New password must be at least 8 characters."); return; }
    setSubmitting(true);
    try {
      await api.put("/users/change-password", {
        current_password: currentPassword,
        new_password:     newPassword,
      });
      setSuccessMsg("Password updated successfully!");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to update password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Theme handlers ───────────────────────────────────────────────────────────
  const handleDeptChange = (deptId) => {
    setSelectedDept(deptId);
    if (!deptId) { setSelectedTheme("green"); return; }
    const dept = departments.find((d) => String(d.department_id) === String(deptId));
    if (dept?.theme) setSelectedTheme(dept.theme);
  };

  const handleSaveTheme = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!selectedDept) { setErrorMsg("Please select a department."); return; }
    setSavingTheme(true);
    try {
      await api.put("/admin/departments/theme", {
        department_id: Number(selectedDept),
        theme:         selectedTheme,
      });
      await refreshUser();
      setSuccessMsg("Department theme updated successfully!");
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to update department theme. Please try again.");
    } finally {
      setSavingTheme(false);
    }
  };

  // ── Logo handlers ────────────────────────────────────────────────────────────
  const handleLogoFileSelect = (file) => {
    setLogoError("");
    setLogoSuccess("");
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setLogoError("Invalid file type. Please upload a PNG, JPG, or SVG.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setLogoError(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleClearLogo = () => {
    setLogoFile(null);
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
      setLogoPreview(null);
    }
    setLogoError("");
    setLogoSuccess("");
  };

  const handleUploadLogo = async (e) => {
    e.preventDefault();
    setLogoError("");
    setLogoSuccess("");
    if (!logoDept) { setLogoError("Please select a department."); return; }
    if (!logoFile) { setLogoError("Please select a logo file.");  return; }
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("department_id", logoDept);
      formData.append("logo", logoFile);
      await api.post("/admin/departments/upload-logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await refreshUser();
      setLogoSuccess("Department logo uploaded successfully!");
      handleClearLogo();
    } catch (err) {
      setLogoError(err?.response?.data?.message || "Failed to upload logo. Please try again.");
    } finally {
      setUploadingLogo(false);
    }
  };

  // ── Loading screen ───────────────────────────────────────────────────────────
  if (loadingUser) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: `rgb(var(--primary-50))` }}
      >
        <div className="flex flex-col items-center gap-3" style={{ color: `rgb(var(--primary-600))` }}>
          <Loader2 size={36} className="animate-spin" />
          <p className="text-sm font-medium">Loading settings…</p>
        </div>
      </div>
    );
  }

  // ── Local shared components ──────────────────────────────────────────────────

  const SectionHeader = ({ icon: Icon, title, subtitle }) => (
    <div
      className="flex items-center gap-3 pb-1"
      style={{ borderBottom: `1px solid rgb(var(--primary-50))` }}
    >
      <div className="p-2 rounded-lg" style={{ backgroundColor: `rgb(var(--primary-100))` }}>
        <Icon size={18} style={{ color: `rgb(var(--primary-600))` }} />
      </div>
      <div>
        <h2 className="font-bold text-gray-800 text-base">{title}</h2>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
    </div>
  );

  const PrimaryBtn = ({ submitting: busy, label, busyLabel, icon: Icon }) => (
    <button
      type="submit"
      disabled={busy}
      className="w-full flex items-center justify-center gap-2 text-white font-semibold py-2.5 rounded-xl transition text-sm shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
      style={{ backgroundColor: busy ? `rgb(var(--primary-300))` : `rgb(var(--primary-600))` }}
      onMouseEnter={(e) => { if (!busy) e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = busy ? `rgb(var(--primary-300))` : `rgb(var(--primary-600))`; }}
    >
      {busy
        ? <><Loader2 size={16} className="animate-spin" />{busyLabel}</>
        : <><Icon size={16} />{label}</>}
    </button>
  );

  // Reusable department <select> — handles loading / empty states
  const DeptSelect = ({ value, onChange }) => {
    if (loadingDepts) {
      return (
        <div
          className="flex items-center gap-2 text-gray-400 text-sm py-2.5 px-4 rounded-xl"
          style={{
            border:          `1px solid rgb(var(--primary-200))`,
            backgroundColor: `rgb(var(--primary-50) / 0.4)`,
          }}
        >
          <Loader2 size={15} className="animate-spin" />Loading departments…
        </div>
      );
    }
    if (departments.length === 0) {
      return (
        <div className="flex items-center gap-2 text-amber-600 text-xs py-2.5 px-4 rounded-xl border border-amber-200 bg-amber-50">
          <AlertCircle size={14} className="shrink-0" />
          No departments found. Please check your connection.
        </div>
      );
    }
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl text-gray-800 outline-none transition text-sm appearance-none cursor-pointer"
        style={{
          border:          `1px solid rgb(var(--primary-200))`,
          backgroundColor: `rgb(var(--primary-50) / 0.4)`,
        }}
        onFocus={(e) => {
          e.target.style.boxShadow   = `0 0 0 2px rgb(var(--primary-400))`;
          e.target.style.borderColor = "transparent";
        }}
        onBlur={(e) => {
          e.target.style.boxShadow   = "none";
          e.target.style.borderColor = `rgb(var(--primary-200))`;
        }}
      >
        <option value="">— Select a department —</option>
        {departments.map((dept) => (
          <option key={dept.department_id} value={dept.department_id}>
            {dept.department_name}{dept.department_code ? ` (${dept.department_code})` : ""}
          </option>
        ))}
      </select>
    );
  };

  const badge = roleBadgeClass(activeRole);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen py-10 px-4"
      style={{
        background: `linear-gradient(to bottom right, rgb(var(--primary-50)), white, rgb(var(--primary-50) / 0.4))`,
      }}
    >
      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── Page Header ── */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="p-2.5 bg-white rounded-xl shadow-sm"
            style={{ border: `1px solid rgb(var(--primary-100))` }}
          >
            <Settings size={22} style={{ color: `rgb(var(--primary-600))` }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Settings</h1>
            <p className="text-sm text-gray-400">Manage your account security and preferences</p>
          </div>
        </div>

        {/* ── Global Feedback ── */}
        {successMsg && (
          <div
            className="flex items-center gap-2.5 text-sm rounded-xl px-4 py-3 shadow-sm"
            style={{
              backgroundColor: `rgb(var(--primary-50))`,
              border:          `1px solid rgb(var(--primary-200))`,
              color:           `rgb(var(--primary-700))`,
            }}
          >
            <CheckCircle2 size={17} className="shrink-0" />{successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 shadow-sm">
            <AlertCircle size={17} className="shrink-0" />{errorMsg}
          </div>
        )}

        {/* ── Password section ── */}
        {user?.must_change_password ? (
          <div
            className="bg-white rounded-2xl shadow p-6 space-y-5"
            style={{ border: `1px solid rgb(var(--primary-100))` }}
          >
            <SectionHeader
              icon={ShieldCheck}
              title="Set Your Password"
              subtitle="You need to set a new password before continuing."
            />
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl px-4 py-3 flex gap-2 items-start">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              This is your first login. Please set a secure password to protect your account.
            </div>
            <form onSubmit={handleFirstLogin} className="space-y-4">
              <PasswordInput
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                show={showNew}
                onToggle={() => setShowNew(!showNew)}
                placeholder="Enter new password"
              />
              <PasswordInput
                label="Confirm Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                show={showConfirm}
                onToggle={() => setShowConfirm(!showConfirm)}
                placeholder="Confirm new password"
              />
              <PrimaryBtn submitting={submitting} label="Set Password" busyLabel="Setting Password…" icon={KeyRound} />
            </form>
          </div>
        ) : (
          <div
            className="bg-white rounded-2xl shadow p-6 space-y-5"
            style={{ border: `1px solid rgb(var(--primary-100))` }}
          >
            <SectionHeader icon={Lock} title="Security" subtitle="Update your account password" />
            <form onSubmit={handleChangePassword} className="space-y-4">
              <PasswordInput
                label="Current Password"
                value={currentPassword}
                onChange={setCurrentPassword}
                show={showCurrent}
                onToggle={() => setShowCurrent(!showCurrent)}
                placeholder="Enter current password"
              />
              <PasswordInput
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                show={showNew}
                onToggle={() => setShowNew(!showNew)}
                placeholder="Enter new password"
              />
              <PasswordInput
                label="Confirm New Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                show={showConfirm}
                onToggle={() => setShowConfirm(!showConfirm)}
                placeholder="Confirm new password"
              />

              {/* Password strength indicator */}
              {newPassword.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((lvl) => {
                      const strength =
                        newPassword.length >= 12 &&
                        /[A-Z]/.test(newPassword) &&
                        /[0-9]/.test(newPassword) &&
                        /[^A-Za-z0-9]/.test(newPassword)
                          ? 4
                          : newPassword.length >= 10 && /[A-Z]/.test(newPassword)
                            ? 3
                            : newPassword.length >= 8
                              ? 2
                              : 1;
                      return (
                        <div
                          key={lvl}
                          className={`h-1.5 flex-1 rounded-full transition-all ${
                            lvl <= strength
                              ? strength === 1
                                ? "bg-red-400"
                                : strength === 2
                                  ? "bg-amber-400"
                                  : strength === 3
                                    ? "bg-blue-400"
                                    : ""
                              : "bg-gray-100"
                          }`}
                          style={
                            lvl <= strength && strength === 4
                              ? { backgroundColor: `rgb(var(--primary-500))` }
                              : {}
                          }
                        />
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400">
                    Use 8+ characters with uppercase, numbers, and symbols for a strong password.
                  </p>
                </div>
              )}

              <PrimaryBtn submitting={submitting} label="Update Password" busyLabel="Updating…" icon={ShieldCheck} />
            </form>
          </div>
        )}

        {/* ── Admin: Department Theme + Logo Settings ── */}
        {isAdmin && (
          <>
            {/* ── Theme Settings ── */}
            <div
              className="bg-white rounded-2xl shadow p-6 space-y-5"
              style={{ border: `1px solid rgb(var(--primary-100))` }}
            >
              <SectionHeader
                icon={Palette}
                title="Department Theme Settings"
                subtitle="Customize the color theme for each department"
              />

              <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 text-purple-700 text-xs rounded-xl px-4 py-2.5">
                <BadgeCheck size={14} className="shrink-0" />
                <span>This section is only visible to administrators.</span>
              </div>

              <form onSubmit={handleSaveTheme} className="space-y-4">

                {/* Department */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-600">Department</label>
                  <DeptSelect value={selectedDept} onChange={handleDeptChange} />
                </div>

                {/* ✅ Dynamic theme selector — Standard + Special groups */}
                <ThemeSelector
                  selectedTheme={selectedTheme}
                  onSelect={setSelectedTheme}
                  isAdmin={isAdmin}
                  selectedDept={selectedDept}
                />

                {/* Save */}
                <button
                  type="submit"
                  disabled={savingTheme || !selectedDept || loadingDepts}
                  className="w-full flex items-center justify-center gap-2 text-white font-semibold py-2.5 rounded-xl transition text-sm shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor:
                      savingTheme || !selectedDept || loadingDepts
                        ? `rgb(var(--primary-300))`
                        : `rgb(var(--primary-600))`,
                  }}
                  onMouseEnter={(e) => {
                    if (!savingTheme && selectedDept && !loadingDepts)
                      e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      savingTheme || !selectedDept || loadingDepts
                        ? `rgb(var(--primary-300))`
                        : `rgb(var(--primary-600))`;
                  }}
                >
                  {savingTheme
                    ? <><Loader2 size={16} className="animate-spin" />Saving Theme…</>
                    : <><Palette size={16} />Save Theme</>}
                </button>
              </form>
            </div>

            {/* ── Logo Settings ── */}
            <div
              className="bg-white rounded-2xl shadow p-6 space-y-5"
              style={{ border: `1px solid rgb(var(--primary-100))` }}
            >
              <SectionHeader
                icon={ImagePlus}
                title="Department Logo Settings"
                subtitle="Upload and manage logos displayed in the sidebar"
              />

              <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 text-purple-700 text-xs rounded-xl px-4 py-2.5">
                <BadgeCheck size={14} className="shrink-0" />
                <span>This section is only visible to administrators.</span>
              </div>

              {logoSuccess && (
                <div
                  className="flex items-center gap-2.5 text-sm rounded-xl px-4 py-3 shadow-sm"
                  style={{
                    backgroundColor: `rgb(var(--primary-50))`,
                    border:          `1px solid rgb(var(--primary-200))`,
                    color:           `rgb(var(--primary-700))`,
                  }}
                >
                  <CheckCircle size={17} className="shrink-0" />{logoSuccess}
                </div>
              )}
              {logoError && (
                <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 shadow-sm">
                  <AlertCircle size={17} className="shrink-0" />{logoError}
                </div>
              )}

              <form onSubmit={handleUploadLogo} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-600">Department</label>
                  <DeptSelect
                    value={logoDept}
                    onChange={(val) => {
                      setLogoDept(val);
                      setLogoError("");
                      setLogoSuccess("");
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-600">Logo File</label>
                  <LogoDropZone
                    preview={logoPreview}
                    onFileSelect={handleLogoFileSelect}
                    onClear={handleClearLogo}
                  />
                  {logoFile && (
                    <p className="text-xs text-gray-400 truncate pt-0.5">
                      Selected:{" "}
                      <span className="font-medium text-gray-600">{logoFile.name}</span>
                      {" "}({(logoFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={uploadingLogo || !logoDept || !logoFile}
                  className="w-full flex items-center justify-center gap-2 text-white font-semibold py-2.5 rounded-xl transition text-sm shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor:
                      uploadingLogo || !logoDept || !logoFile
                        ? `rgb(var(--primary-300))`
                        : `rgb(var(--primary-600))`,
                  }}
                  onMouseEnter={(e) => {
                    if (!uploadingLogo && logoDept && logoFile)
                      e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      uploadingLogo || !logoDept || !logoFile
                        ? `rgb(var(--primary-300))`
                        : `rgb(var(--primary-600))`;
                  }}
                >
                  {uploadingLogo
                    ? <><Loader2 size={16} className="animate-spin" />Uploading Logo…</>
                    : <><UploadCloud size={16} />Upload Logo</>}
                </button>
              </form>
            </div>
          </>
        )}

        {/* ── Account Info Card ── */}
        <div
          className="bg-white rounded-2xl shadow p-6 space-y-5"
          style={{ border: `1px solid rgb(var(--primary-100))` }}
        >
          <SectionHeader icon={User} title="Account Information" subtitle="Your profile details" />

          <div className="space-y-3">
            {[
              { icon: User, label: "Full Name",     value: user?.name  || "—" },
              { icon: Mail, label: "Email Address", value: user?.email || "—" },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{
                  backgroundColor: `rgb(var(--primary-50) / 0.6)`,
                  border:          `1px solid rgb(var(--primary-100))`,
                }}
              >
                <div
                  className="p-1.5 bg-white rounded-lg shadow-sm"
                  style={{ border: `1px solid rgb(var(--primary-100))` }}
                >
                  <Icon size={15} style={{ color: `rgb(var(--primary-600))` }} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className="text-sm font-semibold text-gray-800">{value}</p>
                </div>
              </div>
            ))}

            {/* Role row */}
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                backgroundColor: `rgb(var(--primary-50) / 0.6)`,
                border:          `1px solid rgb(var(--primary-100))`,
              }}
            >
              <div
                className="p-1.5 bg-white rounded-lg shadow-sm"
                style={{ border: `1px solid rgb(var(--primary-100))` }}
              >
                <BadgeCheck size={15} style={{ color: `rgb(var(--primary-600))` }} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Role</p>
                <span
                  className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border mt-0.5 ${badge.tw}`}
                  style={badge.inline ?? {}}
                >
                  {roleDisplay}
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">OJT Monitoring System · Settings</p>
      </div>
    </div>
  );
}