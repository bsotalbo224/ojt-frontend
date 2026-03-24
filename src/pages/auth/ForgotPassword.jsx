import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Loader2, ArrowLeft, CheckCircle2, AlertCircle, KeyRound } from "lucide-react";
import api from "../../api/axios";

export default function ForgotPassword() {
  const [email,       setEmail]       = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [successMsg,  setSuccessMsg]  = useState("");
  const [errorMsg,    setErrorMsg]    = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");

    if (!email.trim()) {
      setErrorMsg("Please enter your email address.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSuccessMsg("Check your email! We've sent a password reset link.");
      setEmail("");
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.message ||
        "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-linear-to-br from-slate-50 via-white to-slate-100">
      <div className="w-full max-w-sm">

        {/* Icon badge */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-md border border-slate-100 flex items-center justify-center">
            <KeyRound size={26} className="text-slate-600" />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">

          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Forgot your password?</h1>
            <p className="text-sm text-slate-400 mt-1">
              Enter your email and we'll send you a reset link.
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
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-600">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={submitting || !!successMsg}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-slate-800 placeholder-slate-400 text-sm border border-slate-200 bg-slate-50/50 outline-none transition focus:border-transparent focus:ring-2 focus:ring-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !!successMsg}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition text-sm shadow-sm"
            >
              {submitting ? (
                <><Loader2 size={15} className="animate-spin" />Sending…</>
              ) : (
                <><Mail size={15} />Send Reset Link</>
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