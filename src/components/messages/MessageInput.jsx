import { useState, useRef, useEffect, useCallback } from "react";
import {
  SendHorizontal,
  Paperclip,
  X,
  FileText,
  Image,
  FileArchive,
  FileSpreadsheet,
  FileCode,
  File as FileIcon,
} from "lucide-react";

const TYPING_TIMEOUT_MS = 1200;

const ACCEPTED_FILE_TYPES =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip";

function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${i === 0 ? size : size.toFixed(1)} ${units[i]}`;
}

function getFileIcon(file) {
  const name = file?.name || "";
  const type = file?.type || "";
  const ext = name.split(".").pop()?.toLowerCase();

  if (type.startsWith("image/")) return Image;
  if (type === "application/pdf" || ext === "pdf") return FileText;
  if (["zip", "rar", "7z"].includes(ext)) return FileArchive;
  if (["xls", "xlsx", "csv"].includes(ext)) return FileSpreadsheet;
  if (["doc", "docx", "txt"].includes(ext)) return FileText;
  if (["js", "jsx", "ts", "tsx", "json", "html", "css"].includes(ext)) return FileCode;
  return FileIcon;
}

export default function MessageInput({ onSend, disabled, socket, conversationId }) {
  const [value, setValue] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const textareaRef       = useRef(null);
  const fileInputRef      = useRef(null);
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

  // Cleanup
  useEffect(() => {
    return () => {
      clearTypingTimeout();
      emitStopTyping();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preview
  useEffect(() => {
    if (selectedFile && selectedFile.type?.startsWith("image/")) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [selectedFile]);

  const resetHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if ((!trimmed && !selectedFile) || disabled || isSendingRef.current) return;

    isSendingRef.current = true;
    clearTypingTimeout();
    emitStopTyping();

    setValue("");
    resetHeight();

    try {
      await onSend(trimmed, selectedFile);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      isSendingRef.current = false;
      textareaRef.current?.focus();
    }
  }, [value, selectedFile, disabled, onSend, clearTypingTimeout, emitStopTyping]);

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

  // Attach
  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canSend = (!!value.trim() || !!selectedFile) && !disabled;
  const FilePreviewIcon = selectedFile ? getFileIcon(selectedFile) : null;

  return (
    <div className="border-t border-gray-100 bg-white">
      {/* Hint */}
      <div className="px-4 pt-2 pb-0">
        <p className="text-[10px] text-gray-400">
          Use this thread to discuss OJT concerns, daily narratives, or feedback.{" "}
          Press{" "}
          <kbd className="px-1 py-0.5 rounded bg-gray-100 text-gray-500 font-mono text-[9px]">Enter</kbd>{" "}
          to send.
        </p>
      </div>

      {/* Preview */}
      <div
        className={`grid transition-all duration-200 ease-out ${
          selectedFile ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 mt-0"
        } mx-3`}
      >
        <div className="overflow-hidden">
          {selectedFile && (
            <div className="flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-200 px-3 py-3 shadow-sm">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={selectedFile.name}
                  className="w-11 h-11 shrink-0 rounded-lg object-cover border border-gray-200"
                />
              ) : (
                <div className="w-11 h-11 shrink-0 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                  <FilePreviewIcon className="w-5 h-5 text-gray-500" aria-hidden="true" />
                </div>
              )}

              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="truncate text-xs font-semibold text-gray-700">{selectedFile.name}</span>
                <span className="text-[10px] text-gray-400">{formatFileSize(selectedFile.size)}</span>
              </div>

              <button
                type="button"
                onClick={handleRemoveFile}
                aria-label="Remove attachment"
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 transition-colors duration-150 hover:text-gray-600 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-400))]"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-end gap-2 px-3 py-2.5">
        {/* Attach */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileChange}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
        <button
          type="button"
          onClick={handleAttachClick}
          disabled={disabled}
          aria-label={selectedFile ? "Change attachment" : "Attach file"}
          aria-pressed={!!selectedFile}
          title="Attach file"
          className={`shrink-0 w-11 h-11 flex items-center justify-center rounded-full border transition-all duration-150 hover:scale-105 active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--primary-400))] ${
            selectedFile
              ? "bg-[rgb(var(--primary-700))] border-[rgb(var(--primary-700))] text-white hover:bg-[rgb(var(--primary-800))]"
              : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          }`}
        >
          <Paperclip className="w-4.5 h-4.5" aria-hidden="true" />
        </button>

        {/* Input */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type a message…"
          aria-label="Message"
          className="flex-1 resize-none border border-gray-200 rounded-3xl px-4 py-3 text-xs text-gray-700 placeholder-gray-400 leading-relaxed bg-gray-50 outline-none transition-all duration-200 ease-out focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[rgb(var(--primary-400))] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: "44px", maxHeight: "100px" }}
        />

        {/* Send */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          title="Send (Enter)"
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full text-white shadow-sm transition-all duration-150 bg-[rgb(var(--primary-700))] hover:bg-[rgb(var(--primary-800))] hover:scale-105 hover:shadow-md active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--primary-400))]"
        >
          <SendHorizontal className="w-4.5 h-4.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}