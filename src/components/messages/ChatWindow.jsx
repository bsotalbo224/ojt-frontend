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

// Works against a single attachment object (from message.attachments[]),
// not the legacy message-level attachment_* fields.
function isImageAttachmentItem(attachment) {
  return !!attachment?.attachment_url && typeof attachment.attachment_type === "string" && attachment.attachment_type.startsWith("image/");
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
  // Holds { message, attachment, key } for the image currently open in the modal.
  const [imageModalItem, setImageModalItem] = useState(null);
  // Holds the full message object currently being replied to (Messenger-style reply).
  const [replyingTo, setReplyingTo] = useState(null);

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

  // Flat, ordered list of every image attachment across every message, used to
  // drive prev/next navigation and the "n / total" counter in ImageModal.
  // A single message can now contribute more than one entry.
  const imageAttachments = useMemo(() => {
    const list = [];
    localMessages.forEach((msg) => {
      if (!Array.isArray(msg.attachments)) return;
      msg.attachments.forEach((attachment, idx) => {
        if (isImageAttachmentItem(attachment)) {
          list.push({
            message: msg,
            attachment,
            key: `${resolveMessageKey(msg)}-${idx}`,
          });
        }
      });
    });
    return list;
  }, [localMessages]);

  const imageModalIndex = useMemo(() => {
    if (!imageModalItem) return -1;
    return imageAttachments.findIndex((entry) => entry.key === imageModalItem.key);
  }, [imageModalItem, imageAttachments]);

  const handleNavigateImage = useCallback((direction) => {
    setImageModalItem((current) => {
      if (!current) return current;
      const idx = imageAttachments.findIndex((entry) => entry.key === current.key);
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

  // Called from MessageList when an image attachment is clicked. Accepts
  // (message, attachment) so a specific image within a multi-image message
  // opens directly, and falls back to the message's first image if only a
  // message is passed.
  const handleImageClick = useCallback((message, attachment) => {
    if (!message) return;
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    const resolvedAttachment = attachment ?? attachments.find(isImageAttachmentItem) ?? attachments[0];
    if (!resolvedAttachment) return;
    const idx = attachments.indexOf(resolvedAttachment);
    setImageModalItem({
      message,
      attachment: resolvedAttachment,
      key: `${resolveMessageKey(message)}-${idx}`,
    });
  }, []);

  const handleCloseImageModal = useCallback(() => {
    setImageModalItem(null);
  }, []);

  // Sole entry point for outgoing messages. MessageInput calls
  // onSend(message, files) directly; ChatWindow's job here is only the
  // optimistic bubble / upload-progress / retry pipeline, keyed off
  // message.attachments[] instead of legacy single-attachment fields.
  const handleSend = useCallback(async (message, files) => {
    const text = typeof message === "string" ? message.trim() : "";
    const fileList = Array.isArray(files) ? files : [];
    let tempId = null;
    const previewUrls = [];
    // Snapshot the reply target at send time so a later cancel/change doesn't
    // affect this in-flight send.
    const replyTarget = replyingTo;

    // Attachment-only sends (no caption) still get an optimistic bubble.
    if (text || fileList.length > 0) {
      tempId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? `temp-${crypto.randomUUID()}`
          : `temp-${Date.now()}-${Math.random().toString(36).slice(2)}-${tempCounterRef.current++}`;

      const attachments = fileList.map((file) => {
        let url = "";
        try {
          url = URL.createObjectURL(file);
          pendingObjectUrlsRef.current.add(url);
          previewUrls.push(url);
        } catch {
          url = "";
        }
        return {
          attachment_name: file.name,
          attachment_url: url,
          attachment_type: file.type,
          attachment_size: file.size,
          uploading: true,
          progress: 0,
        };
      });

      setMessages((prev) => [
        ...prev,
        {
          tempId,
          message_id: null,
          conversation_id: conversationId,
          contactKey: identityKey,
          sender_id: userId,
          message: text,
          message_type: attachments.length > 0 ? "attachment" : "text",
          created_at: new Date().toISOString(),
          is_read: false,
          delivered: false,
          read_count: 0,
          mentions: [],
          reactions: { total: 0, reactions: [] },
          pending: true,
          attachments,
          reply_to: replyTarget,
        },
      ]);

      // Simulated upload progress (one message-level value, mirrored onto
      // every attachment) until onSend resolves.
      if (attachments.length > 0) {
        let simulated = 0;
        const currentTempId = tempId;
        const intervalId = setInterval(() => {
          simulated = Math.min(90, simulated + 5 + Math.random() * 10);
          const rounded = Math.round(simulated);
          setMessages((prev) => prev.map((m) => (
            m.tempId === currentTempId
              ? { ...m, attachments: m.attachments.map((a) => ({ ...a, progress: rounded })) }
              : m
          )));
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

    const releasePreviewUrls = () => {
      if (previewUrls.length === 0) return;
      // Deferred to avoid a broken-image flash before the swap paints.
      setTimeout(() => {
        previewUrls.forEach((url) => {
          URL.revokeObjectURL(url);
          pendingObjectUrlsRef.current.delete(url);
        });
      }, 1000);
    };

    try {
      const result = await onSend?.(message, files, replyTarget);
      clearProgress();
      if (!isMountedRef.current) {
        releasePreviewUrls();
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
      releasePreviewUrls();
      setReplyingTo(null);
      return result;
    } catch (err) {
      clearProgress();
      if (isMountedRef.current && tempId) {
        setMessages((prev) => prev.map((m) => (m.tempId === tempId ? { ...m, pending: false, failed: true } : m)));
      }
      releasePreviewUrls();
      throw err;
    }
  }, [onSend, conversationId, identityKey, userId, replyingTo]);

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
            onReply={setReplyingTo}
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
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
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
          item={{
            ...imageModalItem.attachment,
            message_id: resolveMessageKey(imageModalItem.message),
          }}
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