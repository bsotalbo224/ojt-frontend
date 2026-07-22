import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import { BookOpen } from "lucide-react";
import MessageInput from "./MessageInput";
import ImageModal from "./ImageModal";
import ConversationHeader from "./ConversationHeader";
import MessageList from "./MessageList";
import ReactionPickerPanel from "./ReactionPickerPanel";
import TypingIndicator from "./TypingIndicator";
import { REACTION_CODES } from "../../constants/reactions";

const BADGE_SURFACE = "bg-[rgb(var(--primary-50))] border border-[rgb(var(--primary-100))]";
const PRIMARY_TEXT = "text-[rgb(var(--primary-700))]";

// Reaction picker sizing is derived from the number of reactions.
const REACTION_BUTTON_SIZE = 32;
const REACTION_BUTTON_GAP = 6;
const REACTION_PICKER_PADDING = 20; // px-2.5 on both sides
const REACTION_PICKER_VIEWPORT_MARGIN = 10;

function getReactionPickerWidth(count) {
  return count * REACTION_BUTTON_SIZE + Math.max(0, count - 1) * REACTION_BUTTON_GAP + REACTION_PICKER_PADDING;
}

/* ----------------------------- Shared helpers ---------------------------- */

const getFullName = (user = {}) => {
  if (user.f_name || user.l_name) return `${user.f_name ?? ""} ${user.l_name ?? ""}`.trim();
  return user.name || "Unknown";
};

const resolveTimestamp = (item) => item?.created_at || item?.sent_at || null;
const resolveMessageKey = (item) => item?.message_id ?? item?.tempId ?? null;

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

function isImageAttachmentItem(item) {
  return !!item?.attachment_url && typeof item.attachment_type === "string" && item.attachment_type.startsWith("image/");
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

// Looks for a File instance in the arguments passed to onSend, so an
// attachment-only send can render an immediate local preview.
function extractOptimisticAttachment(args) {
  const first = args[0];
  let file = null;

  if (typeof File === "undefined") return null;

  if (typeof FormData !== "undefined" && first instanceof FormData) {
    for (const value of first.values()) {
      if (value instanceof File) {
        file = value;
        break;
      }
    }
  } else if (first && typeof first === "object") {
    if (first.file instanceof File) file = first.file;
    else if (first.attachment instanceof File) file = first.attachment;
  }

  if (!file) return null;

  let url;
  try {
    url = URL.createObjectURL(file);
  } catch {
    return null;
  }

  return {
    url,
    name: file.name,
    type: file.type,
    size: file.size,
  };
}

/* --------------------------- Layout subcomponents -------------------------- */

const NoConversationState = memo(function NoConversationState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 gap-4 p-8 text-center">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm ${BADGE_SURFACE}`}>
        <BookOpen className="w-7 h-7 text-[rgb(var(--primary-500))]" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">No Consultation Selected</h3>
        <p className="text-xs text-gray-400 max-w-50 leading-relaxed">
          Select a student from the list to begin or continue an OJT consultation.
        </p>
      </div>
      <div className={`px-3 py-1.5 rounded-full ${BADGE_SURFACE}`}>
        <span className={`text-[11px] font-medium ${PRIMARY_TEXT}`}>OJT Monitoring System</span>
      </div>
    </div>
  );
});

const LoadingState = memo(function LoadingState() {
  return (
    <div className="flex items-center justify-center h-full" role="status">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 rounded-full animate-spin border-2 border-gray-200 border-t-[rgb(var(--primary-700))]" />
        <p className="text-xs text-gray-400">Loading consultation…</p>
      </div>
    </div>
  );
});

