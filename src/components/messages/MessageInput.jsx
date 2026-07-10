import { useState, useRef, useEffect, useCallback } from "react";
import { Send } from "lucide-react";

const TYPING_TIMEOUT_MS = 1200;

export default function MessageInput({ onSend, disabled, socket, conversationId }) {
  const [value, setValue] = useState("");
  const textareaRef       = useRef(null);
  const isSendingRef      = useRef(false);
  const typingTimeoutRef  = useRef(null);
  const isTypingRef       = useRef(false);

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  const clearTypingTimeout = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  const emitStopTyping = useCallback(() => {
    if (isTypingRef.current && socket && conversationId) {
      socket.emit("stop_typing", { conversationId });
    }
    isTypingRef.current = false;
  }, [socket, conversationId]);

  // Clear timers and notify stop_typing on unmount to avoid leaking a
  // "typing" state on the server after the component disappears.
  useEffect(() => {
    return () => {
      clearTypingTimeout();
      emitStopTyping();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isSendingRef.current) return;

    isSendingRef.current = true;
    clearTypingTimeout();
    emitStopTyping();

    setValue("");
    resetHeight();

    try {
      await onSend(trimmed);
    } finally {
      isSendingRef.current = false;
      textareaRef.current?.focus();
    }
  }, [value, disabled, onSend, clearTypingTimeout, emitStopTyping]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    setValue(newValue);

    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
    }

    if (!socket || !conversationId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
    }
    socket.emit("typing", { conversationId });

    clearTypingTimeout();
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", { conversationId });
      isTypingRef.current = false;
    }, TYPING_TIMEOUT_MS);
  };

  const canSend = !!value.trim() && !disabled;

  return (
    <div className="border-t border-gray-100 bg-white">
      {/* Context hint */}
      <div className="px-4 pt-2 pb-0">
        <p className="text-[10px] text-gray-400">
          Use this thread to discuss OJT concerns, daily narratives, or feedback.{" "}
          Press{" "}
          <kbd className="px-1 py-0.5 rounded bg-gray-100 text-gray-500 font-mono text-[9px]">Enter</kbd>{" "}
          to send.
        </p>
      </div>

      <div className="flex items-end gap-2 px-3 py-2.5">
        {/* Textarea — focus ring uses CSS var */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type a message…"
          aria-label="Message"
          className="flex-1 resize-none border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 placeholder-gray-400 leading-relaxed bg-gray-50 outline-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: "38px", maxHeight: "100px" }}
          onFocus={e => {
            e.target.style.boxShadow  = `0 0 0 2px rgb(var(--primary-400))`;
            e.target.style.borderColor = 'transparent';
            e.target.style.backgroundColor = 'white';
          }}
          onBlur={e => {
            e.target.style.boxShadow  = 'none';
            e.target.style.borderColor = '#e5e7eb';
            e.target.style.backgroundColor = '#f9fafb';
          }}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl shadow-sm transition-all duration-150 active:scale-90"
          style={{
            backgroundColor: `rgb(var(--primary-700))`,
            color: 'white',
            opacity: canSend ? 1 : 0.3,
            cursor: canSend ? 'pointer' : 'not-allowed',
          }}
          onMouseEnter={e => { if (canSend) { e.currentTarget.style.backgroundColor = `rgb(var(--primary-800))`; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'; } }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = `rgb(var(--primary-700))`; e.currentTarget.style.boxShadow = ''; }}
          title="Send (Enter)"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}