import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  FileText,
  ScrollText,
  Paperclip,
  SmilePlus,
} from "lucide-react";
import Avatar from "../ui/Avatar";
import MessageInput from "./MessageInput";
import ReactionIcon from "../ui/ReactionIcon";
import { REACTION_CODES, getReactionMeta } from "../../constants/reaction";

// Helpers

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
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

function groupMessagesByDate(messages) {
  const groups = [];
  let lastLabel = null;
  for (const msg of messages) {
    const ts = resolveTimestamp(msg);
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
    const cur = normal[i];
    const prev = normal[i - 1];
    const next = normal[i + 1];
    const sameSenderAsPrev = prev && prev.sender_id === cur.sender_id && getTimeDiffMinutes(resolveTimestamp(prev), resolveTimestamp(cur)) < 5;
    const sameSenderAsNext = next && next.sender_id === cur.sender_id && getTimeDiffMinutes(resolveTimestamp(cur), resolveTimestamp(next)) < 5;
    map.set(cur.message_id ?? cur.tempId, { isGroupStart: !sameSenderAsPrev, isGroupEnd: !sameSenderAsNext });
  }
  return map;
}

function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function renderMessageContent(text, mentions) {
  if (!text) return null;
  if (!Array.isArray(mentions) || mentions.length === 0) return text;

  const names = mentions
    .map((m) => {
      if (m.mention_type === "everyone") return "everyone";
      if (m.mention_type === "student") return "student";
      if (m.mention_type === "coordinator") return "coordinator";
      return `${m.f_name ?? ""} ${m.l_name ?? ""}`.trim();
    })
    .filter(Boolean);

  if (names.length === 0) return text;

  const escaped = names
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);

  const regex = new RegExp(`@(${escaped.join("|")})`, "gi");
  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <span key={`mention-${key++}`} className="font-semibold" style={{ color: `rgb(var(--primary-600))` }}>
        {match[0]}
      </span>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return parts;
}

function extractOptimisticText(args) {
  const first = args[0];
  if (typeof first === "string") return first.trim();
  if (typeof FormData !== "undefined" && first instanceof FormData) {
    const v = first.get("message");
    return typeof v === "string" ? v.trim() : "";
  }
  if (first && typeof first === "object") {
    if (typeof first.message === "string") return first.message.trim();
    if (typeof first.text === "string") return first.text.trim();
  }
  return "";
}

// Group avatar
const GroupAvatar = memo(function GroupAvatar({ label }) {
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-100 text-gray-500"
      role="img"
      aria-label={label}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m5-2.13a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm6 1a4 4 0 1 0 0-8" />
      </svg>
    </div>
  );
});

// Typing dots
const TypingDots = memo(function TypingDots() {
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
});

// Typing indicator
const TypingIndicator = memo(function TypingIndicator({ name }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5" role="status" aria-live="polite">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-2xl rounded-bl-sm shadow-sm">
        <span className="text-[11px] text-gray-400 font-medium leading-none">{name} is typing</span>
        <TypingDots />
      </div>
    </div>
  );
});

