import { useEffect, useState, useCallback, useRef } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getNotifications, markAsRead } from "../../api/notifications";
import socket from "../../socket";

const relativeTime = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const TABS = ["All", "Unread"];

// This page owns ONLY "notification:new" — the normal application
// notification system. It never listens for "message:new" or
// "receive_message" (the separate consultation/message system used by
// Sidebar.jsx/MessagePage.jsx/ChatWindow.jsx).
const NOTIFICATION_EVENT = "notification:new";

// Returns a comparable timestamp for a notification's created_at, or null
// if it's missing/unparseable. Never invents a value — callers treat null
// as "unknown," not as "oldest" or "newest."
const getCreatedAtTime = (n) => {
  if (!n?.created_at) return null;
  const t = new Date(n.created_at).getTime();
  return Number.isNaN(t) ? null : t;
};

// Orders notifications newest-first using the actual created_at field,
// not source (Socket.IO vs API vs local) as a recency proxy. Notifications
// with a missing/unparseable created_at are never assigned a fabricated
// timestamp; they simply sink after every notification with a known time,
// while keeping their existing relative order among themselves and among
// other unknown-time entries (Array.prototype.sort is stable), so nothing
// jumps around unpredictably from a value we don't actually have.
const sortByCreatedAtDesc = (list) => {
  return [...list].sort((a, b) => {
    const ta = getCreatedAtTime(a);
    const tb = getCreatedAtTime(b);
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return tb - ta;
  });
};

