import { useState, useRef, useEffect, useCallback } from "react";
import {
  SendHorizontal,
  Paperclip,
  X,
  FileText,
  Image,
  FileArchive,
  FileSpreadsheet,
  FileAudio,
  FileVideo,
  FileCode,
  File as FileIcon,
  Reply,
} from "lucide-react";

const TYPING_TIMEOUT_MS = 1200;
const MAX_ATTACHMENTS = 10;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const ACCEPTED_FILE_TYPES =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip";

function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${i === 0 ? size : size.toFixed(1)} ${units[i]}`;
}

// Attachment Helpers
function getFileIcon(file) {
  const name = file?.name || "";
  const type = file?.type || "";
  const ext = name.split(".").pop()?.toLowerCase();

  if (type.startsWith("image/")) return Image;
  if (type.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "flac"].includes(ext)) return FileAudio;
  if (type.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return FileVideo;
  if (type === "application/pdf" || ext === "pdf") return FileText;
  if (["zip", "rar", "7z"].includes(ext)) return FileArchive;
  if (["xls", "xlsx", "csv"].includes(ext)) return FileSpreadsheet;
  if (["doc", "docx", "txt"].includes(ext)) return FileText;
  if (["js", "jsx", "ts", "tsx", "json", "html", "css"].includes(ext)) return FileCode;
  return FileIcon;
}

function isSameFile(a, b) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

// Reply Banner Helpers

function getFullName(user = {}) {
  if (user.f_name || user.l_name) return `${user.f_name ?? ""} ${user.l_name ?? ""}`.trim();
  return user.name || "Unknown";
}

function isImageAttachment(attachment) {
  return !!attachment?.attachment_url && typeof attachment.attachment_type === "string" && attachment.attachment_type.startsWith("image/");
}

// Splits attachments into image count + non-image files in one pass.
function summarizeAttachments(attachments) {
  const atts = Array.isArray(attachments) ? attachments : [];
  let imageCount = 0;
  const files = [];
  for (const att of atts) {
    if (isImageAttachment(att)) imageCount += 1;
    else files.push(att);
  }
  return { imageCount, files };
}

// Returns { icon, label } describing the quoted message.
function getReplyPreviewContent(replyTo) {
  if (!replyTo) return { icon: null, label: "Message unavailable" };

  const text = typeof replyTo.message === "string" ? replyTo.message.trim() : "";
  if (text) return { icon: null, label: text };

  const { imageCount, files } = summarizeAttachments(replyTo.attachments);
  if (imageCount > 0) {
    return { icon: Image, label: imageCount > 1 ? `${imageCount} Photos` : "Photo" };
  }

  if (files.length > 0) {
    const first = files[0];
    const icon = getFileIcon({ name: first?.attachment_name, type: first?.attachment_type });
    const label =
      files.length > 1
        ? `${first?.attachment_name || "File"} (+${files.length - 1})`
        : first?.attachment_name || "File";
    return { icon, label };
  }

  return { icon: null, label: "Message unavailable" };
}

// "You" is always the composer. _isSentByCurrentUser (stamped by
// MessageBubble) tells us if the quoted message was the user's own.
function getReplyBannerLabel(replyingTo) {
  if (!replyingTo) return "";
  return replyingTo._isSentByCurrentUser
    ? "You replied to yourself"
    : `You replied to ${getFullName(replyingTo)}`;
}

export default function MessageInput({ onSend, disabled, socket, conversationId, replyingTo, onCancelReply }) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [attachmentError, setAttachmentError] = useState(null);
  const textareaRef       = useRef(null);
  const fileInputRef      = useRef(null);
  const isSendingRef      = useRef(false);
  const typingTimeoutRef  = useRef(null);
  const isTypingRef       = useRef(false);
  const attachmentIdRef   = useRef(0);
  const dragCounterRef    = useRef(0);
  const attachmentsRef    = useRef(attachments);
  const revokedUrlsRef    = useRef(new Set());
  const errorTimeoutRef   = useRef(null);
  const prevReplyingToRef = useRef(replyingTo ?? null);

  const locked = disabled || isSending;

  useEffect(() => {
    attachmentsRef.current = attachments;

    // Prune stale revoked-URL entries
    const liveUrls = new Set(attachments.map((att) => att.previewUrl).filter(Boolean));
    revokedUrlsRef.current.forEach((url) => {
      if (!liveUrls.has(url)) revokedUrlsRef.current.delete(url);
    });
  }, [attachments]);

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  // Scroll Into View — only on the null -> message transition
  useEffect(() => {
    if (replyingTo && !prevReplyingToRef.current) {
      const el = textareaRef.current;
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      el?.focus();
    }
    prevReplyingToRef.current = replyingTo ?? null;
  }, [replyingTo]);

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

  // Revokes a preview URL at most once
  const revokeUrl = useCallback((url) => {
    if (!url || revokedUrlsRef.current.has(url)) return;
    revokedUrlsRef.current.add(url);
    URL.revokeObjectURL(url);
  }, []);

  // Unmount Cleanup
  useEffect(() => {
    return () => {
      clearTypingTimeout();
      emitStopTyping();
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      attachmentsRef.current.forEach((att) => revokeUrl(att.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const ERROR_DISPLAY_MS = 3000;

  // Attachment Error — auto-dismissing, one at a time
  const showAttachmentError = useCallback((message) => {
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    setAttachmentError(message);
    errorTimeoutRef.current = setTimeout(() => {
      setAttachmentError(null);
      errorTimeoutRef.current = null;
    }, ERROR_DISPLAY_MS);
  }, []);

  // Attachment Intake — shared by file picker, drag & drop, and paste
  const addAttachments = useCallback((fileList) => {
    const incoming = Array.from(fileList || []).filter(Boolean);
    if (incoming.length === 0) return;

    // Priority for the one error shown: count cap, then oversized, then duplicate.
    let hitMaxCount = false;
    let hasOversized = false;
    let hasDuplicate = false;

    setAttachments((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (next.length >= MAX_ATTACHMENTS) {
          hitMaxCount = true;
          break;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          hasOversized = true;
          continue;
        }
        if (next.some((att) => isSameFile(att.file, file))) {
          hasDuplicate = true;
          continue;
        }

        next.push({
          id: `att-${attachmentIdRef.current++}`,
          file,
          previewUrl: file.type?.startsWith("image/") ? URL.createObjectURL(file) : null,
        });
      }
      return next;
    });

    if (hitMaxCount) {
      showAttachmentError(`You can attach up to ${MAX_ATTACHMENTS} files.`);
    } else if (hasOversized) {
      showAttachmentError("Maximum attachment size is 20 MB.");
    } else if (hasDuplicate) {
      showAttachmentError("This file is already attached.");
    }
  }, [showAttachmentError]);

  const handleRemoveAttachment = useCallback((id) => {
    setAttachments((prev) => {
      const target = prev.find((att) => att.id === id);
      if (target) revokeUrl(target.previewUrl);
      return prev.filter((att) => att.id !== id);
    });
  }, [revokeUrl]);

  // Sending
  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled || isSendingRef.current) return;

    isSendingRef.current = true;
    setIsSending(true);
    clearTypingTimeout();
    emitStopTyping();

    try {
      await onSend(trimmed, attachments.map((att) => att.file), replyingTo);
      // Clear composer only after a successful send
      attachments.forEach((att) => revokeUrl(att.previewUrl));
      setAttachments([]);
      setValue("");
      resetHeight();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      // Send failed — leave the message, attachments, and reply intact for retry.
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }, [value, attachments, disabled, onSend, clearTypingTimeout, emitStopTyping, revokeUrl, replyingTo]);

  // Keyboard
  const handleKeyDown = (e) => {
    if (e.key === "Escape" && replyingTo) {
      e.preventDefault();
      onCancelReply?.();
      return;
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  // Typing
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
    addAttachments(e.target.files);
    // Reset so selecting the same file again after removing it still fires onChange.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Drag & Drop
  const handleDragEnter = (e) => {
    if (locked) return;
    if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDraggingOver(true);
  };

  const handleDragOver = (e) => {
    if (locked) return;
    if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
    e.preventDefault();
  };

  const handleDragLeave = (e) => {
    if (locked) return;
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDraggingOver(false);
  };

  const handleDrop = (e) => {
    if (locked) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) addAttachments(files);
  };

  // Paste
  const handlePaste = (e) => {
    if (locked) return;
    const items = Array.from(e.clipboardData?.items || []);
    const files = items
      .filter((it) => it.kind === "file")
      .map((it) => it.getAsFile())
      .filter(Boolean);
    if (files.length === 0) return;
    e.preventDefault();
    addAttachments(files);
  };

  const canSend = (!!value.trim() || attachments.length > 0) && !locked;

  const replyBannerLabel = replyingTo ? getReplyBannerLabel(replyingTo) : "";
  const replyBannerPreview = replyingTo ? getReplyPreviewContent(replyingTo) : { icon: null, label: "" };
  const ReplyPreviewIcon = replyBannerPreview.icon;

  return (
    <div
      className={`relative border-t bg-white transition-colors duration-150 ${
        isDraggingOver
          ? "border-dashed border-[rgb(var(--primary-300))] bg-[rgb(var(--primary-50))]/40"
          : "border-gray-100"
      }`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {isDraggingOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none bg-white/70">
          <span
            role="status"
            aria-live="polite"
            className="text-xs font-semibold text-[rgb(var(--primary-700))] px-3 py-1.5 rounded-full bg-white border border-dashed border-[rgb(var(--primary-300))] shadow-sm"
          >
            Drop files here
          </span>
        </div>
      )}

      {/* Hint */}
      <div className="px-4 pt-2 pb-0">
        <p className="text-[10px] text-gray-400">
          Use this thread to discuss OJT concerns, daily narratives, or feedback.{" "}
          Press{" "}
          <kbd className="px-1 py-0.5 rounded bg-gray-100 text-gray-500 font-mono text-[9px]">Enter</kbd>{" "}
          to send.
        </p>
      </div>

      {/* Reply Banner */}
      {replyingTo && (
        <div
          role="group"
          aria-label={`${replyBannerLabel}. ${replyBannerPreview.label}`}
          className="mx-3 mt-2 flex items-center gap-1.5 border-l border-gray-200 bg-gray-50/60 pl-2 pr-1 py-1 rounded-md"
        >
          <Reply className="w-3 h-3 text-gray-300 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
            <p className="text-[10px] font-medium leading-tight truncate text-gray-600">
              {replyBannerLabel}
            </p>
            <div className="flex items-center gap-1 min-w-0">
              {ReplyPreviewIcon && (
                <ReplyPreviewIcon className="w-3 h-3 text-gray-400 shrink-0" aria-hidden="true" />
              )}
              <span className="text-[10px] leading-tight text-gray-400 truncate">
                {replyBannerPreview.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-400))]"
          >
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Attachment Preview */}
      <div
        className={`grid transition-all duration-200 ease-out ${
          attachments.length > 0 ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 mt-0"
        } mx-3`}
      >
        <div className="overflow-hidden">
          {attachments.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {attachments.map((att) => {
                const FilePreviewIcon = getFileIcon(att.file);
                return (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 rounded-2xl bg-gray-50 border border-gray-200 px-2.5 py-2 shadow-sm"
                  >
                    {att.previewUrl ? (
                      <img
                        src={att.previewUrl}
                        alt={att.file.name}
                        className="w-10 h-10 shrink-0 rounded-lg object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 shrink-0 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                        <FilePreviewIcon className="w-4.5 h-4.5 text-gray-500" aria-hidden="true" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span title={att.file.name} className="truncate text-xs font-semibold text-gray-700">
                        {att.file.name}
                      </span>
                      <span className="text-[10px] text-gray-400">{formatFileSize(att.file.size)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      disabled={locked}
                      aria-label={`Remove ${att.file.name}`}
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 transition-colors duration-150 hover:text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-400))]"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {attachmentError && (
        <div className="px-4 pt-1.5">
          <p role="alert" className="text-[10px] font-medium text-red-500">
            {attachmentError}
          </p>
        </div>
      )}

      <div className="flex items-end gap-2 px-3 py-2.5">
        {/* Attach */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileChange}
          multiple
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
        <button
          type="button"
          onClick={handleAttachClick}
          disabled={locked}
          aria-label={attachments.length > 0 ? "Add another attachment" : "Attach file"}
          aria-pressed={attachments.length > 0}
          title="Attach file"
          className={`shrink-0 w-11 h-11 flex items-center justify-center rounded-full border transition-all duration-150 hover:scale-105 active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--primary-400))] ${
            attachments.length > 0
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
          disabled={locked}
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