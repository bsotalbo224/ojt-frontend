import { useEffect, useRef, useState, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, X, Download, ChevronLeft, ChevronRight } from "lucide-react";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-400))]";

const MODAL_FOCUSABLE_SELECTOR = 'button, a[href], [tabindex]:not([tabindex="-1"])';

const IMAGE_ZOOM_MIN = 1;
const IMAGE_ZOOM_MAX = 4;
const IMAGE_ZOOM_STEP = 0.25;

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

  return createPortal(
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
    </div>,
    document.body
  );
});

export default ImageModal;