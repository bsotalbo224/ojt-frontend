import { useEffect, useState, memo } from "react";
import {
  AlertCircle,
  File,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileText,
} from "lucide-react";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-400))]";

// Local copy: ChatWindow also needs this check (to build its imageAttachments
// list for the ImageModal), so the tiny pure predicate is duplicated here
// rather than imported, keeping this component self-contained/reusable.
function isImageAttachmentItem(item) {
  return !!item?.attachment_url && typeof item.attachment_type === "string" && item.attachment_type.startsWith("image/");
}

function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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

export default AttachmentBlock;