const EmptyMessagesState = memo(function EmptyMessagesState({ selectedName }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${BADGE_SURFACE}`}>
        <BookOpen className="w-6 h-6 text-[rgb(var(--primary-500))]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-1">Start a consultation with {selectedName}</p>
        <p className="text-xs text-gray-400 leading-relaxed max-w-55">
          Discuss daily logs, narratives, or internship concerns.
        </p>
      </div>
    </div>
  );
});

const DateSeparator = memo(function DateSeparator({ label }) {
  return (
    <div className="flex items-center gap-2 py-4">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-[10px] text-gray-400 font-medium px-2.5 py-1 bg-white border border-gray-200 rounded-full shadow-sm">
        {label}
      </span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
});

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
  // Tracks blob: URLs created for optimistic attachment previews.
  const pendingObjectUrlsRef = useRef(new Set());
  // Tracks the simulated upload-progress interval per optimistic message.
  const progressIntervalsRef = useRef(new Map());

  const userId = useMemo(() => resolveCurrentUserId(currentUserId), [currentUserId]);

  const conversationId = selectedConversation?.conversation_id ?? null;
  const isGroupChat = !!selectedConversation?.is_group;

  const identityKey = useMemo(() => {
    if (!selectedConversation) return null;
    return isGroupChat
      ? `group-${selectedConversation.conversation_id}`
      : `user-${selectedConversation.user_id}`;
  }, [selectedConversation, isGroupChat]);

  const [localMessages, setMessages] = useState(() => (Array.isArray(messages) ? messages : []));
  const [typingUsers, setTypingUsers] = useState(() => new Set());
  const [reactionPicker, setReactionPicker] = useState(null);
  const [imageModalItem, setImageModalItem] = useState(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      pendingObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      pendingObjectUrlsRef.current.clear();
      progressIntervalsRef.current.forEach((id) => clearInterval(id));
      progressIntervalsRef.current.clear();
    };
  }, []);

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

  // Closes the reaction picker and restores focus to whichever trigger button opened it.
  const closePicker = useCallback(() => {
    setReactionPicker((prev) => {
      if (prev?.triggerEl && typeof prev.triggerEl.focus === "function") {
        prev.triggerEl.focus();
      }
      return null;
    });
  }, []);

  useEffect(() => {
    skipNextScrollRef.current = true;
    scrollToBottom(true);
    setTypingUsers(() => new Set());
    setReactionPicker(null);
    seenIdsRef.current = new Set();
  }, [identityKey, scrollToBottom]);

  useEffect(() => {
    if (skipNextScrollRef.current) {
      skipNextScrollRef.current = false;
      return;
    }
    scrollToBottom();
  }, [localMessages, scrollToBottom]);

  useEffect(() => { if (typingUsers.size > 0) scrollToBottom(); }, [typingUsers, scrollToBottom]);

  useEffect(() => {
    if (reactionPicker == null) return;

    const handleOutside = (e) => {
      if (!e.target.closest?.("[data-reaction-picker-panel], [data-reaction-toggle-btn]")) {
        closePicker();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") closePicker();
    };
    const handleReflow = () => closePicker();

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReflow);
    scrollRef.current?.addEventListener("scroll", handleReflow);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReflow);
      scrollRef.current?.removeEventListener("scroll", handleReflow);
    };
  }, [reactionPicker, closePicker]);

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

  // Ordered list of image attachments currently in the conversation, used to
  // drive prev/next navigation and the "n / total" counter in ImageModal.
  const imageAttachments = useMemo(
    () => localMessages.filter(isImageAttachmentItem),
    [localMessages]
  );

  const imageModalIndex = useMemo(() => {
    if (!imageModalItem) return -1;
    const key = resolveMessageKey(imageModalItem);
    return imageAttachments.findIndex((m) => resolveMessageKey(m) === key);
  }, [imageModalItem, imageAttachments]);

  const handleNavigateImage = useCallback((direction) => {
    setImageModalItem((current) => {
      if (!current) return current;
      const key = resolveMessageKey(current);
      const idx = imageAttachments.findIndex((m) => resolveMessageKey(m) === key);
      if (idx === -1) return current;
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= imageAttachments.length) return current;
      return imageAttachments[nextIdx];
    });
  }, [imageAttachments]);

  // Opening/toggling always fully replaces reactionPicker in one state update.
  const handleTogglePicker = useCallback((messageId, rect, triggerEl) => {
    setReactionPicker((prev) => {
      if (prev && prev.messageId === messageId) {
        if (prev.triggerEl && typeof prev.triggerEl.focus === "function") prev.triggerEl.focus();
        return null;
      }
      if (!rect) return null;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const halfPicker = getReactionPickerWidth(REACTION_CODES.length) / 2;

      let left = rect.left + rect.width / 2;
      left = Math.min(
        Math.max(left, halfPicker + REACTION_PICKER_VIEWPORT_MARGIN),
        viewportWidth - halfPicker - REACTION_PICKER_VIEWPORT_MARGIN
      );

      const spaceAbove = rect.top;
      const spaceBelow = viewportHeight - rect.bottom;
      const openUpward = spaceAbove >= 64 || spaceAbove > spaceBelow;
      const top = openUpward ? rect.top - 8 : rect.bottom + 8;

      return { messageId, top, left, openUpward, triggerEl };
    });
  }, []);

  const handleReact = useCallback((messageId, reactionCode) => {
    onReact?.(messageId, reactionCode);
    closePicker();
  }, [onReact, closePicker]);

  const handleImageClick = useCallback((item) => {
    setImageModalItem(item);
  }, []);

  const handleCloseImageModal = useCallback(() => {
    setImageModalItem(null);
  }, []);

  // Sole entry point for outgoing messages. MessageInput builds the
  // FormData (text + attachments) and calls this once per send; ChatWindow's
  // job here is only the optimistic bubble / upload-progress / retry pipeline.
  const handleSend = useCallback(async (...args) => {
    const text = extractOptimisticText(args);
    const attachmentPreview = extractOptimisticAttachment(args);
    let tempId = null;

    // Attachment-only sends (no caption) still get an optimistic bubble.
    if (text || attachmentPreview) {
      tempId = `temp-${Date.now()}-${tempCounterRef.current++}`;
      if (attachmentPreview) pendingObjectUrlsRef.current.add(attachmentPreview.url);

      setMessages((prev) => [
        ...prev,
        {
          tempId,
          message_id: null,
          conversation_id: conversationId,
          contactKey: identityKey,
          sender_id: userId,
          message: text,
          message_type: attachmentPreview ? "attachment" : "text",
          created_at: new Date().toISOString(),
          is_read: false,
          delivered: false,
          read_count: 0,
          mentions: [],
          reactions: { total: 0, reactions: [] },
          pending: true,
          ...(attachmentPreview && {
            attachment_url: attachmentPreview.url,
            attachment_name: attachmentPreview.name,
            attachment_type: attachmentPreview.type,
            attachment_size: attachmentPreview.size,
            attachment_progress: 0,
          }),
        },
      ]);

      // Simulated upload progress until onSend resolves.
      if (attachmentPreview) {
        let simulated = 0;
        const currentTempId = tempId;
        const intervalId = setInterval(() => {
          simulated = Math.min(90, simulated + 5 + Math.random() * 10);
          const rounded = Math.round(simulated);
          setMessages((prev) => prev.map((m) => (m.tempId === currentTempId ? { ...m, attachment_progress: rounded } : m)));
          if (simulated >= 90) clearInterval(intervalId);
        }, 250);
        progressIntervalsRef.current.set(tempId, intervalId);
      }
    }

    const clearProgress = () => {
      const id = progressIntervalsRef.current.get(tempId);
      if (id != null) {
        clearInterval(id);
        progressIntervalsRef.current.delete(tempId);
      }
    };

    const releasePreviewUrl = () => {
      if (!attachmentPreview) return;
      // Deferred to avoid a broken-image flash before the swap paints.
      setTimeout(() => {
        URL.revokeObjectURL(attachmentPreview.url);
        pendingObjectUrlsRef.current.delete(attachmentPreview.url);
      }, 1000);
    };

    try {
      const result = await onSend?.(...args);
      clearProgress();
      if (!isMountedRef.current) {
        releasePreviewUrl();
        return result;
      }

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
      releasePreviewUrl();
      return result;
    } catch (err) {
      clearProgress();
      if (isMountedRef.current && tempId) {
        setMessages((prev) => prev.map((m) => (m.tempId === tempId ? { ...m, pending: false, failed: true } : m)));
      }
      releasePreviewUrl();
      throw err;
    }
  }, [onSend, conversationId, identityKey, userId]);

  if (!selectedConversation) {
    return <NoConversationState />;
  }

  const selectedName = getFullName(selectedConversation);
  const typingName = isGroupChat ? "Someone" : selectedName;
  const showTyping = typingUsers.size > 0;

  return (
    <div className="relative flex flex-col h-full bg-gray-50">
      <ConversationHeader
        selectedConversation={selectedConversation}
        selectedName={selectedName}
        isGroupChat={isGroupChat}
        isOnline={isOnline}
        onBack={onBack}
      />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${selectedName}`}
      >
        {loading ? (
          <LoadingState />
        ) : localMessages.length === 0 ? (
          <EmptyMessagesState selectedName={selectedName} />
        ) : (
          <MessageList
            grouped={grouped}
            groupingMap={groupingMap}
            userId={userId}
            isGroupChat={isGroupChat}
            reactionPicker={reactionPicker}
            handleReact={handleReact}
            handleTogglePicker={handleTogglePicker}
            handleImageClick={handleImageClick}
            DateSeparator={DateSeparator}
          />
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

      {reactionPicker && (
        <ReactionPickerPanel
          key={`${reactionPicker.messageId}-${reactionPicker.openUpward}`}
          top={reactionPicker.top}
          left={reactionPicker.left}
          openUpward={reactionPicker.openUpward}
          onPick={(code) => handleReact(reactionPicker.messageId, code)}
          onClose={closePicker}
        />
      )}

      {imageModalItem && (
        <ImageModal
          item={imageModalItem}
          onClose={handleCloseImageModal}
          onNavigate={handleNavigateImage}
          hasPrev={imageModalIndex > 0}
          hasNext={imageModalIndex !== -1 && imageModalIndex < imageAttachments.length - 1}
          currentIndex={imageModalIndex}
          totalImages={imageAttachments.length}
        />
      )}
    </div>
  );
}