// Merges a fresh API response into current state without dropping a
// realtime notification the API response doesn't yet know about (e.g. a
// poll that started before "notification:new" arrived, and only resolves
// after). notif_id is the sole identity used, per the backend payload;
// anything in `previous` whose notif_id already appears in `incoming` is
// dropped in favor of the API's (authoritative, more complete) version of
// that same notification — this also covers case 20, where Socket.IO and
// API deliver the same notif_id with different representations. The
// combined list is then sorted by created_at so ordering reflects actual
// notification time rather than which source produced each entry.
const mergeNotificationLists = (previous, incoming) => {
  const incomingIds = new Set(
    incoming.filter((n) => n?.notif_id != null).map((n) => n.notif_id)
  );

  const onlyLocal = previous.filter(
    (n) => n?.notif_id != null && !incomingIds.has(n.notif_id)
  );

  return sortByCreatedAtDesc([...onlyLocal, ...incoming]);
};

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState("All");
  const navigate = useNavigate();

  // Distinguishes the true initial load from background refreshes (5s poll,
  // academicYearChanged) so those don't flash the full-list spinner over
  // already-visible notifications.
  const hasLoadedRef = useRef(false);

  // Monotonically increasing id per fetchNotifications() call. A response
  // only writes to state if it's still the most recently *issued* request
  // — the same "ignore stale response" pattern already used elsewhere in
  // this codebase (MessagePage.jsx's latestRequestIdRef). This guards
  // against an older, slower request overwriting a newer one regardless of
  // which happens to resolve first.
  const latestRequestIdRef = useRef(0);

  // True while any fetchNotifications() call is in flight. Used only to
  // stop the polling interval from firing a redundant, overlapping request
  // on top of one that's already running (e.g. a slow initial load still
  // pending when the first 5s tick fires). academicYearChanged is
  // deliberately NOT gated by this — a year change is meaningful new
  // intent that should still fire immediately; latestRequestIdRef above is
  // what keeps that safe even if it overlaps an existing in-flight fetch.
  const isFetchingRef = useRef(false);

  // notif_ids this client has itself confirmed read via a successful
  // markAsRead() call. Used to stop a stale GET response — one that was
  // in flight before that markAsRead() resolved, and therefore still
  // carries is_read: 0 — from reverting the notification back to unread
  // when merged. See the fetchNotifications patch step below.
  const locallyReadIdsRef = useRef(new Set());

  // Set false on unmount. A fetch that resolves after the component is
  // gone must not call setState — request-id checks alone don't cover
  // this, since a request can still be the "latest" at the moment
  // NotificationsPage unmounts.
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchNotifications = useCallback(async () => {
    const requestId = ++latestRequestIdRef.current;
    const isInitialLoad = !hasLoadedRef.current;
    isFetchingRef.current = true;

    try {
      if (isInitialLoad && isMountedRef.current) setLoading(true);

      const res = await getNotifications();

      // A newer request has been issued since this one started — discard
      // this response entirely rather than let older data overwrite
      // whatever the newer (possibly already-resolved) request wrote.
      if (requestId !== latestRequestIdRef.current) return;
      if (!isMountedRef.current) return;

      if (res.data?.success) {
        const fetched = res.data.notifications || [];

        // Never let a response older than a confirmed local read revert
        // that notification back to unread — only the is_read field is
        // touched; everything else from the API response is kept as-is.
        const patchedFetched = fetched.map((n) =>
          n?.notif_id != null && !n.is_read && locallyReadIdsRef.current.has(n.notif_id)
            ? { ...n, is_read: 1 }
            : n
        );

        // Merge instead of replace: prevents a realtime notification added
        // via handleIncomingNotification while this request was in flight
        // from being wiped out by a now-stale response that predates it.
        setNotifications((prev) => mergeNotificationLists(prev, patchedFetched));
      }
      // A missing/unsuccessful response body intentionally leaves
      // `notifications` untouched — no reason to clear a valid list over it.
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      // Preserve whatever is currently displayed; do not reset to [].
    } finally {
      if (requestId === latestRequestIdRef.current) {
        if (isInitialLoad) {
          if (isMountedRef.current) setLoading(false);
          hasLoadedRef.current = true;
        }
        isFetchingRef.current = false;
      }
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Fallback polling, preserved as-is. The API remains the source of truth
  // for persisted notifications — this keeps the list in sync even if a
  // socket event is missed (e.g. the shared socket wasn't connected yet,
  // see the reconnect/connection-lifecycle note below). Left at its
  // existing 5s interval rather than changed/removed: nothing in this
  // codebase's existing architecture demonstrates it's safe to widen or
  // drop, and the task calls for the smallest safe change here — only
  // TopBar.jsx/Sidebar.jsx (not modified by this change) were previously
  // established as having a documented poll-interval precedent.
  //
  // isFetchingRef guard: skips this tick if a fetch (initial, poll, or
  // academicYearChanged) is still in flight, so the interval can't pile a
  // redundant duplicate request on top of a slow one still running.
  useEffect(() => {
    const interval = setInterval(() => {
      if (isFetchingRef.current) return;
      fetchNotifications();
    }, 5000);
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

  // Handles a "notification:new" event from the existing shared socket
  // module (the same `import socket from "../../socket"` singleton already
  // used by Sidebar.jsx/MessagePage.jsx — no second connection, no new
  // context). Prepends the notification so it's visible immediately,
  // without waiting for the next poll.
  //
  // Dedup: notif_id is the only identifier used, per the backend payload.
  // If a notification with the same notif_id is already in state — because
  // fetchNotifications() (initial load, poll, or academicYearChanged) already
  // picked it up before this event arrived, or because the same event was
  // delivered twice (reconnect replay) — it's skipped rather than added
  // again. If notif_id is missing from the payload, no id is fabricated;
  // the notification is simply not added via the socket path (it will
  // still appear on the next successful fetchNotifications() poll once the
  // backend assigns/persists it, so nothing is silently lost — it's just
  // not shown instantly in that one edge case).
  const handleIncomingNotification = useCallback((notification) => {
    if (!notification || notification.notif_id == null) return;

    setNotifications((prev) => {
      if (prev.some((n) => n.notif_id === notification.notif_id)) {
        return prev;
      }
      return sortByCreatedAtDesc([notification, ...prev]);
    });
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    socket.on(NOTIFICATION_EVENT, handleIncomingNotification);

    return () => {
      socket.off(NOTIFICATION_EVENT, handleIncomingNotification);
    };
  }, [handleIncomingNotification]);

  const handleClick = async (notif) => {
    try {
      if (!notif.is_read) {
        const res = await markAsRead(notif.notif_id);

        // A thrown error already skips this block via the catch below.
        // This additionally covers an API that responds 200 with an
        // explicit success: false body (the same envelope shape
        // getNotifications() already checks above) — in that case the
        // request didn't actually fail, but it also didn't succeed, so
        // the UI must not claim the notification is read. If the
        // response has no success field at all, treat it as success, to
        // match this endpoint's previously-existing behavior.
        if (res?.data?.success === false) {
          console.error("markAsRead did not succeed:", res.data);
          return;
        }

        locallyReadIdsRef.current.add(notif.notif_id);
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