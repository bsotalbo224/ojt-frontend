import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  FileText,
  ScrollText,
  SmilePlus,
  X,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  File,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  FileSpreadsheet,
} from "lucide-react";
import Avatar from "../ui/Avatar";
import MessageInput from "./MessageInput";
import ReactionIcon from "../ui/ReactionIcon";
import { REACTION_CODES, getReactionMeta } from "../../constants/reactions";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-400))]";
const BADGE_SURFACE = "bg-[rgb(var(--primary-50))] border border-[rgb(var(--primary-100))]";
const PRIMARY_TEXT = "text-[rgb(var(--primary-700))]";
const SENT_BUBBLE = "bg-[rgb(var(--primary-700))] text-white";

const MODAL_FOCUSABLE_SELECTOR = 'button, a[href], [tabindex]:not([tabindex="-1"])';

// Reaction picker sizing is derived from the number of reactions so it never
// hard-codes a width that could overflow small viewports or look sparse
// with a different reaction set.
const REACTION_BUTTON_SIZE = 32;
const REACTION_BUTTON_GAP = 6;
const REACTION_PICKER_PADDING = 20; // px-2.5 on both sides
const REACTION_PICKER_VIEWPORT_MARGIN = 10;

const IMAGE_ZOOM_MIN = 1;
const IMAGE_ZOOM_MAX = 4;
const IMAGE_ZOOM_STEP = 0.25;

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

function formatTime(ts) {
  if (!ts) return "";
  try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

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

function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachmentItem(item) {
  return !!item?.attachment_url && typeof item.attachment_type === "string" && item.attachment_type.startsWith("image/");
}

function renderMessageContent(text, mentions) {
  if (!text) return null;
  if (!Array.isArray(mentions) || mentions.length === 0) return text;

  const names = mentions
    .map((m) => {
      if (m.mention_type === "everyone") return "everyone";
      if (m.mention_type === "student") return "student";
      if (m.mention_type === "coordinator") return "coordinator";
      return `${m.f_name ?? ""} ${m.l_name ?? ""}`.trim();
    })
    .filter(Boolean);

  if (names.length === 0) return text;

  const escaped = names
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);

  const regex = new RegExp(`@(${escaped.join("|")})`, "gi");
  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <span key={`mention-${key++}`} className={`font-semibold ${PRIMARY_TEXT}`}>
        {match[0]}
      </span>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return parts;
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

// Looks for a File instance in the arguments passed to onSend (either inside
// a FormData payload or a plain object with a `file`/`attachment` property)
// so an attachment-only send can render an immediate local preview instead
// of waiting for the upload round-trip.
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

/* --------------------------- Attachment kind map -------------------------- */
// Resolves a MIME type / filename to a broad attachment "kind" so the file
// icon reflects the actual content instead of a single generic paperclip.

const EXTENSION_KIND_MAP = {
  pdf: "pdf",
  doc: "document", docx: "document", rtf: "document", odt: "document",
  xls: "spreadsheet", xlsx: "spreadsheet", csv: "spreadsheet", ods: "spreadsheet",
  ppt: "presentation", pptx: "presentation", odp: "presentation",
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive",
  mp4: "video", mov: "video", avi: "video", mkv: "video", webm: "video",
  mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio", flac: "audio",
  js: "code", jsx: "code", ts: "code", tsx: "code", json: "code", html: "code",
  css: "code", py: "code", java: "code", c: "code", cpp: "code", php: "code",
  rb: "code", go: "code", rs: "code", sql: "code", sh: "code",
  txt: "text", md: "text", log: "text",
};

const ATTACHMENT_ICON_BY_KIND = {
  pdf: FileText,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: FileText,
  archive: FileArchive,
  video: FileVideo,
  audio: FileAudio,
  code: FileCode,
  text: FileText,
  generic: File,
};

function getAttachmentKind(item) {
  const mime = (item.attachment_type || "").toLowerCase();
  const name = (item.attachment_name || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";

  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime === "text/csv") return "spreadsheet";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "presentation";
  if (mime.includes("word") || mime.includes("document")) return "document";
  if (mime.includes("zip") || mime.includes("compressed") || mime.includes("archive")) return "archive";
  if (mime.includes("json") || mime.includes("javascript") || mime.includes("html") || mime.includes("css")) return "code";
  if (mime.startsWith("text/")) return "text";

  return EXTENSION_KIND_MAP[ext] || "generic";
}

function getAttachmentIcon(item) {
  return ATTACHMENT_ICON_BY_KIND[getAttachmentKind(item)] || File;
}

/* -------------------------------------------------------------------------- */

const GroupAvatar = memo(function GroupAvatar({ label }) {
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-100 text-gray-500"
      role="img"
      aria-label={label}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m5-2.13a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm6 1a4 4 0 1 0 0-8" />
      </svg>
    </div>
  );
});

