import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ShieldCheck, ArrowLeft } from "lucide-react";
import api from "../../api/axios";

export default function ResetPassword() {
  const { token }    = useParams();
  const navigate     = useNavigate();

  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [successMsg,  setSuccessMsg]  = useState("");
  const [errorMsg,    setErrorMsg]    = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setSuccessMsg("Password reset successfully! Redirecting to login…");
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.message ||
        "Failed to reset password. The link may be invalid or expired."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Strength calculation
  const strength =
    password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password) ? 4
    : password.length >= 10 && /[A-Z]/.test(password) ? 3
    : password.length >= 6 ? 2
    : password.length > 0 ? 1
    : 0;

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "bg-red-400", "bg-amber-400", "bg-blue-400", "bg-green-500"][strength];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-linear-to-br from-slate-50 via-white to-slate-100">
      <div className="w-full max-w-sm">

        {/* Icon badge */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-md border border-slate-100 flex items-center justify-center">
            <ShieldCheck size={26} className="text-slate-600" />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">

          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Reset your password</h1>
            <p className="text-sm text-slate-400 mt-1">
              Choose a new password for your account.
            </p>
          </div>

          {/* Feedback */}
          {successMsg && (
            <div className="flex items-start gap-2.5 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-5">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-600">New Password</label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  disabled={submitting || !!successMsg}
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl text-slate-800 placeholder-slate-400 text-sm border border-slate-200 bg-slate-50/50 outline-none transition focus:border-transparent focus:ring-2 focus:ring-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Strength bar */}
              {password.length > 0 && (
                <div className="space-y-1 pt-0.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((lvl) => (
                      <div
                        key={lvl}
                        className={`h-1.5 flex-1 rounded-full transition-all ${
                          lvl <= strength ? strengthColor : "bg-slate-100"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    Strength:{" "}
                    <span className="font-semibold text-slate-600">{strengthLabel}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-600">Confirm Password</label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  disabled={submitting || !!successMsg}
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl text-slate-800 placeholder-slate-400 text-sm border border-slate-200 bg-slate-50/50 outline-none transition focus:border-transparent focus:ring-2 focus:ring-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Match indicator */}
              {confirm.length > 0 && (
                <p className={`text-xs font-medium flex items-center gap-1 ${
                  password === confirm ? "text-green-600" : "text-red-500"
                }`}>
                  {password === confirm
                    ? <><CheckCircle2 size={12} />Passwords match</>
                    : <><AlertCircle size={12} />Passwords do not match</>
                  }
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !!successMsg}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition text-sm shadow-sm mt-2"
            >
              {submitting ? (
                <><Loader2 size={15} className="animate-spin" />Resetting…</>
              ) : (
                <><ShieldCheck size={15} />Reset Password</>
              )}
            </button>
          </form>
        </div>

        {/* Back to login */}
        <div className="flex justify-center mt-5">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition font-medium"
          >
            <ArrowLeft size={14} />
            Back to Login
          </Link>
        </div>

      </div>
    </div>
  );
}