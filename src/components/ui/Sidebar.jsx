import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getConversations } from "../../api/message";
import socket from "../../socket";
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

// Sidebar owns ONLY the Consultation unread badge. All system notifications
// (attendance, daily log, narrative, evaluation, placement, progress,
// feedback, reminder, system) are handled exclusively by TopBar's
// notification bell — this component never touches the notifications API.
//
// Event name confirmed against MessagesPage.jsx/ChatWindow.jsx: the app
// broadcasts new messages as "receive_message" (not "message:new"). There
// is no Socket.IO event for read-state changes -- reading a conversation
// happens via a plain REST call (PUT /messages/conversations/:id/read).
// MessagesPage.jsx bridges that gap with a "conversationRead" window
// CustomEvent, dispatched only once that REST call succeeds -- see the
// listener below. Polling + the visibility-change refresh remain in place
// purely as a fallback safety net (e.g. reads that happen from some other
// tab/device), not as the primary read-state sync path anymore.
const MESSAGE_EVENT_NEW = "receive_message";
const MESSAGE_POLL_INTERVAL_MS = 30000; // fallback only — Socket.IO/events are primary
const ACTIVE_CONVERSATION_EVENT = "activeConversationChanged";
const CONVERSATION_READ_EVENT = "conversationRead";

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

// Renders the unread consultation badge. Identical markup/styling to the
// original inline collapsed/expanded blocks — extracted only to remove
// duplication, not to change appearance or behavior. Returns null when
// there's nothing to show (count === null), so callers never render an
// empty badge.
const UnreadBadge = ({ count, collapsed }) => {
  if (count === null || count === undefined) return null;

  if (collapsed) {
    return (
      <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] px-1.5 rounded-full">
        {count}
      </span>
    );
  }

  return (
    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full shadow">
      {count}
    </span>
  );
};