// System message card
const SystemMessageCard = memo(function SystemMessageCard({ item }) {
  const isLog = !!item.related_log_id;
  const isNarrative = !!item.related_narrative_id;
  const Icon = isNarrative ? ScrollText : FileText;
  const label = isNarrative ? "Narrative Entry" : isLog ? "Daily Log" : null;
  const idMatch = item.message?.match(/#(\d+)/);
  const refId = idMatch ? `#${idMatch[1]}` : null;

  return (
    <div className="flex justify-center my-6 px-2">
      <div
        className="w-full max-w-xs bg-white rounded-2xl shadow-sm overflow-hidden"
        style={{ border: `1px solid rgb(var(--primary-100))` }}
      >
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
});

// Attachment block
const AttachmentBlock = memo(function AttachmentBlock({ item, isSent }) {
  if (!item.attachment_url) return null;

  const isImage = typeof item.attachment_type === "string" && item.attachment_type.startsWith("image/");
  const sizeLabel = formatFileSize(item.attachment_size);

  if (isImage) {
    return (
      <a
        href={item.attachment_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mb-1 rounded-xl overflow-hidden max-w-60"
      >
        <img
          src={item.attachment_url}
          alt={item.attachment_name || "Attachment image"}
          className="w-full h-auto object-cover"
          loading="lazy"
        />
      </a>
    );
  }

  return (
    <a
      href={item.attachment_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-1 border ${isSent ? "border-white/30 bg-white/10" : "border-gray-200 bg-gray-50"}`}
    >
      <Paperclip className={`w-3.5 h-3.5 shrink-0 ${isSent ? "text-white" : "text-gray-500"}`} />
      <span className={`text-[11px] font-medium truncate ${isSent ? "text-white" : "text-gray-700"}`}>
        {item.attachment_name || "Attachment"}
      </span>
      {sizeLabel && (
        <span className={`text-[10px] shrink-0 ${isSent ? "text-white/70" : "text-gray-400"}`}>{sizeLabel}</span>
      )}
    </a>
  );
});

// Reaction bar
const ReactionBar = memo(function ReactionBar({ reactions, isSent, onReact, messageId }) {
  if (!reactions || !reactions.total) return null;

  return (
    <div
      className={`flex flex-wrap gap-1 mt-1 ${isSent ? "justify-end" : "justify-start"}`}
      aria-label="Message reactions"
    >
      {reactions.reactions.map((r) => {
        const meta = getReactionMeta(r.reaction_code);
        return (
          <button
            key={r.reaction_code}
            type="button"
            onClick={() => onReact?.(messageId, r.reaction_code)}
            title={r.users.map((u) => getFullName(u)).join(", ")}
            aria-label={`${meta?.label ?? r.reaction_code} reaction, ${r.count}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white border border-gray-200 text-[10px] shadow-sm hover:border-gray-300 transition-colors"
          >
            <ReactionIcon reactionCode={r.reaction_code} size="xs" decorative />
            <span className="text-gray-500 font-medium">{r.count}</span>
          </button>
        );
      })}
    </div>
  );
});

// Reaction picker
const ReactionPicker = memo(function ReactionPicker({ onPick }) {
  return (
    <div
      role="menu"
      aria-label="Pick a reaction"
      className="absolute bottom-full mb-1 z-10 flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-full shadow-md max-w-[80vw] overflow-x-auto"
    >
      {REACTION_CODES.map((code) => (
        <button
          key={code}
          type="button"
          role="menuitem"
          onClick={() => onPick(code)}
          aria-label={getReactionMeta(code)?.label ?? code}
          className="shrink-0 hover:scale-125 transition-transform"
        >
          <ReactionIcon reactionCode={code} size="sm" decorative />
        </button>
      ))}
    </div>
  );
});

