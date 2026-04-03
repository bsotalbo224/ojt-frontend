import { useEffect, useRef, useState, useCallback } from "react";
import { Check, CheckCheck, ArrowLeft, BookOpen, FileText, ScrollText } from "lucide-react";
import Avatar from "../ui/Avatar";
import MessageInput from "./MessageInput";



// ─── Helpers ──────────────────────────────────────────────────────────────────

const getFullName = (user = {}) => {
  if (user.f_name || user.l_name) return `${user.f_name ?? ""} ${user.l_name ?? ""}`.trim();
  return user.name || "Unknown";
};

const resolveTimestamp = (item) => item?.created_at || item?.sent_at || null;

function formatTime(ts) {
  if (!ts) return "";
  try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

function formatDateLabel(ts) {
  if (!ts) return "";
  try {
    const d         = new Date(ts);
    const today     = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString())     return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

function groupMessagesByDate(messages) {
  const groups = [];
  let lastLabel = null;
  for (const msg of messages) {
    const ts    = resolveTimestamp(msg);
    const label = formatDateLabel(ts);
    if (label && label !== lastLabel) {
      groups.push({ type: "date-label", label, id: `date-${ts}-${msg.message_id ?? msg.tempId}` });
      lastLabel = label;
    }
    groups.push({ type: "message", ...msg });
  }
  return groups;
}

function resolveCurrentUserId(propUserId) {
  if (propUserId != null) return propUserId;
  try {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored)?.user_id ?? null : null;
  } catch { return null; }
}

function getTimeDiffMinutes(ts1, ts2) {
  if (!ts1 || !ts2) return Infinity;
  try { return Math.abs(new Date(ts2) - new Date(ts1)) / 60000; }
  catch { return Infinity; }
}

function buildGroupingMap(rawMessages) {
  const normal = rawMessages.filter(
    (msg) => msg.message_type !== "system" && msg.type !== "system" && !msg.is_system
  );
  const map = new Map();
  for (let i = 0; i < normal.length; i++) {
    const cur  = normal[i];
    const prev = normal[i - 1];
    const next = normal[i + 1];
    const sameSenderAsPrev = prev && prev.sender_id === cur.sender_id && getTimeDiffMinutes(resolveTimestamp(prev), resolveTimestamp(cur)) < 5;
    const sameSenderAsNext = next && next.sender_id === cur.sender_id && getTimeDiffMinutes(resolveTimestamp(cur), resolveTimestamp(next)) < 5;
    map.set(cur.message_id ?? cur.tempId, { isGroupStart: !sameSenderAsPrev, isGroupEnd: !sameSenderAsNext });
  }
  return map;
}

// ─── TypingDots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <span className="inline-flex items-end gap-0.75 h-3 ml-0.5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-1 h-1 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${delay}ms`, animationDuration: "900ms" }}
        />
      ))}
    </span>
  );
}

// ─── TypingIndicator ──────────────────────────────────────────────────────────
function TypingIndicator({ name }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-2xl rounded-bl-sm shadow-sm">
        <span className="text-[11px] text-gray-400 font-medium leading-none">{name} is typing</span>
        <TypingDots />
      </div>
    </div>
  );
}

