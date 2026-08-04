import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon, File, Paperclip, Upload, X,
} from "lucide-react";
import "./editor.css";

// Constants

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB per file
const MAX_ATTACHMENTS = 10;
const REMOVE_ANIMATION_MS = 150;

const ACCEPTED_MIME_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ACCEPTED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "pdf", "doc", "docx"]);
const FILE_INPUT_ACCEPT = "image/*,.pdf,.doc,.docx";

const ICON_COLOR_BY_EXT = {
  pdf: "text-red-500",
  docx: "text-blue-500", doc: "text-blue-500",
  jpg: "text-purple-500", jpeg: "text-purple-500", png: "text-purple-500",
  gif: "text-purple-500", webp: "text-purple-500", svg: "text-purple-500",
};

// Helpers

const getExtension = (name = "") => name.split(".").pop().toLowerCase();

const isImageFile = (name, mimeType) =>
  mimeType?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(name ?? "");

/** Human-readable file size, e.g. "1.4 MB". */
const formatSize = (bytes) => {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Returns a rejection reason, or null if the file is acceptable. */
const validateFile = (file, currentCount) => {
  if (currentCount >= MAX_ATTACHMENTS) {
    return `Maximum of ${MAX_ATTACHMENTS} attachments reached.`;
  }
  const ext = getExtension(file.name);
  const typeOk = ACCEPTED_MIME_TYPES.has(file.type) || ACCEPTED_EXTENSIONS.has(ext);
  if (!typeOk) {
    return `"${file.name}" is not a supported file type.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `"${file.name}" exceeds the ${formatSize(MAX_FILE_SIZE_BYTES)} size limit.`;
  }
  return null;
};

const isDuplicate = (file, existing) =>
  existing.some(
    (a) => a.name === file.name && a.size === file.size && a.lastModified === file.lastModified
  );

// FileTypeIcon — MIME first, extension as fallback

const FileTypeIcon = memo(function FileTypeIcon({ name, mimeType }) {
  const ext = getExtension(name);
  const colorClass =
    ICON_COLOR_BY_EXT[ext] || (isImageFile(name, mimeType) ? "text-purple-400" : "text-slate-400");
  const Icon = isImageFile(name, mimeType) ? ImageIcon : File;
  return <Icon className={`w-4 h-4 ${colorClass}`} aria-hidden="true" />;
});

// AttachmentUploader

const AttachmentUploader = ({ attachments, setAttachments, editable }) => {
  // Refs
  const fileInputRef = useRef(null);
  const objectUrlsRef = useRef({});
  const dragCounterRef = useRef(0);
  const removalTimeoutsRef = useRef(new Map()); // id -> timeoutId
  const abortControllersRef = useRef(new Map()); // id -> AbortController, for future upload cancellation
  const isMountedRef = useRef(true);

  // State
  const [dragging, setDragging] = useState(false);
  const [removingIds, setRemovingIds] = useState(() => new Set());
  const [errors, setErrors] = useState([]);

  // Lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      removalTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      removalTimeoutsRef.current.clear();
      abortControllersRef.current.forEach((controller) => controller.abort());
      abortControllersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => Object.values(urls).forEach(URL.revokeObjectURL);
  }, []);

  // Callbacks

  const revokeUrl = useCallback((id) => {
    const url = objectUrlsRef.current[id];
    if (url) {
      URL.revokeObjectURL(url);
      delete objectUrlsRef.current[id];
    }
  }, []);

  /** No-op today, but gives removal a stable place to cancel an upload once one exists. */
  const cancelPendingUpload = useCallback((id) => {
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(id);
    }
  }, []);

  const addFiles = useCallback(
    (fileList) => {
      if (!fileList || fileList.length === 0) return; // cancelled dialog / empty drop

      const files = Array.from(fileList);
      const accepted = [];
      const rejections = [];
      let runningCount = attachments.length;

      for (const file of files) {
        const reason = validateFile(file, runningCount);
        if (reason) {
          rejections.push(reason);
          continue;
        }
        if (isDuplicate(file, attachments) || isDuplicate(file, accepted)) {
          rejections.push(`"${file.name}" is a duplicate — it's already attached.`);
          continue;
        }

        let preview = null;
        if (file.type.startsWith("image/")) {
          try {
            preview = URL.createObjectURL(file);
          } catch {
            preview = null; // fall back to the generic file icon
          }
        }

        const id = crypto.randomUUID();
        if (preview) objectUrlsRef.current[id] = preview;

        accepted.push({
          id,
          file,
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          mimeType: file.type,
          preview,
          status: "ready", // reserved for future async-upload support
          progress: 100,
          error: null,
        });
        runningCount += 1;
      }

      if (accepted.length > 0) {
        setAttachments((prev) => [...prev, ...accepted]);
      }
      setErrors(rejections);
    },
    [attachments, setAttachments]
  );

  const removeFile = useCallback(
    (id) => {
      cancelPendingUpload(id);
      setRemovingIds((prev) => new Set(prev).add(id));

      const timeoutId = window.setTimeout(() => {
        removalTimeoutsRef.current.delete(id);
        if (!isMountedRef.current) return;

        revokeUrl(id);
        setAttachments((prev) => prev.filter((a) => a.id !== id));
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, REMOVE_ANIMATION_MS);

      removalTimeoutsRef.current.set(id, timeoutId);
    },
    [cancelPendingUpload, revokeUrl, setAttachments]
  );

  // Both handlers read the attachment id off `currentTarget.dataset` so a
  // single function reference can be reused across every card.
  const handleRemoveClick = useCallback(
    (e) => {
      const id = e.currentTarget.dataset.id;
      if (id) removeFile(id);
    },
    [removeFile]
  );

  const handleRemoveKeyDown = useCallback(
    (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      e.preventDefault();
      const id = e.currentTarget.dataset.id;
      if (id) removeFile(id);
    },
    [removeFile]
  );

  const handleInputChange = useCallback(
    (e) => {
      addFiles(e.target.files);
      e.target.value = ""; // allow re-selecting the same file
    },
    [addFiles]
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDropzoneKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openFilePicker();
      }
    },
    [openFilePicker]
  );

  // Drag counter avoids dragenter/dragleave flicker over nested children.
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    setDragging(true);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setDragging(false);
      if (editable) addFiles(e.dataTransfer.files);
    },
    [editable, addFiles]
  );

  // Render

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `rgb(var(--p50))` }}
        >
          <Paperclip className="w-4 h-4" style={{ color: `rgb(var(--p600))` }} aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Evidence & Attachments</p>
          <p className="text-xs text-slate-500">Upload supporting documents, images, or PDFs</p>
        </div>
        <span className="ml-auto text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {attachments.length} file{attachments.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {editable && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload attachment. Drop files here, or press Enter to browse."
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFilePicker}
            onKeyDown={handleDropzoneKeyDown}
            className={`au-dropzone relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer ${
              dragging ? "dragging" : ""
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={FILE_INPUT_ACCEPT}
              hidden
              onChange={handleInputChange}
            />
            <Upload
              className="w-8 h-8 mx-auto mb-3"
              style={{ color: dragging ? `rgb(var(--p500))` : "#cbd5e1" }}
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-slate-600 mb-1">
              Drop files here or{" "}
              <span className="underline underline-offset-2" style={{ color: `rgb(var(--p600))` }}>
                browse
              </span>
            </p>
            <p className="text-xs text-slate-400">Supports images, PDF, DOCX</p>
          </div>
        )}

        {errors.length > 0 && (
          <ul role="alert" className="space-y-0.5 list-disc list-inside">
            {errors.map((message, i) => (
              <li key={i} className="text-xs font-medium text-red-500">
                {message}
              </li>
            ))}
          </ul>
        )}

        {attachments.length > 0 ? (
          <ul className="space-y-2">
            {attachments.map((att) => {
              const isImage = isImageFile(att.name, att.mimeType);
              const isRemoving = removingIds.has(att.id);

              return (
                <li
                  key={att.id}
                  className={`au-card flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50 group hover:border-slate-200 transition-colors ${
                    isRemoving ? "removing" : ""
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                    {isImage && att.preview ? (
                      <img
                        src={att.preview}
                        alt={att.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <FileTypeIcon name={att.name} mimeType={att.mimeType} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{att.name}</p>
                    {att.size != null && (
                      <p className="text-xs text-slate-400">{formatSize(att.size)}</p>
                    )}
                  </div>

                  {editable && (
                    <button
                      type="button"
                      data-id={att.id}
                      onClick={handleRemoveClick}
                      onKeyDown={handleRemoveKeyDown}
                      className="opacity-70 group-hover:opacity-100 focus-visible:opacity-100 w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 text-slate-400 transition-all shrink-0"
                      title="Remove"
                      aria-label={`Remove ${att.name}`}
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          !editable && (
            <div className="text-center py-6">
              <Paperclip className="w-6 h-6 mx-auto mb-2 text-slate-300" aria-hidden="true" />
              <p className="text-sm text-slate-400">No attachments uploaded.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default AttachmentUploader;