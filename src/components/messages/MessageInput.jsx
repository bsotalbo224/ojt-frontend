import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

export default function MessageInput({ onSend, disabled, socket, receiverId }) {
  const [value, setValue] = useState("");
  const textareaRef       = useRef(null);
  const isSending         = useRef(false);
  const typingTimeoutRef  = useRef(null);

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  useEffect(() => {
    return () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); };
  }, []);

  const resetHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isSending.current) return;
    isSending.current = true;

    if (socket && receiverId) socket.emit("stop_typing", { to: receiverId });

    onSend(trimmed);
    setValue("");
    resetHeight();
    setTimeout(() => { isSending.current = false; textareaRef.current?.focus(); }, 100);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    setValue(newValue);

    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 100) + "px"; }

    if (!socket || !receiverId) return;

    socket.emit("typing", { to: receiverId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", { to: receiverId });
    }, 1200);
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
          onClick={handleSend}
          disabled={!canSend}
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
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}