import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import socket from "../../socket";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import ConversationList from "../../components/messages/ConversationList";
import ChatWindow from "../../components/messages/ChatWindow";

export default function MessagesPage() {
  const { user: currentUser, loading: authLoading } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  const pollingRef       = useRef(null);
  const autoOpenRef      = useRef(false);
  const contextSentRef   = useRef(false);
  const selectedUserRef  = useRef(null);

  const location = useLocation();

  const params       = new URLSearchParams(location.search);
  const targetUserId = params.get("user");

  const safeArray = (value) => (Array.isArray(value) ? value : []);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // ─── Socket: connect & join room on auth ──────────────────────────────────
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

  // ─── Socket: receive_message handler ──────────────────────────────────────
  useEffect(() => {
    const handleReceiveMessage = (incomingMsg) => {
      const activeUser = selectedUserRef.current;

      setMessages((prev) => {
        const exists = safeArray(prev).some((m) => m.message_id === incomingMsg.message_id);
        if (exists) return prev;
        const belongsToChat =
          activeUser &&
          (String(incomingMsg.sender_id)   === String(activeUser.user_id) ||
           String(incomingMsg.receiver_id) === String(activeUser.user_id));
        return belongsToChat ? [...prev, incomingMsg] : prev;
      });

      if (
        currentUser?.user_id &&
        String(incomingMsg.receiver_id) === String(currentUser.user_id)
      ) {
        socket.emit("message_delivered", {
          messageId: incomingMsg.message_id,
          senderId:  incomingMsg.sender_id,
        });
      }

      setConversations((prev) =>
        safeArray(prev).map((c) => {
          const isRelevant =
            String(c.user_id) === String(incomingMsg.sender_id) ||
            String(c.user_id) === String(incomingMsg.receiver_id);
          if (!isRelevant) return c;
          return {
            ...c,
            last_message:      incomingMsg.message,
            last_message_time: incomingMsg.sent_at ?? incomingMsg.created_at,
            unread_count:
              activeUser && String(c.user_id) === String(incomingMsg.sender_id)
                ? 0
                : (c.unread_count ?? 0) + 1,
          };
        })
      );
    };

    socket.on("receive_message", handleReceiveMessage);
    return () => socket.off("receive_message", handleReceiveMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Emit message_seen for unread messages in active conversation ──────────
  useEffect(() => {
    if (!socket || !selectedUser || !currentUser) return;
    safeArray(messages).forEach((msg) => {
      if (
        String(msg.sender_id) === String(selectedUser.user_id) &&
        !msg.is_read &&
        msg.message_id
      ) {
        socket.emit("message_seen", { messageId: msg.message_id, senderId: msg.sender_id });
      }
    });
  }, [messages, selectedUser, currentUser]);

  // ─── Fetch contact list ───────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res  = await api.get("/messages/conversations");
      const data =
        res?.data?.conversations && Array.isArray(res.data.conversations)
          ? res.data.conversations
          : Array.isArray(res?.data)
            ? res.data
            : [];
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
      setConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // ─── Fetch messages ───────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (userId) => {
    setLoading(true);
    try {
      const res = await api.get(`/messages/conversation/${userId}`);
      setMessages(safeArray(res?.data));
    } catch (err) {
      console.error("Failed to load messages:", err);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Mark as read ─────────────────────────────────────────────────────────
  const markRead = useCallback(async (userId) => {
    try {
      await api.put(`/messages/read/${userId}`);
      setConversations((prev) =>
        safeArray(prev).map((c) => c.user_id === userId ? { ...c, unread_count: 0 } : c)
      );
    } catch (err) {
      console.error("Failed to mark messages as read:", err);
    }
  }, []);

  // ─── Select user ──────────────────────────────────────────────────────────
  const handleSelectUser = useCallback(async (user) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setSelectedUser(user);
    setMessages([]);
    setShowChat(true);
    await fetchMessages(user.user_id);
    await markRead(user.user_id);
  }, [fetchMessages, markRead]);

  // ─── Mobile back button ───────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    setShowChat(false);
    if (pollingRef.current) clearInterval(pollingRef.current);
  }, []);

  // ─── Auto-select user from notification link (?user=<id>) ─────────────────
  useEffect(() => {
    if (autoOpenRef.current) return;
    if (!targetUserId || conversations.length === 0) return;
    const target = conversations.find((c) => String(c.user_id) === String(targetUserId));
    if (target) { autoOpenRef.current = true; handleSelectUser(target); }
  }, [targetUserId, conversations, handleSelectUser]);

  // ─── Auto-select coordinator + send context message ───────────────────────
  useEffect(() => {
    const params      = new URLSearchParams(location.search);
    const logId       = params.get("log");
    const narrativeId = params.get("narrative");

    if (!(logId || narrativeId)) return;
    if (conversations.length === 0) return;
    if (contextSentRef.current) return;

    const coordinator = conversations[0];

    const sendContextAndOpen = async () => {
      contextSentRef.current = true;
      const date          = params.get("date");
      const systemMessage = logId
        ? `Student opened a discussion regarding Daily Log (${date || logId}).`
        : `Student opened a discussion regarding Narrative Entry (${date || narrativeId}).`;
      try {
        await api.post("/messages/send", {
          receiver_id: coordinator.user_id,
          message:     systemMessage,
          message_type: "system",
          ...(logId       ? { related_log_id:       Number(logId)       } : {}),
          ...(narrativeId ? { related_narrative_id: Number(narrativeId) } : {}),
        });
      } catch (err) {
        console.error("Failed to send consultation context message:", err);
      }
      await handleSelectUser(coordinator);
    };

    sendContextAndOpen();
  }, [location.search, conversations, handleSelectUser]);

  // ─── Send message ─────────────────────────────────────────────────────────
  const handleSend = useCallback(async (message) => {
    if (!selectedUser || !message?.trim()) return;

    const tempId     = `temp-${Date.now()}`;
    const optimistic = {
      tempId,
      message_id:  null,
      sender_id:   currentUser?.user_id,
      receiver_id: selectedUser.user_id,
      message,
      created_at:  new Date().toISOString(),
      sent_at:     new Date().toISOString(),
      is_read:     false,
      delivered:   false,
    };

    setMessages((prev) => [...safeArray(prev), optimistic]);
    setConversations((prev) =>
      safeArray(prev).map((c) =>
        c.user_id === selectedUser.user_id
          ? { ...c, last_message: message, last_message_time: optimistic.sent_at }
          : c
      )
    );

    try {
      const res = await api.post("/messages/send", {
        receiver_id: selectedUser.user_id,
        message,
      });
      setMessages((prev) =>
        safeArray(prev).map((m) =>
          m.tempId === tempId ? { ...m, ...res.data, tempId: undefined } : m
        )
      );
      socket.emit("send_message", res.data);
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages((prev) => safeArray(prev).filter((m) => m.tempId !== tempId));
    }
  }, [selectedUser, currentUser]);

  // ─── Poll for new messages every 5s (fallback) ────────────────────────────
  useEffect(() => {
    if (!selectedUser) return;
    const poll = async () => {
      try {
        const res      = await api.get(`/messages/conversation/${selectedUser.user_id}`);
        const incoming = safeArray(res?.data);
        setMessages((prev) => {
          const prevIds = safeArray(prev).map((m) => m.message_id).join(",");
          const nextIds = incoming.map((m) => m.message_id).join(",");
          return prevIds === nextIds ? prev : incoming;
        });
      } catch { /* silent — socket will carry the load */ }
    };
    pollingRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollingRef.current);
  }, [selectedUser]);

  // ─── Cleanup polling on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  // ─── Auth guards ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading messages...</p>
      </div>
    );
  }

  if (!currentUser) return null;

  // ─── Render ───────────────────────────────────────────────────────────────
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
              {/* Spinner uses CSS var for the active border colour */}
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
            selectedUser={selectedUser}
            onSelectUser={handleSelectUser}
            currentUserId={currentUser?.user_id}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}
      </div>

      {/* Right: Chat window */}
      <div className={`flex-1 flex flex-col h-full min-w-0 ${showChat ? "flex" : "hidden md:flex"}`}>
        <ChatWindow
          selectedUser={selectedUser}
          messages={safeArray(messages)}
          currentUserId={currentUser?.user_id}
          onSend={handleSend}
          loading={loading}
          onBack={handleBack}
          socket={socket}
          isOnline={onlineUsers.includes(selectedUser?.user_id)}
        />
      </div>
    </div>
  );
}