const TypingDots = memo(function TypingDots() {
  return (
    <span className="inline-flex items-end gap-0.75 h-3 ml-0.5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-1 h-1 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${delay}ms`, animationDuration: "900ms" }}
        />
      ))}
    </span>
  );
});

const TypingIndicator = memo(function TypingIndicator({ name }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5" role="status" aria-live="polite">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-2xl rounded-bl-sm shadow-sm">
        <span className="text-[11px] text-gray-400 font-medium leading-none">{name} is typing</span>
        <TypingDots />
      </div>
    </div>
  );
});

const SystemMessageCard = memo(function SystemMessageCard({ item }) {
  const isLog = !!item.related_log_id;
  const isNarrative = !!item.related_narrative_id;
  const Icon = isNarrative ? ScrollText : FileText;
  const label = isNarrative ? "Narrative Entry" : isLog ? "Daily Log" : null;
  const idMatch = item.message?.match(/#(\d+)/);
  const refId = idMatch ? `#${idMatch[1]}` : null;

  return (
    <div className="flex justify-center my-6 px-2">
      <div className="w-full max-w-xs bg-white rounded-2xl shadow-sm overflow-hidden border border-[rgb(var(--primary-100))]">
        <div className="h-1 w-full bg-linear-to-r from-[rgb(var(--primary-500))] to-[rgb(var(--primary-400))]" />
        <div className="px-4 py-3 flex items-start gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${BADGE_SURFACE}`}>
            <Icon className={`w-4 h-4 ${PRIMARY_TEXT}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5 text-[rgb(var(--primary-600))]">
              Discussion Topic
            </p>
            {label && refId ? (
              <>
                <p className="text-xs font-semibold text-gray-800">{label} {refId}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed line-clamp-2">{item.message}</p>
              </>
            ) : (
              <p className="text-xs text-gray-600 leading-relaxed">{item.message}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// Thin progress bar shown along the bottom edge of a pending attachment. It
// reflects `attachment_progress` on the message item — either a real value
// reported by the caller or the simulated ramp maintained in ChatWindow —
// and disappears automatically once the message resolves (pending clears).
const UploadProgressBar = memo(function UploadProgressBar({ progress, rounded }) {
  const pct = Math.min(100, Math.max(0, progress));
  return (
    <div
      role="progressbar"
      aria-label="Upload progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={`absolute inset-x-0 bottom-0 h-1 bg-black/15 overflow-hidden ${rounded ? "rounded-b-xl" : ""}`}
    >
      <div
        className="h-full bg-white/90 transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
});

// Thumbnail sizing reserves a fixed-ratio box while the image loads (via a
// pulsing skeleton) so surrounding bubbles/messages don't jump once the
// image resolves. The real <img> fades in over the skeleton and, once
// loaded, the box lets go of the placeholder ratio so the final thumbnail
// isn't cropped to it.
const AttachmentBlock = memo(function AttachmentBlock({ item, isSent, onImageClick }) {
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  // If the attachment URL changes (e.g. optimistic blob URL swapped for the
  // real uploaded URL), reset load state so the skeleton/fade replay for
  // the new source instead of showing a stale image or blank frame.
  useEffect(() => {
    setThumbLoaded(false);
    setThumbError(false);
  }, [item.attachment_url]);

  if (!item.attachment_url) return null;

  const isImage = isImageAttachmentItem(item);
  const sizeLabel = formatFileSize(item.attachment_size);
  const showProgress = item.pending && typeof item.attachment_progress === "number" && item.attachment_progress < 100;

  if (isImage) {
    return (
      <button
        type="button"
        onClick={() => onImageClick?.(item)}
        aria-label={`Open image ${item.attachment_name || "attachment"} in viewer`}
        className={`group/img block mb-1.5 rounded-xl overflow-hidden w-60 max-w-full ring-1 ring-black/5 transition-all duration-200 hover:scale-[1.02] hover:ring-black/10 focus-visible:scale-[1.02] active:scale-[0.99] cursor-pointer ${FOCUS_RING}`}
      >
        <div
          className="relative overflow-hidden bg-gray-100"
          style={!thumbLoaded ? { aspectRatio: "4 / 3" } : undefined}
        >
          {!thumbLoaded && !thumbError && (
            <div className="absolute inset-0 animate-pulse bg-gray-200" aria-hidden="true" />
          )}

          {thumbError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-400 py-6">
              <AlertCircle className="w-5 h-5" />
              <span className="text-[10px]">Image unavailable</span>
            </div>
          ) : (
            <img
              src={item.attachment_url}
              alt={item.attachment_name || "Attachment image"}
              onLoad={() => setThumbLoaded(true)}
              onError={() => setThumbError(true)}
              className={
                thumbLoaded
                  ? "w-full h-auto object-contain opacity-100 transition-transform duration-300 group-hover/img:scale-105"
                  : "absolute inset-0 w-full h-full object-cover opacity-0"
              }
              loading="lazy"
            />
          )}
          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 group-focus-visible/img:bg-black/10 transition-colors duration-200" />
          {showProgress && <UploadProgressBar progress={item.attachment_progress} />}
        </div>
      </button>
    );
  }

  const FileIcon = getAttachmentIcon(item);

  return (
    <a
      href={item.attachment_url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open attachment ${item.attachment_name || "file"}${sizeLabel ? `, ${sizeLabel}` : ""}`}
      className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-1.5 border transition-all duration-150 active:scale-[0.99] overflow-hidden ${FOCUS_RING} ${
        isSent ? "border-white/25 bg-white/10 hover:bg-white/15 focus-visible:bg-white/15" : "border-gray-200 bg-gray-50 hover:bg-gray-100 focus-visible:bg-gray-100"
      }`}
    >
      <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${isSent ? "bg-white/15" : "bg-white"}`}>
        <FileIcon className={`w-3.5 h-3.5 ${isSent ? "text-white" : "text-gray-500"}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[11px] font-medium wrap-break-words ${isSent ? "text-white" : "text-gray-700"}`}>
          {item.attachment_name || "Attachment"}
        </span>
        {sizeLabel && (
          <span className={`block text-[10px] mt-0.5 ${isSent ? "text-white/70" : "text-gray-400"}`}>{sizeLabel}</span>
        )}
      </span>
      {showProgress && <UploadProgressBar progress={item.attachment_progress} rounded />}
    </a>
  );
});

