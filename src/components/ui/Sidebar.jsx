import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getNotifications } from "../../api/notifications";
import {
  LayoutDashboard,
  FileText,
  Calendar,
  FolderOpen,
  MessageSquare,
  Building,
  Building2,
  BookOpen,
  TrendingUp,
  Users,
  UserCog,
  BarChart3,
  Archive,
  LogOut,
  ClipboardCheck,
  ClipboardList,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  X,
} from "lucide-react";

const FALLBACK_LOGO  = "/images/spc-logo.png";
const BASE_URL = import.meta.env.VITE_BASE_URL;
const FALLBACK_LABEL = "San Pablo Colleges";

function resolveLogoUrl(logo) {
  if (!logo) return null;
  if (/^https?:\/\//i.test(logo)) return `${logo}?t=${Date.now()}`;
  if (logo.startsWith("/")) return `${BASE_URL}${logo}?t=${Date.now()}`;
  return `${BASE_URL}/uploads/departments/${logo}?t=${Date.now()}`;
}

function getBrandingData(user, activeRole) {
  if (!user) return { logoSrc: FALLBACK_LOGO, label: FALLBACK_LABEL };

  if (activeRole === "admin") return { logoSrc: FALLBACK_LOGO, label: "San Pablo Colleges" };

  const department = user.department;

  if (!department) {
    console.warn("[Sidebar] getBrandingData: user.department is missing for role", activeRole, "— falling back to defaults.", user);
    return { logoSrc: FALLBACK_LOGO, label: "Department" };
  }

  const logoSrc = resolveLogoUrl(department.logo) ?? FALLBACK_LOGO;
  return { logoSrc, label: department.name || "Department" };
}

function preloadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload  = () => resolve(url);
    img.onerror = () => resolve(FALLBACK_LOGO);
    img.src = url;
  });
}

