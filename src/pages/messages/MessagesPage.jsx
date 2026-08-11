import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import socket from "../../socket";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import ConversationList from "../../components/messages/ConversationList";
import ChatWindow from "../../components/messages/ChatWindow";

const safeArray = (value) => (Array.isArray(value) ? value : []);

// Merge conversations (groups + existing private conversations) with
// consultation contacts, appending only contacts that do not already have
// a private conversation. Existing conversations are never removed and
// always appear first; contacts without conversations are appended after,
// preserving conversation_id = null so lazy creation keeps working.
const mergeConversationsAndContacts = (conversations, contacts) => {
  const convs = safeArray(conversations);
  const cts = safeArray(contacts);

  // Only private (non-group) conversations count toward "already has a
  // conversation" — group conversations are ignored when checking duplicates.
  const existingUserIds = new Set(
    convs
      .filter((c) => !c.is_group && c.user_id != null)
      .map((c) => String(c.user_id))
  );

  const remainingContacts = cts
    .filter((contact) => contact.user_id != null && !existingUserIds.has(String(contact.user_id)))
    .map((contact) => ({
      ...contact,
      conversation_id: contact.conversation_id ?? null,
    }));

  return [...convs, ...remainingContacts];
};

// Selection
const isSameContact = (a, b) => {
  if (!a || !b) return false;
  if (a.conversation_id != null) {
    return String(a.conversation_id) === String(b.conversation_id);
  }
  return b.conversation_id == null && a.user_id != null && String(a.user_id) === String(b.user_id);
};

// Coordinator lookup
const findCoordinator = (contacts) =>
  safeArray(contacts).find((c) => String(c.role ?? "").toLowerCase() === "coordinator") || null;

// Temp IDs
const generateTempId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `temp-${crypto.randomUUID()}`;
  }
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

// Conversation preview
const buildAttachmentPreviewText = (attachments) => {
  const atts = safeArray(attachments);
  if (atts.length === 0) return "";
  if (atts.length === 1) return atts[0].attachment_name || "Attachment";

  const allImages = atts.every((a) => a.attachment_type?.startsWith("image/"));
  if (allImages) return `📷 ${atts.length} images`;

  return `${atts[0].attachment_name || "Attachment"} (+${atts.length - 1})`;
};