const Sidebar = ({ role = "coordinator", user, isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeItem,    setActiveItem]    = useState(location.pathname);
  const [isCollapsed,   setIsCollapsed]   = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState({});
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
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

  // Sums unread_count across every conversation returned by the messaging
  // API — the same shape already used to render conversation previews, so
  // no new backend endpoint is introduced here. Always clamped to >= 0.
  // This is the single source of truth for messageUnreadCount: every path
  // that resyncs the badge (initial load, polling, visibility change, and
  // the conversationRead listener below) calls this and REPLACES the
  // count wholesale from the DB, rather than adjusting it by hand — so a
  // conversation with 5 unread messages correctly drops the total by 5,
  // not 1, the moment it's opened and read.
  const loadMessageUnreadCount = useCallback(async () => {
    try {
      const res = await getConversations();
      if (res.data?.success) {
        const conversations = res.data.conversations || [];
        const total = conversations.reduce(
          (sum, conversation) => sum + (conversation.unread_count || 0),
          0
        );
        setMessageUnreadCount(Math.max(0, total));
      }
    } catch (err) {
      console.error("[Sidebar] Failed to load consultation unread count:", err);
    }
  }, []);

  useEffect(() => {
    loadMessageUnreadCount();
    const intervalId = setInterval(loadMessageUnreadCount, MESSAGE_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [loadMessageUnreadCount]);

  // Refresh once whenever the tab regains focus/visibility, so a badge
  // left stale while the tab was backgrounded catches up immediately
  // without increasing the polling frequency.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadMessageUnreadCount();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadMessageUnreadCount]);

  // Fires when MessagesPage.jsx successfully marks a conversation as read
  // (PUT /messages/conversations/:id/read already confirmed by the
  // server -- see the dispatch site in MessagesPage.jsx's markRead()).
  // Deliberately a SEPARATE event from "activeConversationChanged": that
  // one only tracks which conversation is currently open/selected, and
  // fires on selection changes that have nothing to do with the DB read
  // state (e.g. selecting a brand-new, still-unread conversation). Mixing
  // the two would either clear the badge too early (before the read API
  // call actually succeeds) or miss updates from a conversation that was
  // read without ever becoming "active" in this tab. Calling
  // loadMessageUnreadCount() here re-fetches the DB-authoritative total
  // rather than decrementing a local counter, so multiple unread messages
  // in the just-read conversation are all accounted for correctly.
  useEffect(() => {
    const handleConversationRead = () => {
      loadMessageUnreadCount();
    };

    window.addEventListener(CONVERSATION_READ_EVENT, handleConversationRead);
    return () => {
      window.removeEventListener(CONVERSATION_READ_EVENT, handleConversationRead);
    };
  }, [loadMessageUnreadCount]);

  // Tracks the conversation id currently open in MessagePage.jsx, sourced
  // from the "activeConversationChanged" window event MessagePage.jsx
  // dispatches whenever its selectedConversation state changes (including
  // A -> B and back to null via handleBack/unmount). A ref, not state,
  // since it's only read inside the socket handler below and shouldn't
  // itself trigger re-renders.
  const activeConversationIdRef = useRef(null);

  // message_ids already counted toward messageUnreadCount, so a duplicate
  // "receive_message" delivery for the same message can never increment
  // twice. Unbounded for the component's lifetime — acceptable here since
  // it only ever stores small integer/string ids, unlike ChatWindow's
  // equivalent set which is cleared per-conversation on identity change.
  const countedMessageIdsRef = useRef(new Set());

  useEffect(() => {
    const handleActiveConversationChanged = (event) => {
      activeConversationIdRef.current = event?.detail?.conversationId ?? null;
    };

    window.addEventListener(ACTIVE_CONVERSATION_EVENT, handleActiveConversationChanged);
    return () => {
      window.removeEventListener(ACTIVE_CONVERSATION_EVENT, handleActiveConversationChanged);
    };
  }, []);

  // Handles a "receive_message" event (confirmed field names: sender_id,
  // conversation_id — see MessagesPage.jsx's own handleReceiveMessage and
  // ChatWindow.jsx's onReceive, both of which read the same two fields):
  //   - payload missing a conversation id -> don't guess, resync instead
  //   - already counted (see countedMessageIdsRef below) -> skip, avoids
  //     double-counting a message delivered more than once over the socket
  //     (reconnect replay, multi-room delivery, etc.) — mirrors the same
  //     guard ChatWindow.jsx already uses for its own unread tracking
  //   - sent by the current user          -> never unread for them
  //   - belongs to the conversation currently open in MessagePage.jsx
  //     (activeConversationIdRef.current) -> already being seen, skip
  //   - anything else                     -> genuinely unread, +1
  //
  // NOTE: the optimistic +1 below is intentionally never additive with
  // loadMessageUnreadCount()'s poll/visibility/conversationRead refresh --
  // those paths always *replace* messageUnreadCount with the DB-computed
  // total rather than adding to it, so it can only resync to ground
  // truth, never compound.
  const handleIncomingMessage = useCallback((message) => {
    if (!message) return;

    if (message.conversation_id === undefined || message.conversation_id === null) {
      loadMessageUnreadCount();
      return;
    }

    if (message.message_id != null) {
      if (countedMessageIdsRef.current.has(message.message_id)) return;
      countedMessageIdsRef.current.add(message.message_id);
    }

    if (currentUser?.user_id && String(message.sender_id) === String(currentUser.user_id)) {
      return;
    }

    const activeConversationId = activeConversationIdRef.current;
    if (
      activeConversationId !== null &&
      String(message.conversation_id) === String(activeConversationId)
    ) {
      return;
    }

    setMessageUnreadCount((prev) => Math.max(0, prev + 1));
  }, [currentUser?.user_id, loadMessageUnreadCount]);

  useEffect(() => {
    if (!socket) return undefined;

    socket.on(MESSAGE_EVENT_NEW, handleIncomingMessage);

    return () => {
      socket.off(MESSAGE_EVENT_NEW, handleIncomingMessage);
    };
  }, [handleIncomingMessage]);

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

  // Static menu definitions — recreated only if this component ever needs
  // to vary them by a prop/state dependency (none today), so the empty
  // dependency array is intentional.
  const menuConfig = useMemo(() => ({
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
      { path: "/coordinator/companies",  label:  "Companies",            icon: Building2       },
      { path: "/coordinator/daily-logs", label: "Daily Logs",            icon: FileText        },
      { path: "/coordinator/narratives", label: "Narratives",            icon: FileText        },
      { path: "/coordinator/attendance", label: "Attendance",            icon: Calendar        },
      { path: "/coordinator/evaluation",  label: "Evaluation", icon: ClipboardList   },
    ],
  }), []);

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
              const isConsultation = item.label === "Consultation";
              const displayUnread  = isConsultation && messageUnreadCount > 0
                ? (messageUnreadCount > 99 ? "99+" : messageUnreadCount)
                : null;

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

                    <UnreadBadge count={displayUnread} collapsed={!showLabels} />

                    {showLabels && item.hasDropdown && activeRole === "coordinator" && (
                      <ChevronDown
                        className={`w-4 h-4 ml-auto transition-transform duration-200 ${
                          isDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    )}
                    {showLabels && !item.hasDropdown && !isConsultation && isActive && (
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