// ─── SystemMessageCard ────────────────────────────────────────────────────────
function SystemMessageCard({ item }) {
  const isLog       = !!item.related_log_id;
  const isNarrative = !!item.related_narrative_id;
  const Icon        = isNarrative ? ScrollText : FileText;
  const label       = isNarrative ? "Narrative Entry" : isLog ? "Daily Log" : null;
  const idMatch     = item.message?.match(/#(\d+)/);
  const refId       = idMatch ? `#${idMatch[1]}` : null;

  return (
    <div className="flex justify-center my-6 px-2">
      <div
        className="w-full max-w-xs bg-white rounded-2xl shadow-sm overflow-hidden"
        style={{ border: `1px solid rgb(var(--primary-100))` }}
      >
        {/* Accent bar */}
        <div
          className="h-1 w-full"
          style={{ background: `linear-gradient(to right, rgb(var(--primary-500)), rgb(var(--primary-400)))` }}
        />
        <div className="px-4 py-3 flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}
          >
            <Icon className="w-4 h-4" style={{ color: `rgb(var(--primary-700))` }} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
              style={{ color: `rgb(var(--primary-600))` }}
            >
              Discussion Topic
            </p>
            {label && refId ? (
              <>
                <p className="text-xs font-semibold text-gray-800">{label} {refId}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed line-clamp-2">{item.message}</p>
              </>
            ) : (
              <p className="text-xs text-gray-600 leading-relaxed">{item.message}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubble({ item, isSent, isGroupStart, isGroupEnd, selectedUser, selectedName }) {
  const ts = resolveTimestamp(item);

  const sentCorners = ["rounded-2xl", !isGroupStart && "rounded-tr-md", !isGroupEnd && "rounded-br-md"].filter(Boolean).join(" ");
  const recvCorners = ["rounded-2xl", !isGroupStart && "rounded-tl-md", !isGroupEnd && "rounded-bl-md"].filter(Boolean).join(" ");

  return (
    <div className={`flex gap-2 items-end ${isSent ? "flex-row-reverse" : "flex-row"} ${isGroupStart ? "mt-3" : "mt-1"}`}>
      {!isSent && (
        <div className="shrink-0 w-7 self-end mb-1">
          {isGroupEnd ? (
            <Avatar name={selectedName} src={selectedUser.photo} size="sm" />
          ) : (
            <div className="w-7 h-7" />
          )}
        </div>
      )}

      <div className={`flex flex-col gap-0.5 max-w-[75%] sm:max-w-[70%] md:max-w-[60%] ${isSent ? "items-end" : "items-start"}`}>
        <div
          className={`px-4 py-2.5 text-xs leading-relaxed shadow-sm ${isSent ? sentCorners : `bg-white border border-gray-200 text-gray-800 ${recvCorners}`}`}
          style={isSent ? { backgroundColor: `rgb(var(--primary-700))`, color: 'white' } : {}}
        >
          {item.message}
        </div>

        {isGroupEnd && (
          <div className={`flex items-center gap-1 px-1 ${isSent ? "flex-row-reverse" : "flex-row"}`}>
            <span className="text-[10px] text-gray-400">{formatTime(ts)}</span>
            {isSent && (
              <span className="opacity-80">
                {item.is_read ? (
                  <CheckCheck className="w-3 h-3" style={{ color: `rgb(var(--primary-500))` }} />
                ) : item.delivered ? (
                  <CheckCheck className="w-3 h-3 text-gray-400" />
                ) : (
                  <Check className="w-3 h-3 text-gray-400" />
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ChatWindow ───────────────────────────────────────────────────────────────
export default function ChatWindow({
  selectedUser,
  messages,
  currentUserId,
  onSend,
  loading,
  onBack,
  socket,
  isOnline = false,
}) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const userId    = resolveCurrentUserId(currentUserId);

  const safeMessages = Array.isArray(messages) ? messages : [];
  const [localMessages, setMessages] = useState(safeMessages);
  const [isTyping, setIsTyping]      = useState(false);

  useEffect(() => { setMessages(safeMessages); }, [messages]); // eslint-disable-line

  const scrollToBottom = useCallback((force = false) => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (force || distanceFromBottom < 100) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); },                               [localMessages, scrollToBottom]);
  useEffect(() => { scrollToBottom(true); setIsTyping(false); },       [selectedUser?.user_id, scrollToBottom]);
  useEffect(() => { if (isTyping) scrollToBottom(); },                 [isTyping, scrollToBottom]);

  useEffect(() => {
    if (!socket || !selectedUser) return;
    const onTyping     = (uid) => { if (uid === selectedUser.user_id) setIsTyping(true);  };
    const onStopTyping = (uid) => { if (uid === selectedUser.user_id) setIsTyping(false); };
    socket.on("typing",      onTyping);
    socket.on("stop_typing", onStopTyping);
    return () => { socket.off("typing", onTyping); socket.off("stop_typing", onStopTyping); };
  }, [socket, selectedUser]);

  useEffect(() => {
    if (!socket) return;
    const onDelivered = ({ messageId }) => setMessages((p) => p.map((m) => m.message_id === messageId ? { ...m, delivered: true }  : m));
    const onSeen      = ({ messageId }) => setMessages((p) => p.map((m) => m.message_id === messageId ? { ...m, is_read: true }    : m));
    socket.on("message_delivered", onDelivered);
    socket.on("message_seen",      onSeen);
    return () => { socket.off("message_delivered", onDelivered); socket.off("message_seen", onSeen); };
  }, [socket]);

  useEffect(() => {
    if (!socket || !selectedUser) return;
    localMessages.forEach((msg) => {
      if (msg.message_id && String(msg.sender_id) === String(selectedUser.user_id) && !msg.is_read) {
        socket.emit("message_seen", { messageId: msg.message_id, senderId: msg.sender_id });
      }
    });
  }, [localMessages, selectedUser, socket]);

  // ── Empty state (no user selected) ──
  if (!selectedUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 gap-4 p-8 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm"
          style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}
        >
          <BookOpen className="w-7 h-7" style={{ color: `rgb(var(--primary-500))` }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">No Consultation Selected</h3>
          <p className="text-xs text-gray-400 max-w-50 leading-relaxed">
            Select a student from the list to begin or continue an OJT consultation.
          </p>
        </div>
        <div
          className="px-3 py-1.5 rounded-full"
          style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}
        >
          <span className="text-[11px] font-medium" style={{ color: `rgb(var(--primary-700))` }}>
            OJT Monitoring System
          </span>
        </div>
      </div>
    );
  }

  const grouped      = groupMessagesByDate(localMessages);
  const selectedName = getFullName(selectedUser);
  const groupingMap  = buildGroupingMap(localMessages);

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shadow-sm shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-all md:hidden shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        <div className="relative shrink-0">
          <Avatar name={selectedName} src={selectedUser.photo ? `${BASE_URL}${selectedUser.photo}` : ""} size="md" />
          {isOnline && (
            <span
              className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white"
              style={{ backgroundColor: `rgb(var(--primary-500))` }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-gray-800 truncate">{selectedName}</h3>
            {isOnline && (
              <span className="text-[10px] font-semibold shrink-0" style={{ color: `rgb(var(--primary-600))` }}>
                Online
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {selectedUser.role && (
              <span className="text-[10px] text-gray-500 capitalize font-medium">{selectedUser.role}</span>
            )}
            {selectedUser.role && <span className="text-[10px] text-gray-300">·</span>}
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `rgb(var(--primary-50))`,
                border:          `1px solid rgb(var(--primary-100))`,
                color:           `rgb(var(--primary-700))`,
              }}
            >
              <BookOpen className="w-2.5 h-2.5" />OJT Consultation
            </span>
          </div>
        </div>
      </div>

      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-6 h-6 rounded-full animate-spin"
                style={{ border: '2px solid #e5e7eb', borderTopColor: `rgb(var(--primary-700))` }}
              />
              <p className="text-xs text-gray-400">Loading consultation…</p>
            </div>
          </div>
        ) : localMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
              style={{ backgroundColor: `rgb(var(--primary-50))`, border: `1px solid rgb(var(--primary-100))` }}
            >
              <BookOpen className="w-6 h-6" style={{ color: `rgb(var(--primary-500))` }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Start a consultation with {selectedName}</p>
              <p className="text-xs text-gray-400 leading-relaxed max-w-55">
                Discuss daily logs, narratives, or internship concerns.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {grouped.map((item) => {
              if (item.type === "date-label") {
                return (
                  <div key={item.id} className="flex items-center gap-2 py-4">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-[10px] text-gray-400 font-medium px-2.5 py-1 bg-white border border-gray-200 rounded-full shadow-sm">
                      {item.label}
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                );
              }

              if (item.message_type === "system" || item.type === "system" || item.is_system) {
                return <SystemMessageCard key={item.message_id ?? item.tempId} item={item} />;
              }

              const isSent  = userId != null && item.sender_id === userId;
              const msgKey  = item.message_id ?? item.tempId;
              const { isGroupStart, isGroupEnd } = groupingMap.get(msgKey) ?? { isGroupStart: true, isGroupEnd: true };

              return (
                <MessageBubble
                  key={msgKey}
                  item={item}
                  isSent={isSent}
                  isGroupStart={isGroupStart}
                  isGroupEnd={isGroupEnd}
                  selectedUser={selectedUser}
                  selectedName={selectedName}
                />
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {isTyping && !loading && (
        <div className="mt-1"><TypingIndicator name={selectedName} /></div>
      )}

      <MessageInput onSend={onSend} disabled={loading} socket={socket} receiverId={selectedUser?.user_id} />
    </div>
  );
}