import { useCallback, useEffect, useRef } from "react";
import { Loader2, Send } from "lucide-react";
import "./editor.css";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ConfirmModal = ({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedRef.current = document.activeElement;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (loading) return; // don't allow dismissing while submitting
        e.stopPropagation();
        onCancel?.();
        return;
      }

      if (e.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR);
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, loading, onCancel]);

  const stopPropagation = useCallback((e) => e.stopPropagation(), []);

  const handleBackdropClick = useCallback(() => {
    if (!loading) onCancel?.();
  }, [loading, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleBackdropClick} />

      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        onClick={stopPropagation}
        className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 z-10 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `rgb(var(--p50))` }}
          >
            <Send className="w-5 h-5" style={{ color: `rgb(var(--p600))` }} aria-hidden="true" />
          </div>
          <h2 id="confirm-modal-title" className="text-base font-bold text-slate-800">
            {title}
          </h2>
        </div>

        <p id="confirm-modal-message" className="text-sm text-slate-600 leading-relaxed mb-6">
          {message}
        </p>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-semibold border-2 border-slate-200 text-slate-600
              hover:bg-slate-50 hover:border-slate-300 transition-all duration-150
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            disabled={loading}
            className="cm-confirm-btn flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white
              disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" aria-hidden="true" />
                {confirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;