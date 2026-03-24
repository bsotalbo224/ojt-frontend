import { useState, useEffect } from "react";
import { Shield, Users, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ALL_CARDS = [
  {
    role: "admin",
    label: "Admin Dashboard",
    Icon: Shield,
    description: "Manage system configuration, users, and institutional settings.",
    tag: "System Administration",
    path: "/admin/dashboard",
  },
  {
    role: "coordinator",
    label: "Coordinator Dashboard",
    Icon: Users,
    description: "Monitor student OJT progress, review logs, narratives, and evaluations.",
    tag: "OJT Coordination",
    path: "/coordinator/dashboard",
  },
];

export default function DashboardSelect() {
  const navigate = useNavigate();
  const [selecting, setSelecting] = useState(null);
  const [mounted, setMounted]     = useState(false);
  const [cards, setCards]         = useState([]);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { navigate("/login", { replace: true }); return; }

    const user  = JSON.parse(raw);
    const roles = user?.roles || [];
    if (roles.length === 0) { navigate("/login", { replace: true }); return; }

    if (roles.length === 1) {
      const target = ALL_CARDS.find((c) => c.role === roles[0]);
      if (target) {
        localStorage.setItem("activeRole", roles[0]);
        navigate(target.path, { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
      return;
    }

    setCards(ALL_CARDS.filter((c) => roles.includes(c.role)));
    setTimeout(() => setMounted(true), 50); // entrance animation only
  }, [navigate]);

  // ── Role selection ─────────────────────────────────────────────────────────
  // All role-specific data already lives on the user object in localStorage
  // so no re-fetch is needed. Writing activeRole then dispatching "roleChanged"
  // is sufficient to trigger reactive updates in useTheme and MainLayout.
  const handleSelect = (role, path) => {
    setSelecting(role);
    localStorage.setItem("activeRole", role);

    // Dispatch BEFORE navigate so any already-mounted listeners (e.g. a
    // persistent MainLayout) react immediately. The new page's useTheme
    // will also apply correctly on mount via its own initial read.
    window.dispatchEvent(new Event("roleChanged"));

    navigate(path);
  };

  if (cards.length === 0) return null;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #e8f8f0 0%, #f0faf4 40%, #e6f7ee 100%)" }}
    >
      <div
        className={`bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <div className="px-10 pt-10 pb-8">

          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-md"
              style={{ background: "linear-gradient(145deg, #2db85a, #1a9e45)" }}
            >
              <span className="text-white text-3xl font-bold" style={{ fontFamily: "sans-serif" }}>
                T
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-widest" style={{ color: "#1fa84e" }}>
              TRACKTERN
            </h1>
            <p className="text-sm font-semibold tracking-wide mt-0.5" style={{ color: "#2db85a" }}>
              OJT Monitoring System
            </p>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-1">Select Dashboard</h2>
            <p className="text-sm text-slate-400">
              This account has multiple roles. Choose the dashboard you want to access.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {cards.map(({ role, label, Icon, description, tag, path }, i) => {
              const isSelecting = selecting === role;
              const isLoading   = selecting !== null;

              return (
                <button
                  key={role}
                  onClick={() => !isLoading && handleSelect(role, path)}
                  disabled={isLoading}
                  className={`
                    group w-full text-left rounded-2xl border-2 px-5 py-4
                    transition-all duration-300 outline-none
                    ${isLoading ? "cursor-not-allowed opacity-70" : "cursor-pointer"}
                    ${
                      isSelecting
                        ? "border-green-500 bg-green-50 scale-[0.98]"
                        : "border-slate-200 bg-slate-50 hover:border-green-400 hover:bg-green-50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-100"
                    }
                    ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
                  `}
                  style={{ transitionDelay: mounted ? `${200 + i * 100}ms` : "0ms" }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300
                        ${isSelecting ? "bg-green-500" : "bg-green-100 group-hover:bg-green-500"}
                      `}
                    >
                      <Icon
                        size={20}
                        strokeWidth={1.8}
                        className={`transition-colors duration-300 ${
                          isSelecting ? "text-white" : "text-green-600 group-hover:text-white"
                      }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold tracking-widest uppercase text-green-500 mb-0.5 opacity-70 group-hover:opacity-100">
                        {tag}
                      </p>
                      <p className="text-sm font-bold text-slate-700 group-hover:text-green-700 transition-colors duration-300">
                        {label}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        {description}
                      </p>
                    </div>

                    {!isLoading && (
                      <ArrowRight
                        size={16}
                        className="text-slate-300 group-hover:text-green-500 transition-all duration-300 group-hover:translate-x-1 shrink-0"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-100 px-10 py-4">
          <p className="text-center text-xs text-slate-400">
            © 2024 TRACKTERN. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}