import { useCallback, useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const AlertModal = ({ open, title, message, onClose }) => {
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedRef.current = document.activeElement;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }

      if (e.key !== "Tab") return;

      // Keep focus cycling within the dialog while it's open.
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
  }, [open, onClose]);

  // Prevent clicks inside the dialog from bubbling to the backdrop.
  const stopPropagation = useCallback((e) => e.stopPropagation(), []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-modal-title"
        aria-describedby="alert-modal-message"
        onClick={stopPropagation}
        className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 z-10 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-500" aria-hidden="true" />
          </div>
          <h2 id="alert-modal-title" className="text-base font-bold text-slate-800">
            {title}
          </h2>
        </div>

        <p id="alert-modal-message" className="text-sm text-slate-600 leading-relaxed mb-6">
          {message}
        </p>

        <div className="flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold
              bg-linear-to-br from-slate-700 to-slate-800 text-white
              hover:from-slate-800 hover:to-slate-900
              transition-all duration-150 shadow-sm"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;