const ReactionBar = memo(function ReactionBar({ reactions, isSent, onReact, messageId }) {
  if (!reactions || !reactions.total) return null;

  return (
    <div className={`flex flex-wrap gap-1 mt-1.5 ${isSent ? "justify-end" : "justify-start"}`} aria-label="Message reactions">
      {reactions.reactions.map((r) => {
        const meta = getReactionMeta(r.reaction_code);
        return (
          <button
            key={r.reaction_code}
            type="button"
            onClick={() => onReact?.(messageId, r.reaction_code)}
            title={r.users.map((u) => getFullName(u)).join(", ")}
            aria-label={`${meta?.label ?? r.reaction_code} reaction, ${r.count}`}
            className={`group inline-flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full bg-white border border-gray-200/80 text-[10.5px] shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300 active:translate-y-0 active:scale-95 ${FOCUS_RING}`}
          >
            <ReactionIcon reactionCode={r.reaction_code} size="xs" decorative />
            <span className="text-gray-500 font-semibold tabular-nums group-hover:text-gray-700 transition-colors">
              {r.count}
            </span>
          </button>
        );
      })}
    </div>
  );
});

const ReactionToggleButton = memo(function ReactionToggleButton({ isPickerOpen, onClick, orderFirst }) {
  return (
    <button
      type="button"
      data-reaction-toggle-btn
      onClick={onClick}
      aria-label="Add reaction"
      aria-haspopup="menu"
      aria-expanded={isPickerOpen}
      className={`${orderFirst ? "order-first" : ""} shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 opacity-0 md:group-hover/bubble:opacity-100 hover:opacity-100 hover:bg-gray-100 hover:text-gray-600 hover:scale-110 active:scale-95 transition-all duration-150 focus-visible:opacity-100 ${FOCUS_RING} ${
        isPickerOpen ? "opacity-100 bg-gray-100 text-gray-600" : ""
      }`}
    >
      <SmilePlus className="w-3.5 h-3.5" />
    </button>
  );
});

