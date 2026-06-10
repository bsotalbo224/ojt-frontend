import { useEffect, useState, useCallback } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getNotifications, markAsRead } from "../../api/notifications";

const relativeTime = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const TABS = ["All", "Unread"];

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState("All");
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getNotifications();
      if (res.data?.success) setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  useEffect(() => {
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleAcademicYearChanged = () => {
      fetchNotifications();
    };
    window.addEventListener("academicYearChanged", handleAcademicYearChanged);
    return () => {
      window.removeEventListener("academicYearChanged", handleAcademicYearChanged);
    };
  }, [fetchNotifications]);

  const handleClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await markAsRead(notif.notif_id);
        setNotifications((prev) =>
          prev.map((n) => n.notif_id === notif.notif_id ? { ...n, is_read: 1 } : n)
        );
      }
      if (notif.type === "account_created") return;
      if (notif.link) navigate(notif.link);
    } catch (err) {
      console.error("Notification click error:", err);
    }
  };

  const displayed    = activeTab === "Unread" ? notifications.filter((n) => !n.is_read) : notifications;
  const unreadCount  = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">

      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `rgb(var(--primary-100))` }}
          >
            <Bell size={18} style={{ color: `rgb(var(--primary-600))` }} />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Notifications</h1>
          {unreadCount > 0 && (
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: `rgb(var(--primary-100))`,
                color:           `rgb(var(--primary-700))`,
              }}
            >
              {unreadCount} unread
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 ml-12">Stay up to date with your OJT activities.</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 pt-3">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-2.5 text-sm font-semibold transition-colors mr-1 ${
                activeTab === tab ? '' : 'text-gray-500 hover:text-gray-700'
              }`}
              style={activeTab === tab ? { color: `rgb(var(--primary-600))` } : {}}
            >
              {tab}
              {tab === "Unread" && unreadCount > 0 && (
                <span
                  className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `rgb(var(--primary-100))`,
                    color:           `rgb(var(--primary-700))`,
                  }}
                >
                  {unreadCount}
                </span>
              )}
              {activeTab === tab && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                  style={{ backgroundColor: `rgb(var(--primary-500))` }}
                />
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div
              className="w-8 h-8 rounded-full animate-spin"
              style={{
                border:         `2px solid rgb(var(--primary-500))`,
                borderTopColor: 'transparent',
              }}
            />
            <p className="text-sm text-gray-400">Loading notifications...</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `rgb(var(--primary-50))` }}
            >
              <CheckCheck size={24} style={{ color: `rgb(var(--primary-400))` }} />
            </div>
            <p className="text-base font-semibold text-gray-500">
              {activeTab === "Unread" ? "No unread notifications" : "No notifications yet"}
            </p>
            <p className="text-sm text-gray-400">
              {activeTab === "Unread" ? "You're all caught up!" : "Check back later."}
            </p>
          </div>
        ) : (
          <ul>
            {displayed.map((notif, idx) => (
              <li key={notif.notif_id} className={idx !== 0 ? "border-t border-gray-50" : ""}>
                <button
                  onClick={() => handleClick(notif)}
                  className="w-full text-left flex items-start gap-4 px-5 py-4 transition-colors"
                  style={{
                    borderLeft:      !notif.is_read ? `4px solid rgb(var(--primary-500))` : '4px solid transparent',
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = `rgb(var(--primary-50) / 0.6)`}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = !notif.is_read
                      ? `rgb(var(--primary-50) / 0.3)`
                      : 'transparent';
                  }}
                  ref={(el) => {
                    if (el && !notif.is_read) el.style.backgroundColor = `rgb(var(--primary-50) / 0.3)`;
                  }}
                >
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={
                      !notif.is_read
                        ? { backgroundColor: `rgb(var(--primary-100))` }
                        : { backgroundColor: '#f3f4f6' }
                    }
                  >
                    <Bell
                      size={16}
                      style={{ color: !notif.is_read ? `rgb(var(--primary-600))` : '#9ca3af' }}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm truncate ${!notif.is_read ? "font-semibold text-gray-800" : "font-medium text-gray-600"}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">
                        {relativeTime(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                  </div>

                  {/* Unread dot */}
                  {!notif.is_read && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0 mt-2"
                      style={{ backgroundColor: `rgb(var(--primary-500))` }}
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;