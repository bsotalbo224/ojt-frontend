import { useMemo } from "react";
import Avatar from "../ui/Avatar";

const BASE_URL = import.meta.env.VITE_BASE_URL;

const buildName = (c) =>
  [c?.f_name, c?.l_name].filter(Boolean).join(" ") || "Unknown";

const formatTime = (iso) => {
  if (!iso) return "";
  try {
    const date     = new Date(iso);
    const now      = new Date();
    const diffDays = Math.floor((now - date) / 86_400_000);
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7)  return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch { return ""; }
};

export default function ConversationList({
  conversations,
  selectedUser,
  onSelectUser,
  currentUserId,
  searchQuery = "",
  onSearchChange,
}) {
  const normalized = useMemo(() => {
    const list = conversations?.conversations || conversations || [];
    const arr = Array.isArray(list) ? list : [];
    return arr.map((c) => ({
      ...c,
      name: buildName(c),
      last_message: c?.last_message ?? "",
      last_message_time: c?.last_message_time ?? null,
      unread_count: c?.unread_count ?? 0,
    }));
  }, [conversations]);

  const filtered = useMemo(
    () => normalized.filter((c) =>
      (c.name || "").toLowerCase().includes((searchQuery ?? "").toLowerCase())
    ),
    [normalized, searchQuery]
  );

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">

      <div className="px-4 pt-5 pb-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `rgb(var(--primary-700))` }}
          >
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6M3 12c0-4.418 4.03-8 9-8s9 3.582 9 8-4.03 8-9 8a9.77 9.77 0 0 1-4-.832L3 20l1.09-3.27C3.4 15.56 3 13.82 3 12z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800 leading-tight tracking-tight">Student Consultations</h2>
            <p className="text-[10px] text-gray-400 leading-tight">OJT Monitoring System</p>
          </div>
        </div>

        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search students…"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-gray-200 bg-gray-50 placeholder-gray-400 text-gray-700 outline-none transition"
            onFocus={e => { e.target.style.boxShadow = `0 0 0 2px rgb(var(--primary-300))`; e.target.style.borderColor = 'transparent'; }}
            onBlur={e =>  { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#e5e7eb'; }}
          />
        </div>
      </div>

      <div className="px-4 pt-3 pb-1">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Active Threads</span>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="flex flex-col items-center justify-center h-32 gap-2 px-4">
            <svg className="w-8 h-8 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 0 1-4-.832L3 20l1.09-3.27C3.4 15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-xs text-center text-gray-400">
              {searchQuery ? "No students found" : "No consultations yet"}
            </p>
          </li>
        ) : (
          filtered.map((user) => {
            const isSelected = selectedUser?.user_id === user.user_id;
            const hasUnread  = (user.unread_count ?? 0) > 0;
            const fullName   = `${user.f_name ?? ""} ${user.l_name ?? ""}`.trim();

            return (
              <li key={user.user_id} className="border-b border-gray-50 last:border-0">
                <button
                  onClick={() => onSelectUser?.(user)}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left border-l-2 transition-all duration-150 ${
                    !isSelected ? "border-transparent hover:bg-gray-50 active:bg-gray-100" : ""
                  }`}
                  style={isSelected ? {
                    backgroundColor: `rgb(var(--primary-50))`,
                    borderLeftColor: `rgb(var(--primary-600))`,
                  } : {}}
                >
                  <div className="relative shrink-0 self-center">
                    <div
                      className="rounded-full transition-all duration-150"
                      style={isSelected ? {
                        outline:      `2px solid rgb(var(--primary-500))`,
                        outlineOffset: '1px',
                      } : {}}
                    >
                      <Avatar name={fullName} src={user.photo ? `${BASE_URL}${user.photo}` : ""} size="md" />
                    </div>
                    {hasUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`text-xs truncate leading-snug ${
                        hasUnread ? "font-bold text-gray-900" : isSelected ? "font-semibold text-gray-800" : "font-medium text-gray-700"
                      }`}>
                        {user.name}
                      </span>
                      <span className={`text-[10px] shrink-0 tabular-nums ${hasUnread ? "text-amber-500 font-semibold" : "text-gray-400"}`}>
                        {formatTime(user.last_message_time)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-[11px] truncate leading-snug ${hasUnread ? "text-gray-700 font-medium" : "text-gray-400 font-normal"}`}>
                        {user.last_message || (
                          <span className="italic text-gray-300">{user.role ? user.role : "No messages yet"}</span>
                        )}
                      </p>
                      {hasUnread && (
                        <span className="shrink-0 min-w-4.5 h-4.5 px-1 rounded-full bg-amber-400 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                          {user.unread_count > 99 ? "99+" : user.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}