const ReactionPickerPanel = memo(function ReactionPickerPanel({ top, left, openUpward, onPick, onClose }) {
  const itemRefs = useRef([]);

  useEffect(() => {
    itemRefs.current[0]?.focus();
  }, []);

  const handleKeyDown = useCallback((e) => {
    const count = REACTION_CODES.length;
    const currentIndex = itemRefs.current.findIndex((el) => el === document.activeElement);

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = currentIndex === -1 ? 0 : (currentIndex + 1) % count;
      itemRefs.current[next]?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = currentIndex === -1 ? 0 : (currentIndex - 1 + count) % count;
      itemRefs.current[next]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      itemRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      itemRefs.current[count - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "Tab") {
      // Keep focus contained within the picker while it's open.
      e.preventDefault();
    }
  }, [onClose]);

  return (
    <div
      data-reaction-picker-panel
      role="menu"
      aria-label="Pick a reaction"
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed",
        top,
        left,
        transform: `translate(-50%, ${openUpward ? "-100%" : "0"})`,
      }}
      className="z-50 flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-full shadow-xl ring-1 ring-black/5 max-w-[90vw] overflow-x-auto scrollbar-none animate-reaction-pop"
    >
      {REACTION_CODES.map((code, idx) => (
        <button
          key={code}
          ref={(el) => { itemRefs.current[idx] = el; }}
          type="button"
          role="menuitem"
          tabIndex={-1}
          onClick={() => onPick(code)}
          aria-label={getReactionMeta(code)?.label ?? code}
          className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-all duration-150 ease-out hover:scale-125 hover:-translate-y-1 active:scale-95 focus-visible:scale-125 focus-visible:-translate-y-1 ${FOCUS_RING}`}
        >
          <ReactionIcon reactionCode={code} size="sm" decorative />
        </button>
      ))}
    </div>
  );
});

const ImageNavButton = memo(function ImageNavButton({ direction, onClick, disabled }) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Previous image" : "Next image"}
      className={`absolute top-1/2 -translate-y-1/2 ${direction === "prev" ? "left-2" : "right-2"} z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 focus-visible:bg-black/60 disabled:opacity-0 disabled:pointer-events-none transition-all duration-150 ${FOCUS_RING}`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
});

// Preloads the image (off-DOM) to learn its natural dimensions before ever
// rendering it, so the dialog can size itself to the image's true aspect
// ratio from the very first paint — no skeleton-to-final-size jump, and
// portrait/landscape images both shrink-wrap correctly instead of sitting
// in an oversized or cropped box. The component stays mounted across
// prev/next navigation (only `item` changes) so the entrance animation
// doesn't replay on every arrow-key press; internal state resets off the
// image URL instead.
const ImageModal = memo(function ImageModal({
  item,
  onClose,
  onNavigate,
  hasPrev,
  hasNext,
  currentIndex,
  totalImages,
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const [entered, setEntered] = useState(false);
  const [imgStatus, setImgStatus] = useState("loading");
  const [naturalSize, setNaturalSize] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [zoom, setZoom] = useState(1);

  const name = item.attachment_name || "Attachment image";

  // Reset load state, natural size, and zoom whenever the image URL changes
  // — either the very first open, or stepping to a different image via
  // prev/next — so a new image never inherits stale status or zoom level.
  useEffect(() => {
    let cancelled = false;
    setImgStatus("loading");
    setNaturalSize(null);
    setZoom(1);

    const preload = new Image();
    preload.onload = () => {
      if (cancelled) return;
      setNaturalSize({ width: preload.naturalWidth, height: preload.naturalHeight });
      setImgStatus("loaded");
    };
    preload.onerror = () => {
      if (cancelled) return;
      setImgStatus("error");
    };
    preload.src = item.attachment_url;

    return () => {
      cancelled = true;
      preload.onload = null;
      preload.onerror = null;
    };
  }, [item.attachment_url]);

  // Lock background scroll, remember prior focus, animate in, focus the
  // close button. Runs once on mount only — navigating between images
  // keeps this component mounted, so the entrance transition doesn't replay.
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const raf = requestAnimationFrame(() => setEntered(true));
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      cancelAnimationFrame(raf);
      const el = previouslyFocusedRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, []);

  // Escape to close, Tab to trap focus, Left/Right to step between images.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowRight") {
        if (!hasNext) return;
        e.preventDefault();
        onNavigate?.(1);
        return;
      }
      if (e.key === "ArrowLeft") {
        if (!hasPrev) return;
        e.preventDefault();
        onNavigate?.(-1);
        return;
      }
      if (e.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll(MODAL_FOCUSABLE_SELECTOR);
        if (!focusables || focusables.length === 0) return;
        const list = Array.from(focusables);
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!list.includes(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, onNavigate, hasPrev, hasNext]);

  const handleBackdropClick = useCallback((e) => {
    if (dialogRef.current && !dialogRef.current.contains(e.target)) onClose();
  }, [onClose]);

  // Mouse-wheel zoom, clamped between 1x and 4x. Double-click resets to 1x.
  const handleWheel = useCallback((e) => {
    if (imgStatus !== "loaded") return;
    e.preventDefault();
    setZoom((z) => {
      const next = e.deltaY < 0 ? z + IMAGE_ZOOM_STEP : z - IMAGE_ZOOM_STEP;
      return Math.min(IMAGE_ZOOM_MAX, Math.max(IMAGE_ZOOM_MIN, Number(next.toFixed(2))));
    });
  }, [imgStatus]);

  const handleDoubleClick = useCallback(() => setZoom(1), []);

  // Fetches the image as a blob so the download is forced regardless of the
  // host's Content-Disposition header, rather than relying on an <a download>
  // combined with target="_blank" (which browsers largely ignore for
  // cross-origin URLs). Falls back to opening the file directly if the
  // fetch fails (e.g. CORS-restricted host).
  const handleDownload = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const response = await fetch(item.attachment_url);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = item.attachment_name || "image";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(item.attachment_url, "_blank", "noopener,noreferrer");
    } finally {
      setIsDownloading(false);
    }
  }, [item.attachment_url, item.attachment_name, isDownloading]);

  // Container sizing: once the natural dimensions are known, the box takes
  // on the image's exact aspect ratio (capped to the viewport), so there is
  // never a moment where a wrong-shaped placeholder gets replaced by the
  // real image. Before that, a modest square placeholder holds space for
  // the spinner/error state only.
  const sizingStyle = naturalSize
    ? {
        aspectRatio: `${naturalSize.width} / ${naturalSize.height}`,
        width: `min(90vw, ${naturalSize.width}px)`,
        maxHeight: "80vh",
      }
    : { width: "18rem", height: "18rem", maxWidth: "90vw", maxHeight: "80vh" };

  const showCounter = Number.isInteger(currentIndex) && currentIndex >= 0 && totalImages > 1;

  return (
    <div
      className={`fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 transition-opacity duration-300 ease-out ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onMouseDown={handleBackdropClick}
    >
      {/* inline-flex + w-fit lets the dialog shrink-wrap to the image's
          rendered size instead of claiming a fixed box, so portrait images
          no longer sit inside a tall, mostly-empty panel. */}
      <div
        ref={dialogRef}
        className={`relative inline-flex flex-col items-center gap-3 w-fit max-w-[90vw] max-h-[90vh] transition-all duration-300 ease-out ${
          entered ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        {/* Header matches the image's own width (w-full of the shrink-wrapped
            dialog) rather than stretching across the viewport. */}
        <div className="flex items-center justify-between w-full max-w-[90vw] gap-4 px-1">
          <span className="text-xs font-medium text-white/90 truncate">
            {name}
            {showCounter && <span className="text-white/50 ml-1.5">{currentIndex + 1} / {totalImages}</span>}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              aria-label="Download image"
              aria-busy={isDownloading}
              className={`w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:bg-white/20 transition-colors duration-150 disabled:opacity-60 disabled:cursor-wait ${FOCUS_RING}`}
            >
              {isDownloading ? (
                <div className="w-3.5 h-3.5 rounded-full animate-spin border-2 border-white/30 border-t-white" aria-hidden="true" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close image viewer"
              className={`w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:bg-white/20 transition-colors duration-150 ${FOCUS_RING}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {onNavigate && (
          <>
            <ImageNavButton direction="prev" onClick={() => onNavigate(-1)} disabled={!hasPrev} />
            <ImageNavButton direction="next" onClick={() => onNavigate(1)} disabled={!hasNext} />
          </>
        )}

        {/* Sizing wrapper: takes on the image's true aspect ratio as soon as
            it's known (preloaded off-DOM), so the visible <img> fades in
            without ever resizing its container. Wheel zooms in/out;
            double-click resets to 1x. Overflow is clipped so a zoomed image
            never spills outside the dialog. */}
        <div
          className="relative flex items-center justify-center overflow-hidden"
          style={sizingStyle}
          onWheel={handleWheel}
        >
          {imgStatus === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center" role="status" aria-live="polite">
              <span className="sr-only">Loading image…</span>
              <div className="w-8 h-8 rounded-full animate-spin border-2 border-white/20 border-t-white" aria-hidden="true" />
            </div>
          )}

          {imgStatus === "error" ? (
            <div className="flex flex-col items-center gap-2 px-10 py-12 text-white/80" role="alert">
              <AlertCircle className="w-8 h-8" />
              <p className="text-xs">This image couldn't be loaded.</p>
            </div>
          ) : imgStatus === "loaded" ? (
            <img
              src={item.attachment_url}
              alt={name}
              onDoubleClick={handleDoubleClick}
              className="w-full h-full rounded-lg object-contain shadow-2xl opacity-100 transition-transform duration-150 ease-out"
              style={{ transform: `scale(${zoom})`, cursor: zoom > 1 ? "zoom-out" : "zoom-in" }}
            />
          ) : null}

          {zoom !== 1 && imgStatus === "loaded" && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-medium pointer-events-none">
              {Math.round(zoom * 100)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const MessageBubble = memo(function MessageBubble({
  item,
  isSent,
  isGroupStart,
  isGroupEnd,
  isGroupChat,
  onReact,
  isPickerOpen,
  onTogglePicker,
  onImageClick,
}) {
  const ts = resolveTimestamp(item);

  const sentCorners = ["rounded-2xl", !isGroupStart && "rounded-tr-md", !isGroupEnd && "rounded-br-md"].filter(Boolean).join(" ");
  const recvCorners = ["rounded-2xl", !isGroupStart && "rounded-tl-md", !isGroupEnd && "rounded-bl-md"].filter(Boolean).join(" ");

  const senderName = getFullName(item);
  const hasText = typeof item.message === "string" && item.message.trim() !== "";

  const handleToggleClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onTogglePicker(item.message_id, rect, e.currentTarget);
  }, [onTogglePicker, item.message_id]);

  return (
    <div
      data-reaction-picker-root
      className={`flex gap-2 items-end ${isSent ? "flex-row-reverse" : "flex-row"} ${isGroupStart ? "mt-3" : "mt-1"}`}
    >
      {!isSent && (
        <div className="shrink-0 w-7 self-end mb-1">
          {isGroupEnd ? <Avatar name={senderName} src={item.photo} size="sm" /> : <div className="w-7 h-7" />}
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[78%] sm:max-w-[70%] md:max-w-[58%] ${isSent ? "items-end" : "items-start"}`}>
        {!isSent && isGroupChat && isGroupStart && (
          <span className="text-[10px] font-semibold text-gray-500 px-1">{senderName}</span>
        )}

        <div className="relative group/bubble flex items-center gap-1">
          {isSent && item.message_id != null && (
            <ReactionToggleButton isPickerOpen={isPickerOpen} onClick={handleToggleClick} orderFirst />
          )}

          <div
            className={`px-4 py-2.5 text-xs leading-relaxed shadow-sm transition-shadow duration-150 ${
              isSent ? `${sentCorners} ${SENT_BUBBLE}` : `bg-white border border-gray-200 text-gray-800 ${recvCorners}`
            } ${item.pending ? "opacity-70" : ""}`}
          >
            <AttachmentBlock item={item} isSent={isSent} onImageClick={onImageClick} />
            {hasText && renderMessageContent(item.message, item.mentions)}
          </div>

          {!isSent && item.message_id != null && (
            <ReactionToggleButton isPickerOpen={isPickerOpen} onClick={handleToggleClick} />
          )}
        </div>

        <ReactionBar reactions={item.reactions} isSent={isSent} onReact={onReact} messageId={item.message_id} />

        {isGroupEnd && (
          <div className={`flex items-center gap-1.5 px-1 ${isSent ? "flex-row-reverse" : "flex-row"}`}>
            <span className="text-[10px] text-gray-400">{formatTime(ts)}</span>
            {item.failed && <span className="text-[10px] text-red-400">Failed to send</span>}
            {isSent && !item.failed && (
              <span className="opacity-80">
                {item.pending ? (
                  <Clock className="w-3 h-3 text-gray-300" />
                ) : item.is_read ? (
                  <CheckCheck className="w-3 h-3 text-[rgb(var(--primary-500))]" />
                ) : item.delivered ? (
                  <CheckCheck className="w-3 h-3 text-gray-400" />
                ) : (
                  <Check className="w-3 h-3 text-gray-400" />
                )}
              </span>
            )}
            {isSent && item.failed && <AlertCircle className="w-3 h-3 text-red-400" />}
            {isSent && isGroupChat && !item.pending && !item.failed && Number.isFinite(item.read_count) && (
              <span className="text-[9px] text-gray-400">
                {item.read_count > 0 ? `· Read by ${item.read_count}` : "· Sent"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

/* --------------------------- Layout subcomponents -------------------------- */

const ChatHeader = memo(function ChatHeader({ selectedConversation, selectedName, isGroupChat, isOnline, onBack }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shadow-sm shrink-0">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Back to conversations"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-all md:hidden shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      )}

      <div className="relative shrink-0">
        {isGroupChat ? (
          <GroupAvatar label={selectedName} />
        ) : (
          <Avatar name={selectedName} src={selectedConversation.photo} size="md" />
        )}
        {isOnline && !isGroupChat && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white bg-[rgb(var(--primary-500))]" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold text-gray-800 truncate">{selectedName}</h3>
          {isOnline && !isGroupChat && (
            <span className="text-[10px] font-semibold shrink-0 text-[rgb(var(--primary-600))]">Online</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {!isGroupChat && selectedConversation.role && (
            <span className="text-[10px] text-gray-500 capitalize font-medium">{selectedConversation.role}</span>
          )}
          {isGroupChat && selectedConversation.member_count != null && (
            <span className="text-[10px] text-gray-500 font-medium">{selectedConversation.member_count} members</span>
          )}
          {(selectedConversation.role || isGroupChat) && <span className="text-[10px] text-gray-300">·</span>}
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${BADGE_SURFACE} ${PRIMARY_TEXT}`}>
            <BookOpen className="w-2.5 h-2.5" />OJT Consultation
          </span>
        </div>
      </div>
    </div>
  );
});

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

// Shown while a file is dragged over the window. Purely visual (pointer
// events pass through) — the drag/drop handlers live on the ancestor
// container so the overlay never needs to intercept the drop itself.
const DropOverlay = memo(function DropOverlay() {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-[rgb(var(--primary-50))]/95 backdrop-blur-sm border-4 border-dashed border-[rgb(var(--primary-300))] m-2 rounded-2xl pointer-events-none"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-3 text-center px-6">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${BADGE_SURFACE}`}>
          <Upload className="w-6 h-6 text-[rgb(var(--primary-500))]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Drop files to send</p>
          <p className="text-xs text-gray-400">Images and documents are supported</p>
        </div>
      </div>
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
  // Tracks blob: URLs created for optimistic attachment previews so they can
  // be revoked once the real uploaded URL takes over (or on unmount),
  // avoiding a memory leak without risking a flash of a broken image if we
  // revoked them synchronously mid-render.
  const pendingObjectUrlsRef = useRef(new Set());
  // Tracks the simulated upload-progress interval per optimistic message so
  // it can be cleared as soon as the real send resolves/fails or on unmount.
  const progressIntervalsRef = useRef(new Map());
  const dragCounterRef = useRef(0);

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
  const [isDraggingFile, setIsDraggingFile] = useState(false);

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

  // Opening/toggling always fully replaces reactionPicker in one state
  // update (never two writes), and the panel below only ever renders a
  // single instance keyed to the active message + orientation — this keeps
  // exactly one picker mounted at a time and forces a clean remount (rather
  // than an awkward re-animation) if it flips from opening upward to
  // downward for a different message.
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

  const handleSend = useCallback(async (...args) => {
    const text = extractOptimisticText(args);
    const attachmentPreview = extractOptimisticAttachment(args);
    let tempId = null;

    // Attachment-only sends (no caption) still get an optimistic bubble, so
    // the preview appears immediately instead of only after the upload
    // round-trip completes.
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

      // Simulated upload progress: this component has no real byte-level
      // hook into the underlying upload request, so it ramps optimistically
      // to 90% and holds there until onSend resolves, at which point the
      // pending bubble is replaced/cleared and the bar disappears.
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
      // Deferred so the message list has a chance to re-render with the
      // real attachment URL (or the pending/failed fallback) before the
      // blob URL backing the optimistic preview is revoked — revoking it
      // synchronously risks a broken-image flash if the swap hasn't
      // painted yet.
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

  // Sends a batch of raw Files (from drag-and-drop or clipboard paste) one
  // at a time through the same optimistic pipeline as a normal attachment
  // send, so each gets its own bubble, preview, and progress bar. Files are
  // sent sequentially to preserve the order they were dropped/pasted in;
  // one failure doesn't block the rest.
  const handleFilesSelected = useCallback(async (files) => {
    if (!selectedConversation || !files?.length) return;
    for (const file of files) {
      const formData = new FormData();
      formData.append("attachment", file);
      try {
        await handleSend(formData);
      } catch {
        // handleSend already marks this file's optimistic bubble as failed;
        // continue on to the remaining files.
      }
    }
  }, [selectedConversation, handleSend]);

  const handleDragEnter = useCallback((e) => {
    if (!selectedConversation) return;
    if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDraggingFile(true);
  }, [selectedConversation]);

  const handleDragOver = useCallback((e) => {
    if (!selectedConversation) return;
    if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
    e.preventDefault();
  }, [selectedConversation]);

  const handleDragLeave = useCallback((e) => {
    if (!selectedConversation) return;
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDraggingFile(false);
  }, [selectedConversation]);

  const handleDrop = useCallback((e) => {
    if (!selectedConversation) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) handleFilesSelected(files);
  }, [selectedConversation, handleFilesSelected]);

  // Paste handler lives on the outer container so it catches Ctrl+V
  // regardless of which inner element has focus (typically the message
  // input). Only image/file paste is intercepted — plain text paste is left
  // alone so normal typing into the input keeps working.
  const handlePaste = useCallback((e) => {
    if (!selectedConversation) return;
    const items = Array.from(e.clipboardData?.items || []);
    const files = items
      .filter((it) => it.kind === "file")
      .map((it) => it.getAsFile())
      .filter(Boolean);
    if (files.length === 0) return;
    e.preventDefault();
    handleFilesSelected(files);
  }, [selectedConversation, handleFilesSelected]);

  if (!selectedConversation) {
    return <NoConversationState />;
  }

  const selectedName = getFullName(selectedConversation);
  const typingName = isGroupChat ? "Someone" : selectedName;
  const showTyping = typingUsers.size > 0;

  return (
    <div
      className="relative flex flex-col h-full bg-gray-50"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      <ChatHeader
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
          <div className="flex flex-col">
            {grouped.map((item) => {
              if (item.type === "date-label") {
                return <DateSeparator key={item.id} label={item.label} />;
              }

              if (item.message_type === "system" || item.type === "system" || item.is_system) {
                return <SystemMessageCard key={item.message_id ?? item.tempId} item={item} />;
              }

              const isSent = userId != null && item.sender_id === userId;
              const msgKey = item.message_id ?? item.tempId;
              const { isGroupStart, isGroupEnd } = groupingMap.get(msgKey) ?? { isGroupStart: true, isGroupEnd: true };

              return (
                <MessageBubble
                  key={msgKey}
                  item={item}
                  isSent={isSent}
                  isGroupStart={isGroupStart}
                  isGroupEnd={isGroupEnd}
                  isGroupChat={isGroupChat}
                  onReact={handleReact}
                  isPickerOpen={reactionPicker?.messageId === item.message_id}
                  onTogglePicker={handleTogglePicker}
                  onImageClick={handleImageClick}
                />
              );
            })}
          </div>
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

      {isDraggingFile && <DropOverlay />}
    </div>
  );
}