// Message bubble
const MessageBubble = memo(function MessageBubble({
  item,
  isSent,
  isGroupStart,
  isGroupEnd,
  isGroupChat,
  onReact,
  isPickerOpen,
  onTogglePicker,
}) {
  const ts = resolveTimestamp(item);

  const sentCorners = ["rounded-2xl", !isGroupStart && "rounded-tr-md", !isGroupEnd && "rounded-br-md"].filter(Boolean).join(" ");
  const recvCorners = ["rounded-2xl", !isGroupStart && "rounded-tl-md", !isGroupEnd && "rounded-bl-md"].filter(Boolean).join(" ");

  const senderName = getFullName(item);
  const hasText = typeof item.message === "string" && item.message.trim() !== "";

  return (
    <div className={`flex gap-2 items-end ${isSent ? "flex-row-reverse" : "flex-row"} ${isGroupStart ? "mt-3" : "mt-1"}`}>
      {!isSent && (
        <div className="shrink-0 w-7 self-end mb-1">
          {isGroupEnd ? (
            <Avatar name={senderName} src={item.photo} size="sm" />
          ) : (
            <div className="w-7 h-7" />
          )}
        </div>
      )}

      <div className={`flex flex-col gap-0.5 max-w-[75%] sm:max-w-[70%] md:max-w-[60%] ${isSent ? "items-end" : "items-start"}`}>
        {!isSent && isGroupChat && isGroupStart && (
          <span className="text-[10px] font-semibold text-gray-500 px-1">{senderName}</span>
        )}

        <div className="relative group/bubble" data-reaction-picker-root>
          <div
            className={`px-4 py-2.5 text-xs leading-relaxed shadow-sm ${isSent ? sentCorners : `bg-white border border-gray-200 text-gray-800 ${recvCorners}`} ${item.pending ? "opacity-70" : ""}`}
            style={isSent ? { backgroundColor: `rgb(var(--primary-700))`, color: 'white' } : {}}
          >
            <AttachmentBlock item={item} isSent={isSent} />
            {hasText && renderMessageContent(item.message, item.mentions)}
          </div>

          {item.message_id != null && (
            <button
              type="button"
              onClick={() => onTogglePicker(item.message_id)}
              aria-label="Add reaction"
              aria-haspopup="true"
              aria-expanded={isPickerOpen}
              className={`absolute top-1/2 -translate-y-1/2 ${isSent ? "-left-7" : "-right-7"} w-6 h-6 rounded-full flex items-center justify-center text-gray-400 opacity-60 md:opacity-0 md:group-hover/bubble:opacity-100 hover:bg-gray-100 transition-opacity`}
            >
              <SmilePlus className="w-3.5 h-3.5" />
            </button>
          )}

          {isPickerOpen && (
            <ReactionPicker onPick={(code) => onReact?.(item.message_id, code)} />
          )}
        </div>

        <ReactionBar reactions={item.reactions} isSent={isSent} onReact={onReact} messageId={item.message_id} />

        {isGroupEnd && (
          <div className={`flex items-center gap-1 px-1 ${isSent ? "flex-row-reverse" : "flex-row"}`}>
            <span className="text-[10px] text-gray-400">{formatTime(ts)}</span>
            {item.failed && <span className="text-[10px] text-red-400">Failed to send</span>}
            {isSent && !item.failed && (
              <span className="opacity-80">
                {item.pending ? (
                  <Clock className="w-3 h-3 text-gray-300" />
                ) : item.is_read ? (
                  <CheckCheck className="w-3 h-3" style={{ color: `rgb(var(--primary-500))` }} />
                ) : item.delivered ? (
                  <CheckCheck className="w-3 h-3 text-gray-400" />
                ) : (
                  <Check className="w-3 h-3 text-gray-400" />
                )}
              </span>
            )}
            {isSent && item.failed && <AlertCircle className="w-3 h-3 text-red-400" />}
            {isSent && isGroupChat && !item.pending && !item.failed && Number.isFinite(item.read_count) && (
              <span className="text-[9px] text-gray-400">
                {item.read_count > 0 ? `· Read by ${item.read_count}` : "· Sent"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ChatWindow
export default function ChatWindow({
  selectedConversation,
  messages,
  currentUserId,
  onSend,
  onReact,
  loading,
  onBack,
  socket,
  isOnline = false,
}) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const seenIdsRef = useRef(new Set());
  const tempCounterRef = useRef(0);
  const isMountedRef = useRef(true);
  const skipNextScrollRef = useRef(false);

  const userId = useMemo(() => resolveCurrentUserId(currentUserId), [currentUserId]);

  const conversationId = selectedConversation?.conversation_id ?? null;
  const isGroupChat = !!selectedConversation?.is_group;

  // Stable per-chat identity that survives the null -> real conversation_id
  // transition of lazy conversation creation, so a switch to a genuinely
  // different contact is the only thing that resets local chat state.
  const identityKey = useMemo(() => {
    if (!selectedConversation) return null;
    return isGroupChat
      ? `group-${selectedConversation.conversation_id}`
      : `user-${selectedConversation.user_id}`;
  }, [selectedConversation, isGroupChat]);

  const [localMessages, setMessages] = useState(() =>
    Array.isArray(messages) ? messages : []
  );
  const [typingUsers, setTypingUsers] = useState(() => new Set());
  const [reactionPickerId, setReactionPickerId] = useState(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Merge messages
  useEffect(() => {
    const safe = Array.isArray(messages) ? messages : [];
    setMessages((prev) => {
      const carryOver = prev.filter(
        (m) => m.tempId && (m.pending || m.failed) && m.contactKey === identityKey
      );
      return [...safe, ...carryOver];
    });
  }, [messages, identityKey]);

  const scrollToBottom = useCallback((force = false) => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (force || distanceFromBottom < 100) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Conversation switch
  useEffect(() => {
    skipNextScrollRef.current = true;
    scrollToBottom(true);

    setTypingUsers(() => new Set());
    setReactionPickerId(null);
    seenIdsRef.current = new Set();
  }, [identityKey, scrollToBottom]);

  // Scroll on new messages
  useEffect(() => {
    if (skipNextScrollRef.current) {
      skipNextScrollRef.current = false;
      return;
    }
    scrollToBottom();
  }, [localMessages, scrollToBottom]);

  useEffect(() => { if (typingUsers.size > 0) scrollToBottom(); }, [typingUsers, scrollToBottom]);

  // Reaction picker outside click
  useEffect(() => {
    if (reactionPickerId == null) return;

    const handleOutside = (e) => {
      if (!e.target.closest?.("[data-reaction-picker-root]")) setReactionPickerId(null);
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setReactionPickerId(null);
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [reactionPickerId]);

  // Incoming messages
  useEffect(() => {
    if (!socket || !conversationId) return;
    const onReceive = (msg) => {
      if (!msg || msg.conversation_id !== conversationId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.message_id === msg.message_id)) return prev;
        if (msg.sender_id === userId) {
          const tempIndex = prev.findIndex(
            (m) => m.tempId && m.pending && !m.message_id && m.contactKey === identityKey
          );
          if (tempIndex !== -1) {
            const next = [...prev];
            next[tempIndex] = msg;
            return next;
          }
        }
        return [...prev, msg];
      });
    };
    socket.on("receive_message", onReceive);
    return () => { socket.off("receive_message", onReceive); };
  }, [socket, conversationId, userId, identityKey]);

  // Typing indicators
  useEffect(() => {
    if (!socket || !conversationId) return;

    const onTyping = ({ conversationId: cid, userId: uid } = {}) => {
      if (cid !== conversationId || uid == null || uid === userId) return;
      setTypingUsers((prev) => new Set(prev).add(uid));
    };
    const onStopTyping = ({ conversationId: cid, userId: uid } = {}) => {
      if (cid !== conversationId || uid == null) return;
      setTypingUsers((prev) => {
        if (!prev.has(uid)) return prev;
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    };

    socket.on("typing", onTyping);
    socket.on("stop_typing", onStopTyping);
    return () => {
      socket.off("typing", onTyping);
      socket.off("stop_typing", onStopTyping);
    };
  }, [socket, conversationId, userId]);

  // Delivery & seen receipts
  useEffect(() => {
    if (!socket) return;
    const onDelivered = ({ messageId } = {}) => setMessages((p) => p.map((m) => m.message_id === messageId ? { ...m, delivered: true } : m));
    const onSeen = ({ messageId } = {}) => setMessages((p) => p.map((m) => m.message_id === messageId ? { ...m, is_read: true } : m));
    socket.on("message_delivered", onDelivered);
    socket.on("message_seen", onSeen);
    return () => {
      socket.off("message_delivered", onDelivered);
      socket.off("message_seen", onSeen);
    };
  }, [socket]);

  // Seen receipts
  useEffect(() => {
    if (!socket || !conversationId) return;
    localMessages.forEach((msg) => {
      if (!msg.message_id) return;
      if (msg.sender_id === userId) return;
      if (msg.read_by_me) return;
      if (seenIdsRef.current.has(msg.message_id)) return;
      seenIdsRef.current.add(msg.message_id);
      socket.emit("message_seen", { messageId: msg.message_id, senderId: msg.sender_id });
    });
  }, [localMessages, socket, userId, conversationId]);

  // Reaction updates
  useEffect(() => {
    if (!socket || !conversationId) return;
    const applyReaction = (payload = {}) => {
      setMessages((prev) => prev.map((m) => m.message_id === payload.message_id ? { ...m, reactions: payload.summary } : m));
    };
    socket.on("reaction_added", applyReaction);
    socket.on("reaction_updated", applyReaction);
    socket.on("reaction_removed", applyReaction);
    return () => {
      socket.off("reaction_added", applyReaction);
      socket.off("reaction_updated", applyReaction);
      socket.off("reaction_removed", applyReaction);
    };
  }, [socket, conversationId]);

  const grouped = useMemo(() => groupMessagesByDate(localMessages), [localMessages]);
  const groupingMap = useMemo(() => buildGroupingMap(localMessages), [localMessages]);

  const handleTogglePicker = useCallback((messageId) => {
    setReactionPickerId((prev) => (prev === messageId ? null : messageId));
  }, []);

  const handleReact = useCallback((messageId, reactionCode) => {
    onReact?.(messageId, reactionCode);
    setReactionPickerId(null);
  }, [onReact]);

  // Send
  const handleSend = useCallback(async (...args) => {
    const text = extractOptimisticText(args);
    let tempId = null;

    if (text) {
      tempId = `temp-${Date.now()}-${tempCounterRef.current++}`;
      setMessages((prev) => [
        ...prev,
        {
          tempId,
          message_id: null,
          conversation_id: conversationId,
          contactKey: identityKey,
          sender_id: userId,
          message: text,
          message_type: "text",
          created_at: new Date().toISOString(),
          is_read: false,
          delivered: false,
          read_count: 0,
          mentions: [],
          reactions: { total: 0, reactions: [] },
          pending: true,
        },
      ]);
    }

    try {
      const result = await onSend?.(...args);
      if (!isMountedRef.current) return result;

      const real = result?.data ?? result;
      if (tempId) {
        setMessages((prev) => {
          if (real?.message_id && prev.some((m) => m.message_id === real.message_id)) {
            return prev.filter((m) => m.tempId !== tempId);
          }
          if (real?.message_id) {
            return prev.map((m) => (m.tempId === tempId ? { ...real } : m));
          }
          return prev.map((m) => (m.tempId === tempId ? { ...m, pending: false } : m));
        });
      }
      return result;
    } catch (err) {
      if (isMountedRef.current && tempId) {
        setMessages((prev) => prev.map((m) => (m.tempId === tempId ? { ...m, pending: false, failed: true } : m)));
      }
      throw err;
    }
  }, [onSend, conversationId, identityKey, userId]);

  // Empty state
  if (!selectedConversation) {
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

  const selectedName = getFullName(selectedConversation);
  const typingName = isGroupChat ? "Someone" : selectedName;
  const showTyping = typingUsers.size > 0;

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shadow-sm shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back to conversations"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-all md:hidden shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        <div className="relative shrink-0">
          {isGroupChat ? (
            <GroupAvatar label={selectedName} />
          ) : (
            <Avatar name={selectedName} src={selectedConversation.photo} size="md" />
          )}
          {isOnline && !isGroupChat && (
            <span
              className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white"
              style={{ backgroundColor: `rgb(var(--primary-500))` }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-gray-800 truncate">{selectedName}</h3>
            {isOnline && !isGroupChat && (
              <span className="text-[10px] font-semibold shrink-0" style={{ color: `rgb(var(--primary-600))` }}>
                Online
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {!isGroupChat && selectedConversation.role && (
              <span className="text-[10px] text-gray-500 capitalize font-medium">{selectedConversation.role}</span>
            )}
            {isGroupChat && selectedConversation.member_count != null && (
              <span className="text-[10px] text-gray-500 font-medium">{selectedConversation.member_count} members</span>
            )}
            {(selectedConversation.role || isGroupChat) && <span className="text-[10px] text-gray-300">·</span>}
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `rgb(var(--primary-50))`,
                border: `1px solid rgb(var(--primary-100))`,
                color: `rgb(var(--primary-700))`,
              }}
            >
              <BookOpen className="w-2.5 h-2.5" />OJT Consultation
            </span>
          </div>
        </div>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${selectedName}`}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full" role="status">
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

              const isSent = userId != null && item.sender_id === userId;
              const msgKey = item.message_id ?? item.tempId;
              const { isGroupStart, isGroupEnd } = groupingMap.get(msgKey) ?? { isGroupStart: true, isGroupEnd: true };

              return (
                <MessageBubble
                  key={msgKey}
                  item={item}
                  isSent={isSent}
                  isGroupStart={isGroupStart}
                  isGroupEnd={isGroupEnd}
                  isGroupChat={isGroupChat}
                  onReact={handleReact}
                  isPickerOpen={reactionPickerId === item.message_id}
                  onTogglePicker={handleTogglePicker}
                />
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {showTyping && !loading && (
        <div className="mt-1"><TypingIndicator name={typingName} /></div>
      )}

      <MessageInput
        onSend={handleSend}
        disabled={loading}
        socket={socket}
        conversationId={conversationId}
      />
    </div>
  );
}