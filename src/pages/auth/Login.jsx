import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (error) setError("");
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (error) setError("");
  };

  const submitHandler = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const result = await login(email.trim(), password);

      if (!result || !result.success) {
        setError(result?.message || "Invalid email or password");
        setLoading(false);
        return;
      }

      const user = result.user;
      const role = user.role;

      if (user.must_change_password) {
        navigate("/first-password-change", { replace: true });
        return;
      }

      if (role === "student") {
        navigate("/student/dashboard", { replace: true });
        return;
      }

      if (role === "coordinator") {
        navigate("/coordinator/dashboard", { replace: true });
        return;
      }

      if (role === "admin") {
        navigate("/admin/dashboard", { replace: true });
        return;
      }
    } catch (err) {
      setError(err.message || "Invalid email or password");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-100 px-4 py-8 relative overflow-hidden">

      <div className="absolute top-0 left-0 w-96 h-96 bg-green-300/20 rounded-full blur-3xl opacity-20 -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-400/20 rounded-full blur-3xl opacity-20 translate-x-1/2 translate-y-1/2" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/90 backdrop-blur-lg shadow-2xl rounded-3xl overflow-hidden border border-green-200">

          <div className="px-8 pt-8 pb-4 text-center">
            <div className="flex justify-center mb-0">
              <img
                src="/images/Tracktern.png"
                alt="Tracktern Logo"
                className="w-35 h-35 object-contain drop-shadow-lg hover:scale-105 transition-transform"
              />
            </div>

            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-green-700 to-green-600 mb-1">
              TRACKTERN
            </h1>
            <p className="text-green-600 text-sm font-semibold">
              OJT Monitoring System
            </p>
          </div>

          <form onSubmit={submitHandler} className="px-8 pt-5 pb-10">

            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                Welcome Back
              </h2>
              <p className="text-gray-500 text-sm">
                Sign in to continue to your dashboard
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            <div className="mb-5">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-100 transition-all text-gray-800 placeholder:text-gray-400"
                  placeholder="Enter your email"
                  value={email}
                  onChange={handleEmailChange}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-100 transition-all text-gray-800 placeholder:text-gray-400"
                  placeholder="Enter your password"
                  value={password}
                  onChange={handlePasswordChange}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end mb-6">
              <Link
                to="/forgot-password"
                className="text-sm text-green-600 hover:text-green-800 font-semibold transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-linear-to-r from-green-600 to-green-700 text-white font-bold py-4 rounded-2xl hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Logging in...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </button>

          </form>

          <div className="bg-linear-to-r from-green-100 to-green-200/50 px-8 py-5 text-center border-t border-green-200">
            <p className="text-xs text-gray-600 font-medium">
              © 2026 TRACKTERN. All rights reserved.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}