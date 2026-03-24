import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import api from "../../api/axios";

export default function FirstPasswordChange() {
  const navigate = useNavigate();

  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [successMsg,      setSuccessMsg]      = useState("");
  const [errorMsg,        setErrorMsg]        = useState("");

  // Read user from localStorage (same pattern as the rest of your app)
  const user       = JSON.parse(localStorage.getItem("user") || "{}");
  const activeRole = localStorage.getItem("activeRole") || user?.role || (user?.roles?.[0]);

  const redirectToDashboard = (role) => {
    switch (role) {
      case "student":     return navigate("/student/dashboard",     { replace: true });
      case "coordinator": return navigate("/coordinator/dashboard", { replace: true });
      case "admin":       return navigate("/admin/dashboard",       { replace: true });
      default:            return navigate("/",                      { replace: true });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.put("/auth/change-password-first", { new_password: newPassword });

      // Update the stored user so must_change_password is no longer true
      const updatedUser = { ...user, must_change_password: false };
      localStorage.setItem("user", JSON.stringify(updatedUser));

      setSuccessMsg("Password set! Redirecting to your dashboard…");

      // Multi-role users go to dashboard selector, single role goes directly
      const roles       = user?.roles || (user?.role ? [user.role] : []);
      const isMultiRole = roles.length > 1;

      setTimeout(() => {
        if (isMultiRole) {
          navigate("/dashboard-select", { replace: true });
        } else {
          redirectToDashboard(activeRole);
        }
      }, 1500);
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.message ||
        "Failed to set password. Please try again."
      );
      setSubmitting(false);
    }
  };

  // Strength calculation
  const strength =
    newPassword.length >= 12 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword) ? 4
    : newPassword.length >= 10 && /[A-Z]/.test(newPassword) ? 3
    : newPassword.length >= 6 ? 2
    : newPassword.length > 0 ? 1
    : 0;

  const strengthMeta = [
    null,
    { label: "Weak",   bar: "bg-red-400"    },
    { label: "Fair",   bar: "bg-amber-400"  },
    { label: "Good",   bar: "bg-blue-400"   },
    { label: "Strong", bar: "bg-green-500"  },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-green-50 via-white to-green-50 px-4 py-8 relative overflow-hidden">

      {/* Background blobs — matches Login.jsx */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-green-200 rounded-full blur-3xl opacity-20 -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-300 rounded-full blur-3xl opacity-20 translate-x-1/2 translate-y-1/2" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/80 backdrop-blur-lg shadow-2xl rounded-3xl overflow-hidden border border-green-100">

          {/* Header */}
          <div className="px-8 py-10 text-center">
            <div className="w-24 h-24 bg-linear-to-br from-green-600 to-green-700 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xl">
              <div className="text-5xl font-black text-white">T</div>
            </div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-green-700 to-green-600 mb-2">
              TRACKTERN
            </h1>
            <p className="text-green-600 text-sm font-semibold">
              OJT Monitoring System
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-10">

            <div className="mb-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 mb-4">
                <ShieldCheck className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">Set Your Password</h2>
              <p className="text-gray-500 text-sm">
                This is your first login. Please set a secure password to continue.
              </p>
            </div>

            {/* Notice banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-6 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 font-medium">
                You must set a new password before accessing your dashboard.
              </p>
            </div>

            {/* Feedback */}
            {successMsg && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <p className="text-sm text-green-700 font-medium">{successMsg}</p>
              </div>
            )}
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 font-medium">{errorMsg}</p>
              </div>
            )}

            {/* New Password */}
            <div className="mb-5">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  disabled={submitting || !!successMsg}
                  className="w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-100 transition-all text-gray-800 placeholder:text-gray-400 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Strength bar */}
              {newPassword.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((lvl) => (
                      <div
                        key={lvl}
                        className={`h-1.5 flex-1 rounded-full transition-all ${
                          lvl <= strength ? strengthMeta[strength].bar : "bg-gray-100"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">
                    Strength:{" "}
                    <span className="font-semibold text-gray-600">
                      {strengthMeta[strength]?.label}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  disabled={submitting || !!successMsg}
                  className="w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-100 transition-all text-gray-800 placeholder:text-gray-400 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Match indicator */}
              {confirmPassword.length > 0 && (
                <p className={`mt-1.5 text-xs font-medium flex items-center gap-1 ${
                  newPassword === confirmPassword ? "text-green-600" : "text-red-500"
                }`}>
                  {newPassword === confirmPassword
                    ? <><CheckCircle2 className="w-3 h-3" />Passwords match</>
                    : <><AlertCircle className="w-3 h-3" />Passwords do not match</>
                  }
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !!successMsg}
              className="w-full bg-linear-to-r from-green-600 to-green-700 text-white font-bold py-4 rounded-2xl hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
            >
              {submitting ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Setting Password…</span>
                </div>
              ) : (
                "Set Password & Continue"
              )}
            </button>

          </form>

          {/* Footer */}
          <div className="bg-linear-to-r from-green-50 to-green-100/50 px-8 py-5 text-center border-t border-green-100">
            <p className="text-xs text-gray-600 font-medium">
              © 2026 TRACKTERN. All rights reserved.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}