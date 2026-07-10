import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import socket from "../../socket";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import ConversationList from "../../components/messages/ConversationList";
import ChatWindow from "../../components/messages/ChatWindow";

const safeArray = (value) => (Array.isArray(value) ? value : []);

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

  const pollingRef              = useRef(null);
  const autoOpenRef             = useRef(false);
  const contextSentRef          = useRef(false);
  const selectedConversationRef = useRef(null);
  const latestRequestIdRef      = useRef(0);

  const location = useLocation();

  const params               = new URLSearchParams(location.search);
  const targetConversationId = params.get("conversation") || params.get("user");

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // ─── Socket: connect & join user room on auth ─────────────────────────────
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

  // ─── Socket: receive_message handler (conversation-scoped) ───────────────
  useEffect(() => {
    const handleReceiveMessage = (incomingMsg) => {
      const activeConversation = selectedConversationRef.current;
      const isOwnMessage = String(incomingMsg.sender_id) === String(currentUser?.user_id);

      setMessages((prev) => {
        const arr = safeArray(prev);

        // Already reconciled (duplicate emit, or arrived twice)
        if (incomingMsg.message_id && arr.some((m) => m.message_id === incomingMsg.message_id)) {
          return arr;
        }

        // Reconcile our own optimistic message instead of appending a duplicate
        if (isOwnMessage) {
          const pendingIdx = arr.findIndex(
            (m) =>
              m.tempId &&
              !m.message_id &&
              String(m.conversation_id) === String(incomingMsg.conversation_id) &&
              m.message === incomingMsg.message
          );
          if (pendingIdx !== -1) {
            const updated = [...arr];
            updated[pendingIdx] = { ...updated[pendingIdx], ...incomingMsg, tempId: undefined };
            return updated;
          }
        }

        const belongsToChat =
          activeConversation &&
          String(incomingMsg.conversation_id) === String(activeConversation.conversation_id);
        return belongsToChat ? [...arr, incomingMsg] : arr;
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
            last_message:      incomingMsg.message,
            last_message_time: incomingMsg.sent_at ?? incomingMsg.created_at,
            unread_count:      isActive || isOwnMessage ? 0 : (c.unread_count ?? 0) + 1,
          };
        })
      );
    };

    socket.on("receive_message", handleReceiveMessage);
    return () => socket.off("receive_message", handleReceiveMessage);
  }, [currentUser?.user_id]);

  // ─── Emit message_seen for unread messages in active conversation ─────────
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

  // ─── Fetch conversation list ────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get("/messages/conversations");

      const data =
        res?.data?.conversations && Array.isArray(res.data.conversations)
          ? res.data.conversations
          : Array.isArray(res?.data)
            ? res.data
            : [];

      setConversations(data);
      return data;
    } catch (err) {
      console.error("Failed to load conversations:", err);
      setConversations([]);
      return [];
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // ─── Fetch messages for a conversation ─────────────────────────────────────
  // Accepts an optional requestId so a slow/out-of-order response from a
  // conversation the user has since navigated away from can't clobber newer state.
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

  // ─── Mark as read ────────────────────────────────────────────────────────────
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

  // ─── Select conversation ─────────────────────────────────────────────────────
  const handleSelectConversation = useCallback(async (conversation) => {
    const previous = selectedConversationRef.current;

    // Re-selecting the already-open conversation (e.g. clicking it again on
    // mobile) — just ensure the chat pane is visible, skip redundant work.
    if (previous && String(previous.conversation_id) === String(conversation.conversation_id)) {
      setShowChat(true);
      return;
    }

    if (pollingRef.current) clearInterval(pollingRef.current);

    const requestId = ++latestRequestIdRef.current;

    if (previous) {
      socket.emit("leave_conversation", previous.conversation_id);
    }

    setSelectedConversation(conversation);
    setMessages([]);
    setShowChat(true);

    socket.emit("join_conversation", conversation.conversation_id);

    await fetchMessages(conversation.conversation_id, requestId);

    // If the user navigated to a different conversation while this fetch was
    // in flight, don't mark the now-stale conversation as read.
    if (requestId !== latestRequestIdRef.current) return;

    await markRead(conversation.conversation_id);
  }, [fetchMessages, markRead]);

  // ─── Mobile back button ─────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    const current = selectedConversationRef.current;
    if (current) {
      socket.emit("leave_conversation", current.conversation_id);
    }

    setSelectedConversation(null);
    setShowChat(false);
  }, []);

  // ─── Auto-select conversation from notification link (?conversation=<id>) ──
  useEffect(() => {
    if (autoOpenRef.current) return;
    if (!targetConversationId || conversations.length === 0) return;
    const target = conversations.find(
      (c) => String(c.conversation_id) === String(targetConversationId)
    );
    if (target) {
      autoOpenRef.current = true;
      handleSelectConversation(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetConversationId, conversations]);

  // ─── Auto-select coordinator + send context message ─────────────────────────
  useEffect(() => {
    const contextParams = new URLSearchParams(location.search);
    const logId        = contextParams.get("log");
    const narrativeId  = contextParams.get("narrative");

    if (!(logId || narrativeId)) return;
    if (conversations.length === 0) return;
    if (contextSentRef.current) return;

    const coordinator = conversations[0];

    const sendContextAndOpen = async () => {
      contextSentRef.current = true;
      const date          = contextParams.get("date");
      const systemMessage = logId
        ? `Student opened a discussion regarding Daily Log (${date || logId}).`
        : `Student opened a discussion regarding Narrative Entry (${date || narrativeId}).`;
      try {
        await api.post("/messages/messages", {
          conversation_id: coordinator.conversation_id,
          message:         systemMessage,
          message_type:    "system",
          ...(logId       ? { related_log_id:       Number(logId)       } : {}),
          ...(narrativeId ? { related_narrative_id: Number(narrativeId) } : {}),
        });
      } catch (err) {
        console.error("Failed to send consultation context message:", err);
      }
      await handleSelectConversation(coordinator);
    };

    sendContextAndOpen();
  }, [location.search, conversations, handleSelectConversation]);

  // ─── Academic Year change handler ────────────────────────────────────────────
  useEffect(() => {
    const handleAcademicYearChanged = async () => {
      // Stop any active polling while we refresh
      if (pollingRef.current) clearInterval(pollingRef.current);

      setConversationsLoading(true);

      // Reload conversation list and get the fresh data back
      const freshConversations = await fetchConversations();

      const currentSelected = selectedConversationRef.current;

      if (!currentSelected) {
        // No active conversation — just clear messages to be clean
        setMessages([]);
        return;
      }

      // Check if the selected conversation still exists in the new Academic Year
      const stillExists = freshConversations.some(
        (c) => String(c.conversation_id) === String(currentSelected.conversation_id)
      );

      if (stillExists) {
        // Re-fetch messages for the still-valid conversation
        const requestId = ++latestRequestIdRef.current;
        await fetchMessages(currentSelected.conversation_id, requestId);
        if (requestId !== latestRequestIdRef.current) return;
        await markRead(currentSelected.conversation_id);
      } else {
        // Selected conversation is no longer part of this Academic Year — close the chat
        if (pollingRef.current) clearInterval(pollingRef.current);
        socket.emit("leave_conversation", currentSelected.conversation_id);
        setSelectedConversation(null);
        setMessages([]);
        setShowChat(false);
      }
    };

    window.addEventListener("academicYearChanged", handleAcademicYearChanged);
    return () => {
      window.removeEventListener("academicYearChanged", handleAcademicYearChanged);
    };
  }, [fetchConversations, fetchMessages, markRead]);

  // ─── Send message ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (message) => {
    if (!selectedConversation || !message?.trim()) return;

    const tempId     = `temp-${Date.now()}`;
    const optimistic = {
      tempId,
      message_id:      null,
      conversation_id: selectedConversation.conversation_id,
      sender_id:       currentUser?.user_id,
      message,
      created_at:      new Date().toISOString(),
      sent_at:         new Date().toISOString(),
      is_read:         false,
      delivered:       false,
    };

    setMessages((prev) => [...safeArray(prev), optimistic]);
    setConversations((prev) =>
      safeArray(prev).map((c) =>
        String(c.conversation_id) === String(selectedConversation.conversation_id)
          ? { ...c, last_message: message, last_message_time: optimistic.sent_at }
          : c
      )
    );

    try {
      const res  = await api.post("/messages/messages", {
        conversation_id: selectedConversation.conversation_id,
        message,
      });
      const sent = res?.data?.data;

      // The backend broadcasts "receive_message" to conversation participants
      // (including the sender) right after persisting — reconciliation of this
      // optimistic entry happens there. We only patch local state here as a
      // fallback in case the socket event is delayed or missed, without
      // re-emitting anything ourselves (that would create a duplicate event).
      if (sent) {
        setMessages((prev) =>
          safeArray(prev).map((m) =>
            m.tempId === tempId ? { ...m, ...sent, tempId: undefined } : m
          )
        );
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages((prev) => safeArray(prev).filter((m) => m.tempId !== tempId));
    }
  }, [selectedConversation, currentUser]);

  // ─── Poll for new messages every 5s (fallback) ──────────────────────────────
  useEffect(() => {
    if (!selectedConversation) return;
    const poll = async () => {
      // Skip while the tab isn't visible — Socket.IO still delivers real-time
      // updates in the background, and the next poll picks up any gap once
      // the tab is visible again. Pure network-usage optimization, no
      // change to reconciliation behavior.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const res      = await api.get(`/messages/conversations/${selectedConversation.conversation_id}/messages`);
        const incoming = safeArray(res?.data?.messages);
        setMessages((prev) => {
          const prevIds = safeArray(prev).map((m) => m.message_id).join(",");
          const nextIds = incoming.map((m) => m.message_id).join(",");
          return prevIds === nextIds ? prev : incoming;
        });
      } catch { /* silent — socket will carry the load */ }
    };
    pollingRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollingRef.current);
  }, [selectedConversation]);

  // ─── Cleanup polling + conversation room membership on unmount ─────────────
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (selectedConversationRef.current) {
        socket.emit("leave_conversation", selectedConversationRef.current.conversation_id);
      }
    };
  }, []);

  // Online status only applies to private (1:1) conversations, where the
  // conversation record carries the other participant's user_id. Group
  // conversations have no single counterpart to key off, so we default to
  // false rather than matching against an arbitrary/undefined id.
  const isSelectedConversationOnline = useMemo(() => {
    if (!selectedConversation || selectedConversation.is_group) return false;
    return onlineUsers.includes(selectedConversation.user_id);
  }, [selectedConversation, onlineUsers]);

  // ─── Auth guards ──────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading messages...</p>
      </div>
    );
  }

  if (!currentUser) return null;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-full bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100"
      style={{ minHeight: "calc(100vh - 120px)", fontFamily: "inherit" }}
    >
      {/* Left: Conversation list */}
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

      {/* Right: Chat window */}
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
        />
      </div>
    </div>
  );
}