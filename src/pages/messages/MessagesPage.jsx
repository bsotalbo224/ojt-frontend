import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import socket from "../../socket";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import ConversationList from "../../components/messages/ConversationList";
import ChatWindow from "../../components/messages/ChatWindow";

const safeArray = (value) => (Array.isArray(value) ? value : []);

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

  const params                  = new URLSearchParams(location.search);
  const targetConversationParam = params.get("conversation");
  const targetUserParam         = params.get("user");

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

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
          activeConversation.conversation_id != null &&
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

  // Contacts
  const fetchContacts = useCallback(async () => {
    try {
      const res = await api.get("/messages/contacts");

      const data = Array.isArray(res?.data?.contacts)
        ? res.data.contacts
        : Array.isArray(res?.data?.conversations)
          ? res.data.conversations
          : Array.isArray(res?.data)
            ? res.data
            : [];

      setConversations(data);
      return data;
    } catch (err) {
      console.error("Failed to load contacts:", err);
      setConversations([]);
      return [];
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

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

      const freshContacts = await fetchContacts();

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
  }, [fetchContacts, fetchMessages, markRead]);

  // Send
  const handleSend = useCallback(async (message) => {
    if (!selectedConversation || !message?.trim()) return;

    let activeConversation = selectedConversation;

    if (activeConversation.conversation_id == null) {
      activeConversation = await ensureConversation(activeConversation);
      if (activeConversation.conversation_id == null) return;
      setSelectedConversation(activeConversation);
    }

    const tempId     = `temp-${Date.now()}`;
    const optimistic = {
      tempId,
      message_id:      null,
      conversation_id: activeConversation.conversation_id,
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
        String(c.conversation_id) === String(activeConversation.conversation_id)
          ? { ...c, last_message: message, last_message_time: optimistic.sent_at }
          : c
      )
    );

    try {
      const res  = await api.post("/messages/messages", {
        conversation_id: activeConversation.conversation_id,
        message,
      });
      const sent = res?.data?.data;

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
  }, [selectedConversation, currentUser, ensureConversation]);

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
        />
      </div>
    </div>
  );
}