export default function MessagesPage() {
  const { user: currentUser, loading: authLoading } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Reply State
  const [replyingTo, setReplyingTo] = useState(null);

  const pollingRef              = useRef(null);
  const autoOpenRef             = useRef(false);
  const contextSentRef          = useRef(false);
  const selectedConversationRef = useRef(null);
  const latestRequestIdRef      = useRef(0);
  const objectUrlsRef           = useRef(new Set());

  const location = useLocation();

  const params                  = new URLSearchParams(location.search);
  const targetConversationParam = params.get("conversation");
  const targetUserParam         = params.get("user");

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Exposes which conversation is currently open to other parts of the app
  // (Sidebar's Consultation unread badge) via a window CustomEvent. No new
  // Context/store — MessagePage's own state and architecture are otherwise
  // unchanged. Fires on every selectedConversation change, including
  // A -> B (single update) and back-to-null via handleBack.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("activeConversationChanged", {
        detail: { conversationId: selectedConversation?.conversation_id ?? null },
      })
    );
  }, [selectedConversation]);

  // Let listeners know no conversation is open once this page unmounts.
  useEffect(() => {
    return () => {
      window.dispatchEvent(
        new CustomEvent("activeConversationChanged", { detail: { conversationId: null } })
      );
    };
  }, []);

  const revokeObjectUrl = useCallback((url) => {
    if (url && objectUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      objectUrlsRef.current.delete(url);
    }
  }, []);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

  // Socket
  useEffect(() => {
    if (!currentUser?.user_id) return;
    if (!socket.connected) socket.connect();
    socket.emit("join", currentUser.user_id);
    socket.on("online_users", setOnlineUsers);
    return () => {
      socket.off("online_users", setOnlineUsers);
      socket.disconnect();
    };
  }, [currentUser?.user_id]);

  // Receive
  useEffect(() => {
    const handleReceiveMessage = (incomingMsg) => {
      const activeConversation = selectedConversationRef.current;
      const isOwnMessage = String(incomingMsg.sender_id) === String(currentUser?.user_id);
      const incomingAttachmentCount = safeArray(incomingMsg.attachments).length;
      let attachmentsToRevoke = [];

      setMessages((prev) => {
        const arr = safeArray(prev);

        if (incomingMsg.message_id && arr.some((m) => m.message_id === incomingMsg.message_id)) {
          return arr;
        }

        if (isOwnMessage) {
          const pendingIdx = arr.findIndex(
            (m) =>
              m.tempId &&
              !m.message_id &&
              String(m.conversation_id) === String(incomingMsg.conversation_id) &&
              m.message === incomingMsg.message &&
              safeArray(m.attachments).length === incomingAttachmentCount
          );
          if (pendingIdx !== -1) {
            const updated = [...arr];
            attachmentsToRevoke = safeArray(updated[pendingIdx].attachments);
            // Preserve the optimistic reply_to until/unless the authoritative
            // message brings its own, so the reply preview never flickers out.
            updated[pendingIdx] = {
              ...updated[pendingIdx],
              ...incomingMsg,
              reply_to: incomingMsg.reply_to ?? updated[pendingIdx].reply_to,
              tempId: undefined,
              uploading: false,
            };
            return updated;
          }
        }

        const belongsToChat =
          activeConversation &&
          activeConversation.conversation_id != null &&
          String(incomingMsg.conversation_id) === String(activeConversation.conversation_id);
        return belongsToChat ? [...arr, incomingMsg] : arr;
      });

      attachmentsToRevoke.forEach((att) => {
        if (att.attachment_url) revokeObjectUrl(att.attachment_url);
      });

      if (currentUser?.user_id && !isOwnMessage) {
        socket.emit("message_delivered", {
          messageId: incomingMsg.message_id,
          senderId:  incomingMsg.sender_id,
        });
      }

      setConversations((prev) =>
        safeArray(prev).map((c) => {
          if (String(c.conversation_id) !== String(incomingMsg.conversation_id)) return c;
          const isActive =
            activeConversation &&
            String(c.conversation_id) === String(activeConversation.conversation_id);
          return {
            ...c,
            last_message:      incomingMsg.message || buildAttachmentPreviewText(incomingMsg.attachments),
            last_message_time: incomingMsg.sent_at ?? incomingMsg.created_at,
            unread_count:      isActive || isOwnMessage ? 0 : (c.unread_count ?? 0) + 1,
          };
        })
      );
    };

    socket.on("receive_message", handleReceiveMessage);
    return () => socket.off("receive_message", handleReceiveMessage);
  }, [currentUser?.user_id, revokeObjectUrl]);

  // Read receipts
  useEffect(() => {
    if (!socket || !selectedConversation || !currentUser) return;
    safeArray(messages).forEach((msg) => {
      if (
        String(msg.sender_id) !== String(currentUser.user_id) &&
        !msg.is_read &&
        msg.message_id
      ) {
        socket.emit("message_seen", { messageId: msg.message_id, senderId: msg.sender_id });
      }
    });
  }, [messages, selectedConversation, currentUser]);

  // Conversations + Consultation Contacts
  const fetchConversations = useCallback(async () => {
    try {
      const [conversationsRes, contactsRes] = await Promise.all([
        api.get("/messages/conversations"),
        api.get("/messages/contacts"),
      ]);

      const conversationsData = Array.isArray(conversationsRes?.data?.conversations)
        ? conversationsRes.data.conversations
        : Array.isArray(conversationsRes?.data?.contacts)
          ? conversationsRes.data.contacts
          : Array.isArray(conversationsRes?.data)
            ? conversationsRes.data
            : [];

      const contactsData = Array.isArray(contactsRes?.data?.contacts)
        ? contactsRes.data.contacts
        : Array.isArray(contactsRes?.data?.conversations)
          ? contactsRes.data.conversations
          : Array.isArray(contactsRes?.data)
            ? contactsRes.data
            : [];

      const merged = mergeConversationsAndContacts(conversationsData, contactsData);

      setConversations(merged);
      return merged;
    } catch (err) {
      console.error("Failed to load conversations:", err);
      setConversations([]);
      return [];
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Messages
  const fetchMessages = useCallback(async (conversationId, requestId) => {
    const isCurrent = () => requestId === undefined || requestId === latestRequestIdRef.current;

    setLoading(true);
    try {
      const res = await api.get(`/messages/conversations/${conversationId}/messages`);
      if (!isCurrent()) return;
      setMessages(safeArray(res?.data?.messages));
    } catch (err) {
      console.error("Failed to load messages:", err);
      if (isCurrent()) setMessages([]);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  // Read
  const markRead = useCallback(async (conversationId) => {
    try {
      await api.put(`/messages/conversations/${conversationId}/read`);
      setConversations((prev) =>
        safeArray(prev).map((c) =>
          String(c.conversation_id) === String(conversationId) ? { ...c, unread_count: 0 } : c
        )
      );
    } catch (err) {
      console.error("Failed to mark messages as read:", err);
    }
  }, []);

  // Lazy create
  const ensureConversation = useCallback(async (contact) => {
    if (contact.conversation_id) return contact;

    try {
      const res   = await api.post("/messages/private", { user_id: contact.user_id });
      const newId = res?.data?.conversation_id;
      if (!newId) return contact;

      const updated = { ...contact, conversation_id: newId };

      setConversations((prev) =>
        safeArray(prev).map((c) =>
          c.conversation_id == null && String(c.user_id) === String(contact.user_id)
            ? { ...c, conversation_id: newId }
            : c
        )
      );

      socket.emit("join_conversation", newId);

      return updated;
    } catch (err) {
      console.error("Failed to create conversation:", err);
      return contact;
    }
  }, []);

  // Selection
  const handleSelectConversation = useCallback(async (conversation) => {
    const previous = selectedConversationRef.current;

    if (isSameContact(previous, conversation)) {
      setShowChat(true);
      return;
    }

    if (pollingRef.current) clearInterval(pollingRef.current);

    if (previous?.conversation_id != null) {
      socket.emit("leave_conversation", previous.conversation_id);
    }

    setSelectedConversation(conversation);
    setMessages([]);
    setShowChat(true);
    setReplyingTo(null);

    if (conversation.conversation_id == null) return;

    const requestId = ++latestRequestIdRef.current;

    socket.emit("join_conversation", conversation.conversation_id);

    await fetchMessages(conversation.conversation_id, requestId);

    if (requestId !== latestRequestIdRef.current) return;

    await markRead(conversation.conversation_id);
  }, [fetchMessages, markRead]);

  // Back
  const handleBack = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    const current = selectedConversationRef.current;
    if (current?.conversation_id != null) {
      socket.emit("leave_conversation", current.conversation_id);
    }

    setSelectedConversation(null);
    setShowChat(false);
  }, []);

  // Reply Handlers
  const handleReply = useCallback((message) => {
    setReplyingTo(message);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  // Deep links
  useEffect(() => {
    if (autoOpenRef.current) return;
    if (!targetConversationParam && !targetUserParam) return;
    if (conversations.length === 0) return;

    let target = null;
    if (targetConversationParam) {
      target = conversations.find(
        (c) => String(c.conversation_id) === String(targetConversationParam)
      );
    } else if (targetUserParam) {
      target = conversations.find(
        (c) => String(c.user_id) === String(targetUserParam)
      );
    }

    if (target) {
      autoOpenRef.current = true;
      handleSelectConversation(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetConversationParam, targetUserParam, conversations]);

  // Context
  useEffect(() => {
    const contextParams = new URLSearchParams(location.search);
    const logId        = contextParams.get("log");
    const narrativeId  = contextParams.get("narrative");

    if (!(logId || narrativeId)) return;
    if (conversations.length === 0) return;
    if (contextSentRef.current) return;

    const coordinator = findCoordinator(conversations);
    if (!coordinator) return;

    const sendContextAndOpen = async () => {
      contextSentRef.current = true;
      const date          = contextParams.get("date");
      const systemMessage = logId
        ? `Student opened a discussion regarding Daily Log (${date || logId}).`
        : `Student opened a discussion regarding Narrative Entry (${date || narrativeId}).`;

      const activeCoordinator = await ensureConversation(coordinator);

      try {
        await api.post("/messages/messages", {
          conversation_id: activeCoordinator.conversation_id,
          message:         systemMessage,
          message_type:    "system",
          ...(logId       ? { related_log_id:       Number(logId)       } : {}),
          ...(narrativeId ? { related_narrative_id: Number(narrativeId) } : {}),
        });
      } catch (err) {
        console.error("Failed to send consultation context message:", err);
      }
      await handleSelectConversation(activeCoordinator);
    };

    sendContextAndOpen();
  }, [location.search, conversations, handleSelectConversation, ensureConversation]);

  // Academic Year
  useEffect(() => {
    const handleAcademicYearChanged = async () => {
      if (pollingRef.current) clearInterval(pollingRef.current);

      setConversationsLoading(true);

      const freshContacts = await fetchConversations();

      const currentSelected = selectedConversationRef.current;

      if (!currentSelected) {
        setMessages([]);
        return;
      }

      const matched = freshContacts.find((c) => isSameContact(currentSelected, c));

      if (!matched) {
        if (currentSelected.conversation_id != null) {
          socket.emit("leave_conversation", currentSelected.conversation_id);
        }
        setSelectedConversation(null);
        setMessages([]);
        setShowChat(false);
        return;
      }

      if (matched.conversation_id != null) {
        setSelectedConversation(matched);
        const requestId = ++latestRequestIdRef.current;
        await fetchMessages(matched.conversation_id, requestId);
        if (requestId !== latestRequestIdRef.current) return;
        await markRead(matched.conversation_id);
      } else {
        setSelectedConversation(matched);
        setMessages([]);
      }
    };

    window.addEventListener("academicYearChanged", handleAcademicYearChanged);
    return () => {
      window.removeEventListener("academicYearChanged", handleAcademicYearChanged);
    };
  }, [fetchConversations, fetchMessages, markRead]);

  // Sending
  const handleSend = useCallback(async (message, attachments, reply) => {
    const files = safeArray(attachments);
    const hasText = !!message?.trim();
    const hasAttachments = files.length > 0;

    if (!selectedConversation || (!hasText && !hasAttachments)) return;

    let activeConversation = selectedConversation;

    if (activeConversation.conversation_id == null) {
      activeConversation = await ensureConversation(activeConversation);
      if (activeConversation.conversation_id == null) return;
      setSelectedConversation(activeConversation);
    }

    const tempId = generateTempId();

    const tempAttachments = files.map((file) => {
      let previewUrl = null;
      if (file.type?.startsWith("image/")) {
        previewUrl = URL.createObjectURL(file);
        objectUrlsRef.current.add(previewUrl);
      }
      return {
        attachment_name: file.name,
        attachment_url:  previewUrl,
        attachment_type: file.type,
        attachment_size: file.size,
        uploading:       true,
      };
    });

    const optimistic = {
      tempId,
      message_id:      null,
      conversation_id: activeConversation.conversation_id,
      sender_id:       currentUser?.user_id,
      message:         message || "",
      created_at:      new Date().toISOString(),
      sent_at:         new Date().toISOString(),
      is_read:         false,
      delivered:       false,
      ...(hasAttachments ? { attachments: tempAttachments } : {}),
      // Lets the reply preview render immediately, ahead of server confirmation.
      ...(reply ? { reply_to: reply } : {}),
    };

    setMessages((prev) => [...safeArray(prev), optimistic]);
    setConversations((prev) =>
      safeArray(prev).map((c) =>
        String(c.conversation_id) === String(activeConversation.conversation_id)
          ? {
              ...c,
              last_message:      message || buildAttachmentPreviewText(tempAttachments),
              last_message_time: optimistic.sent_at,
            }
          : c
      )
    );

    const revokeTempAttachments = () => {
      tempAttachments.forEach((att) => revokeObjectUrl(att.attachment_url));
    };

    try {
      const formData = new FormData();
      formData.append("conversation_id", activeConversation.conversation_id);
      formData.append("message", message || "");
      if (reply) {
        formData.append("reply_to_message_id", reply.message_id);
      }
      files.forEach((file) => {
        formData.append("attachments", file);
      });

      const res  = await api.post("/messages/messages", formData);
      const sent = res?.data?.data;

      revokeTempAttachments();

      if (sent) {
        setMessages((prev) =>
          safeArray(prev).map((m) =>
            m.tempId === tempId
              ? { ...m, ...sent, reply_to: sent.reply_to ?? m.reply_to, tempId: undefined, uploading: false }
              : m
          )
        );
      }

      // Reply only clears once the send actually succeeds.
      if (reply) setReplyingTo(null);
    } catch (err) {
      console.error("Failed to send message:", err);
      revokeTempAttachments();
      setMessages((prev) => safeArray(prev).filter((m) => m.tempId !== tempId));
      // Leave replyingTo untouched so the user can retry the same reply.
    }
  }, [selectedConversation, currentUser, ensureConversation, revokeObjectUrl]);

  // Polling
  useEffect(() => {
    if (!selectedConversation || selectedConversation.conversation_id == null) return;
    const poll = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const res      = await api.get(`/messages/conversations/${selectedConversation.conversation_id}/messages`);
        const incoming = safeArray(res?.data?.messages);
        setMessages((prev) => {
          const prevIds = safeArray(prev).map((m) => m.message_id).join(",");
          const nextIds = incoming.map((m) => m.message_id).join(",");
          return prevIds === nextIds ? prev : incoming;
        });
      } catch { /* silent */ }
    };
    pollingRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollingRef.current);
  }, [selectedConversation]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (selectedConversationRef.current?.conversation_id != null) {
        socket.emit("leave_conversation", selectedConversationRef.current.conversation_id);
      }
    };
  }, []);

  const isSelectedConversationOnline = useMemo(() => {
    if (!selectedConversation || selectedConversation.is_group) return false;
    return onlineUsers.includes(selectedConversation.user_id);
  }, [selectedConversation, onlineUsers]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading messages...</p>
      </div>
    );
  }

  if (!currentUser) return null;

  // Render
  return (
    <div
      className="flex h-full bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100"
      style={{ minHeight: "calc(100vh - 120px)", fontFamily: "inherit" }}
    >
      <div className={`w-full md:w-64 lg:w-72 shrink-0 flex flex-col h-full ${showChat ? "hidden md:flex" : "flex"}`}>
        {conversationsLoading ? (
          <div className="flex-1 flex items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-6 h-6 rounded-full animate-spin"
                style={{
                  border:           '2px solid #e5e7eb',
                  borderTopColor:   `rgb(var(--primary-600))`,
                }}
              />
              <p className="text-xs text-gray-400">Loading consultations…</p>
            </div>
          </div>
        ) : (
          <ConversationList
            conversations={safeArray(conversations)}
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
            currentUserId={currentUser?.user_id}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}
      </div>

      <div className={`flex-1 flex flex-col h-full min-w-0 ${showChat ? "flex" : "hidden md:flex"}`}>
        <ChatWindow
          selectedConversation={selectedConversation}
          messages={safeArray(messages)}
          currentUserId={currentUser?.user_id}
          onSend={handleSend}
          loading={loading}
          onBack={handleBack}
          socket={socket}
          isOnline={isSelectedConversationOnline}
          replyingTo={replyingTo}
          onReply={handleReply}
          onCancelReply={handleCancelReply}
        />
      </div>
    </div>
  );
}