const Sidebar = ({ role = "coordinator", user, isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeItem,    setActiveItem]    = useState(location.pathname);
  const [isCollapsed,   setIsCollapsed]   = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState({});
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [isMobile,      setIsMobile]      = useState(window.innerWidth < 768);

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : user;
    } catch {
      return user;
    }
  });

  const activeRole = currentUser?.role || role;

  const [logoSrc,     setLogoSrc]     = useState(() => localStorage.getItem("lastLogo")  || FALLBACK_LOGO);
  const [brandLabel,  setBrandLabel]  = useState(() => localStorage.getItem("lastLabel") || FALLBACK_LABEL);
  const [logoLoading, setLogoLoading] = useState(false);

  const getLatestUser = useCallback(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : user;
    } catch { return user; }
  }, [user]);

  const updateBranding = useCallback(async (latestUser) => {
    const resolvedRole = latestUser?.role || role;
    const { logoSrc: newSrc, label: newLabel } = getBrandingData(latestUser, resolvedRole);

    setBrandLabel(newLabel);
    localStorage.setItem("lastLabel", newLabel);

    setLogoSrc((prev) => {
      if (newSrc === prev) return prev;
      setLogoLoading(true);
      preloadImage(newSrc).then((resolved) => {
        setLogoSrc(resolved);
        setLogoLoading(false);
        localStorage.setItem("lastLogo", resolved);
      });
      return prev;
    });
  }, [role]);

  useEffect(() => {
    if (user) setCurrentUser(user);
  }, [user]);

  useEffect(() => {
    updateBranding(currentUser);
  }, [currentUser, updateBranding]);

  useEffect(() => {
    const handleUserUpdated = () => {
      const newUser = getLatestUser();
      setCurrentUser(newUser);
      updateBranding(newUser);
    };

    window.addEventListener("userUpdated", handleUserUpdated);
    return () => window.removeEventListener("userUpdated", handleUserUpdated);
  }, [getLatestUser, updateBranding]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => { loadUnread(); }, []);
  useEffect(() => {
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUnread = async () => {
    try {
      const res = await getNotifications();
      if (res.data.success) {
        const unread = res.data.notifications.filter((n) => !n.is_read).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error("Unread notif error:", err);
    }
  };

  useEffect(() => {
    setActiveItem(location.pathname);
    if (activeRole === "coordinator" && location.pathname.startsWith("/coordinator/reports/")) {
      setOpenDropdowns((prev) => ({ ...prev, reports: true }));
    }
  }, [location.pathname, activeRole]);

  const fullName =
    currentUser?.name ||
    `${currentUser?.f_name || ""} ${currentUser?.l_name || ""}`.trim() ||
    "User";

  const roleLabel =
    activeRole === "admin"       ? "Administrator" :
    activeRole === "coordinator" ? "Coordinator"   :
                                   "Student";

  const menuConfig = {
    student: [
      { path: "/student/dashboard",  label: "Dashboard",        icon: LayoutDashboard },
      { path: "/student/attendance", label: "Attendance (DTR)", icon: Calendar        },
      { path: "/student/logs",       label: "Daily Logs",       icon: FileText        },
      { path: "/student/narratives", label: "Narratives",       icon: FolderOpen      },
      { path: "/student/messages",   label: "Consultation",     icon: MessageSquare   },
      { path: "/student/progress",   label: "OJT Progress",     icon: TrendingUp      },
    ],
    admin: [
      { path: "/admin/dashboard",             label: "Dashboard",           icon: LayoutDashboard },
      { path: "/admin/students",              label: "Students",            icon: Users           },
      { path: "/admin/coordinators",          label: "Coordinators",        icon: UserCog         },
      { path: "/admin/departments",           label: "Departments",         icon: Building        },
      { path: "/admin/courses",               label: "Courses",             icon: BookOpen        },
      { path: "/admin/companies",             label: "Companies",           icon: Building2       },
      { path: "/admin/reports",               label: "Reports",             icon: BarChart3       },
      { path: "/admin/evaluation-templates",  label: "Evaluation",          icon: ClipboardCheck  },
    ],
    coordinator: [
      { path: "/coordinator/dashboard",  label: "Dashboard",             icon: LayoutDashboard },
      { path: "/coordinator/students",   label: "Students",              icon: Users           },
      { path: "/coordinator/messages",   label: "Consultation",          icon: MessageSquare   },
      { path: "/coordinator/daily-logs", label: "Daily Logs",            icon: FileText        },
      { path: "/coordinator/narratives", label: "Narratives",            icon: FileText        },
      { path: "/coordinator/attendance", label: "Attendance",            icon: Calendar        },
      { path: "/coordinator/responses",  label: "Evaluations Responses", icon: ClipboardList   },
    ],
  };

  const menuItems = menuConfig[activeRole] || [];

  const getInitials = (name) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("lastLogo");
    localStorage.removeItem("lastLabel");
    navigate("/", { replace: true });
  };

  const toggleDropdown = (key) =>
    setOpenDropdowns((prev) => ({ ...prev, [key]: !prev[key] }));

  const isParentActive = (item) => {
    if (!item.children) return activeItem === item.path;
    return activeItem === item.path || item.children.some((child) => activeItem === child.path);
  };

  const open           = isOpen ?? false;
  const sidebarWidth   = isMobile ? "w-72" : isCollapsed ? "w-20" : "w-72";
  const translateClass = isMobile ? (open ? "translate-x-0" : "-translate-x-full") : "translate-x-0";
  const showLabels     = isMobile ? true : !isCollapsed;

  return (
    <>
      {open && isMobile && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        style={{ background: "linear-gradient(180deg, rgb(var(--primary)) 0%, rgb(var(--primary-dark)) 100%)" }}
        className={`fixed md:relative top-0 left-0 h-screen z-999 transition-transform duration-300 ${sidebarWidth} ${translateClass} text-white flex flex-col`}
      >
        <div style={{ borderColor: "rgb(var(--primary-medium) / 0.5)" }} className="py-4 px-4 border-b">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-14 flex justify-center">
                <button
                  onClick={() => {
                    if (!isMobile) setIsCollapsed(!isCollapsed);
                    else setIsOpen(false);
                  }}
                  style={{ backgroundColor: "rgb(var(--primary-medium) / 0.5)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgb(var(--primary-medium))")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgb(var(--primary-medium) / 0.5)")}
                  className="text-white rounded-lg p-2 transition-all duration-200 hover:scale-110"
                >
                  {isMobile ? (
                    <X className="w-4 h-4" />
                  ) : isCollapsed ? (
                    <ChevronsRight className="w-4 h-4" />
                  ) : (
                    <ChevronsLeft className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className={`flex items-center ${showLabels ? "gap-3" : "justify-center"}`}>
              <div
                className={`shrink-0 flex items-center justify-center transition-all duration-300 ${
                  showLabels ? "w-14 h-14" : "w-12 h-12"
                }`}
              >
                <img
                  key={logoSrc}
                  src={logoSrc}
                  alt={brandLabel}
                  onError={() => setLogoSrc(FALLBACK_LOGO)}
                  className={`w-full h-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition-all duration-300 hover:scale-105 ${
                    logoLoading ? "opacity-0 scale-95" : "opacity-100 scale-100"
                  }`}
                />
              </div>

              {showLabels && (
                <h1
                  className={`text-base font-bold leading-tight text-left max-w-45 w-full transition-all duration-200 ${
                    logoLoading ? "opacity-0" : "opacity-100"
                  }`}
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                  }}
                >
                  {brandLabel}
                </h1>
              )}
            </div>
          </div>

          {showLabels && (
            <div className="flex items-center gap-3 mt-4 p-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <div
                style={{ background: "linear-gradient(to bottom right, rgb(var(--primary-light)), rgb(var(--primary-medium)))" }}
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shrink-0"
              >
                {getInitials(fullName)}
              </div>
              <div className="overflow-hidden">
                <p className="text-base font-bold truncate">{fullName}</p>
                <p className="text-xs text-white/90 capitalize font-medium">{roleLabel}</p>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon           = item.icon;
              const isActive       = isParentActive(item);
              const dropKey        = item.label.toLowerCase().replace(/\s+/g, "");
              const isDropdownOpen = openDropdowns[dropKey];

              return (
                <li key={item.path}>
                  <button
                    onClick={() => {
                      if (item.hasDropdown && activeRole === "coordinator") {
                        toggleDropdown(dropKey);
                        if (!showLabels) {
                          navigate(item.path, { replace: true });
                          setIsOpen(false);
                        }
                      } else {
                        navigate(item.path);
                        setIsOpen(false);
                      }
                    }}
                    style={isActive ? { color: "rgb(var(--primary-text))" } : {}}
                    className={`flex items-center w-full px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                      isActive
                        ? "bg-white shadow-lg"
                        : "text-white/90 hover:bg-white/10 hover:translate-x-1"
                    } ${!showLabels ? "justify-center" : ""}`}
                  >
                    <Icon className={`w-5 h-5 ${showLabels ? "mr-3" : ""}`} />
                    {showLabels && <span>{item.label}</span>}

                    {item.label === "Notifications" && unreadCount > 0 && !showLabels && (
                      <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] px-1.5 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                    {item.label === "Notifications" && unreadCount > 0 && showLabels && (
                      <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full shadow">
                        {unreadCount}
                      </span>
                    )}

                    {showLabels && item.hasDropdown && activeRole === "coordinator" && (
                      <ChevronDown
                        className={`w-4 h-4 ml-auto transition-transform duration-200 ${
                          isDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    )}
                    {showLabels && !item.hasDropdown && isActive && (
                      <div
                        style={{ backgroundColor: "rgb(var(--primary-text))" }}
                        className="ml-auto w-1.5 h-1.5 rounded-full"
                      />
                    )}
                  </button>

                  {item.hasDropdown && activeRole === "coordinator" && showLabels && (
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        isDropdownOpen ? "max-h-48 opacity-100 mt-1" : "max-h-0 opacity-0"
                      }`}
                    >
                      <ul className="space-y-1 ml-4 mt-1">
                        {item.children.map((child) => {
                          const isChildActive = activeItem === child.path;
                          return (
                            <li key={child.path}>
                              <button
                                onClick={() => {
                                  navigate(child.path);
                                  setIsOpen(false);
                                }}
                                className={`flex items-center w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                  isChildActive
                                    ? "bg-white/20 text-white shadow-md"
                                    : "text-white/80 hover:bg-white/10 hover:translate-x-1"
                                }`}
                              >
                                <div
                                  style={{ backgroundColor: "rgb(var(--primary-light))" }}
                                  className="w-1.5 h-1.5 rounded-full mr-3"
                                />
                                <span>{child.label}</span>
                                {isChildActive && (
                                  <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div style={{ borderColor: "rgb(var(--primary-medium) / 0.5)" }} className="p-4 border-t">
          <button
            onClick={handleLogout}
            className={`flex items-center w-full px-4 py-3.5 text-sm font-medium text-white/90 hover:bg-red-500/20 hover:text-red-200 rounded-xl transition-all duration-200 ${
              !showLabels ? "justify-center" : ""
            }`}
          >
            <LogOut className="w-5 h-5" />
            {showLabels && <span className="ml-3">Logout</span>}
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;