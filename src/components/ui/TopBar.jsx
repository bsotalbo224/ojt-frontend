import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Bell, User, Settings, LogOut, ChevronRight } from "lucide-react";
import { getNotifications, getUnreadCount, markAsRead } from "../../api/notifications";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import Avatar from "../ui/Avatar";
import AcademicYearSelector from "../ui/AcademicYearSelector";

const NOTIFICATION_EVENT = "notification:new";
const POLL_INTERVAL_MS = 15000; // fallback only — Socket.IO is the primary source

// Centralized frontend notification type constants. Must stay in sync with
// the backend's NotificationTypes — add new types here instead of
// hardcoding notification type strings throughout the component.
const NotificationTypes = Object.freeze({
  SYSTEM: "system",
  ACCOUNT: "account",
  ATTENDANCE: "attendance",
  DAILY_LOG: "daily_log",
  NARRATIVE: "narrative",
  FEEDBACK: "feedback",
  PROGRESS: "progress",
  PLACEMENT: "placement",
  CONSULTATION: "consultation",
  EVALUATION: "evaluation",
  REMINDER: "reminder",
});

const relativeTime = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const TopBar = ({ onMenuClick }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const notifOpenRef = useRef(notifOpen);
  // Tracks whether notifications have already been fetched during the
  // current session, so re-opening the dropdown doesn't refetch unless the
  // cache was explicitly invalidated (e.g. academic year change).
  const notificationsLoadedRef = useRef(false);

  const fullName = useMemo(
    () => `${user?.f_name || ""} ${user?.l_name || ""}`.trim(),
    [user?.f_name, user?.l_name]
  );

  const canSeeAcademicYear = user?.role === "admin" || user?.role === "coordinator";

  const safeNavigate = useCallback((path) => {
    if (!path) return;
    const role = user?.role;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    if (cleanPath.startsWith(`/${role}/`)) {
      navigate(cleanPath);
      return;
    }
    navigate(`/${role}${cleanPath}`);
  }, [user, navigate]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await getUnreadCount();
      if (res.data?.success) {
        setUnreadCount(res.data.count || 0);
      }
    } catch (err) {
      console.error("TopBar: failed to load unread notification count:", err);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      setNotifLoading(true);
      const res = await getNotifications();
      if (res.data?.success) {
        const unreadList = (res.data.notifications || []).filter((n) => !n.is_read);
        setNotifications(unreadList);
        notificationsLoadedRef.current = true;
      }
    } catch (err) {
      console.error("TopBar: failed to load notifications:", err);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  // Forces the next loadNotifications() call to hit the API again, e.g.
  // after an academic year change where cached notifications are stale.
  const invalidateNotificationsCache = useCallback(() => {
    notificationsLoadedRef.current = false;
  }, []);

  const handleIncomingNotification = useCallback((notification) => {
    if (!notification || !notification.notif_id) return;

    setNotifications((prev) => {
      if (prev.some((n) => n.notif_id === notification.notif_id)) {
        return prev;
      }
      return [notification, ...prev];
    });

    setUnreadCount((prev) => prev + 1);
  }, []);

  const markNotificationAsRead = useCallback(async (notifId) => {
    try {
      await markAsRead(notifId);
      setNotifications((prev) => prev.filter((n) => n.notif_id !== notifId));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      return true;
    } catch (err) {
      console.error("TopBar: failed to mark notification as read:", err);
      return false;
    }
  }, []);

  const handleNotificationClick = useCallback(async (notification) => {
    try {
      if (!notification.is_read) {
        await markNotificationAsRead(notification.notif_id);
      }

      setNotifOpen(false);

      if (notification.type === NotificationTypes.ACCOUNT) {
        return;
      }

      safeNavigate(notification.link || "/notifications");
    } catch (err) {
      console.error("TopBar: failed to handle notification click:", err);
    }
  }, [markNotificationAsRead, safeNavigate]);

  const closeAll = useCallback(() => {
    setNotifOpen(false);
    setProfileOpen(false);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("token");
    window.location.href = "/";
  }, []);

  const toggleNotif = useCallback(() => {
    setNotifOpen((prev) => {
      const opening = !prev;
      if (opening && !notificationsLoadedRef.current) {
        loadNotifications();
      }
      return opening;
    });
    setProfileOpen(false);
  }, [loadNotifications]);

  const toggleProfile = useCallback(() => {
    setProfileOpen((prev) => !prev);
    setNotifOpen(false);
  }, []);

  useEffect(() => {
    notifOpenRef.current = notifOpen;
  }, [notifOpen]);

  useEffect(() => {
    loadUnreadCount();
    const intervalId = setInterval(loadUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [loadUnreadCount]);

  useEffect(() => {
    const handleAcademicYearChanged = () => {
      loadUnreadCount();
      invalidateNotificationsCache();
      if (notifOpenRef.current) {
        loadNotifications();
      }
    };

    window.addEventListener("academicYearChanged", handleAcademicYearChanged);
    return () => {
      window.removeEventListener("academicYearChanged", handleAcademicYearChanged);
    };
  }, [loadUnreadCount, loadNotifications, invalidateNotificationsCache]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        closeAll();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeAll]);

  useEffect(() => {
    if (!socket) return undefined;

    socket.on(NOTIFICATION_EVENT, handleIncomingNotification);

    return () => {
      socket.off(NOTIFICATION_EVENT, handleIncomingNotification);
    };
  }, [socket, handleIncomingNotification]);

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">

        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            style={{ color: `rgb(var(--primary-text))` }}
            className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors md:hidden"
          >
            <Menu size={24} />
          </button>
        </div>

        <div className="flex items-center gap-2 md:gap-3">

          {/* Academic Year Selector — Admin and Coordinator only */}
          {canSeeAcademicYear && <AcademicYearSelector />}

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={toggleNotif}
              aria-expanded={notifOpen}
              aria-haspopup="true"
              className="relative p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Bell size={22} />
              {unreadCount > 0 && (
                <span
                  style={{ backgroundColor: `rgb(var(--primary))` }}
                  className="absolute top-1.5 right-1.5 min-w-4.5 h-4.5 px-1 text-[10px] flex items-center justify-center text-white rounded-full border-2 border-white"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-3 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-50"
              >
                <div
                  style={{ background: `linear-gradient(to right, rgb(var(--primary)), rgb(var(--primary-medium)))` }}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Bell size={15} className="text-white" />
                    <span className="text-sm font-semibold text-white">Notifications</span>
                  </div>
                  {unreadCount > 0 && (
                    <span
                      style={{ color: `rgb(var(--primary-text))` }}
                      className="bg-white text-xs font-bold px-2 py-0.5 rounded-full"
                    >
                      {unreadCount} new
                    </span>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto">
                  {notifLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <div
                        style={{ borderColor: `rgb(var(--primary-medium)) transparent transparent transparent` }}
                        className="w-6 h-6 border-2 rounded-full animate-spin"
                      />
                      <p className="text-xs text-gray-400">Loading...</p>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <div
                        style={{ backgroundColor: `rgb(var(--primary-light) / 0.2)` }}
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                      >
                        <Bell size={18} style={{ color: `rgb(var(--primary-light))` }} />
                      </div>
                      <p className="text-sm text-gray-400 font-medium">No new notifications</p>
                      <p className="text-xs text-gray-300">You're all caught up!</p>
                    </div>
                  ) : (
                    <ul>
                      {notifications.map((notif, idx) => (
                        <li key={notif.notif_id} className={idx !== 0 ? "border-t border-gray-50" : ""}>
                          <button
                            onClick={() => handleNotificationClick(notif)}
                            className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                          >
                            <span
                              style={{ backgroundColor: `rgb(var(--primary))` }}
                              className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{notif.title}</p>
                              <p className="text-xs text-gray-500 truncate mt-0.5">{notif.message}</p>
                              <p className="text-[10px] text-gray-400 mt-1">{relativeTime(notif.created_at)}</p>
                            </div>
                            <ChevronRight size={14} className="text-gray-300 shrink-0 mt-1" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border-t border-gray-50 px-4 py-2">
                  <button
                    onClick={() => { setNotifOpen(false); safeNavigate("/notifications"); }}
                    style={{ color: `rgb(var(--primary-text))` }}
                    className="w-full text-xs font-semibold hover:opacity-80 text-center py-1 transition-opacity"
                  >
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={toggleProfile}
              aria-expanded={profileOpen}
              aria-haspopup="true"
              style={{ borderColor: `rgb(var(--primary-light) / 0.4)` }}
              className="rounded-full border-2 transition-colors"
              onMouseEnter={e => e.currentTarget.style.borderColor = `rgb(var(--primary-light))`}
              onMouseLeave={e => e.currentTarget.style.borderColor = `rgb(var(--primary-light) / 0.4)`}
            >
              <Avatar name={fullName} src={user?.photo || ""} size="md" />
            </button>

            {profileOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-3 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-50"
              >
                <div
                  style={{ background: `linear-gradient(to right, rgb(var(--primary)), rgb(var(--primary-medium)))` }}
                  className="px-4 pt-4 pb-6 relative"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={fullName}
                      src={user?.photo || ""}
                      size="lg"
                      className="border-2 border-white/60 shadow-md"
                    />
                    <div className="overflow-hidden">
                      <p className="text-sm font-semibold text-white truncate">
                        {fullName || "User"}
                      </p>
                      <p className="text-xs text-white/70 truncate">{user?.email || ""}</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full" />
                  <div className="absolute -bottom-6 right-8 w-10 h-10 bg-white/10 rounded-full" />
                </div>

                <div className="py-2 px-2 mt-1">
                  <button
                    role="menuitem"
                    onClick={() => { closeAll(); safeNavigate("/profile"); }}
                    className="w-full px-3 py-2.5 hover:bg-gray-50 text-gray-700 text-sm flex items-center gap-3 rounded-xl transition-colors group"
                  >
                    <div
                      style={{ backgroundColor: `rgb(var(--primary-light) / 0.15)` }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                    >
                      <User size={15} style={{ color: `rgb(var(--primary-text))` }} />
                    </div>
                    <span className="font-medium">Profile</span>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => { closeAll(); safeNavigate("/settings"); }}
                    className="w-full px-3 py-2.5 hover:bg-gray-50 text-gray-700 text-sm flex items-center gap-3 rounded-xl transition-colors group"
                  >
                    <div
                      style={{ backgroundColor: `rgb(var(--primary-light) / 0.15)` }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                    >
                      <Settings size={15} style={{ color: `rgb(var(--primary-text))` }} />
                    </div>
                    <span className="font-medium">Settings</span>
                  </button>
                </div>

                <div className="border-t border-gray-100 px-2 py-2">
                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full px-3 py-2.5 hover:bg-red-50 text-gray-700 hover:text-red-600 text-sm flex items-center gap-3 rounded-xl transition-colors group"
                  >
                     <div className="w-8 h-8 rounded-lg bg-gray-50 group-hover:bg-red-100 flex items-center justify-center transition-colors">
                      <LogOut size={15} className="text-gray-400 group-hover:text-red-500 transition-colors" />
                    </div>
                    <span className="font-medium">Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default TopBar;