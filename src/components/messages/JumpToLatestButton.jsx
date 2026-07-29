import { memo, useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-400))] focus-visible:ring-offset-2";
// Matches the transition-all duration-300 below.
const EXIT_ANIMATION_MS = 300;

// Label
function getLabel(newMessageCount) {
  if (!newMessageCount || newMessageCount <= 0) return "Jump to Latest";
  return `${newMessageCount} New Message${newMessageCount === 1 ? "" : "s"}`;
}

// Pure presentation: renders the floating pill, animates on `show`, and calls
// onClick. Scrolling, unread counting, and visibility logic all live in
// ChatWindow — this component owns none of it.
const JumpToLatestButton = memo(function JumpToLatestButton({ show, newMessageCount = 0, onClick }) {
  const label = getLabel(newMessageCount);

  // Mount Lifecycle
  const [shouldRender, setShouldRender] = useState(show);
  const exitTimerRef = useRef(null);

  useEffect(() => {
    if (show) {
      if (exitTimerRef.current != null) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      setShouldRender(true);
      return;
    }
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      setShouldRender(false);
    }, EXIT_ANIMATION_MS);

    return () => {
      if (exitTimerRef.current != null) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [show]);

  if (!shouldRender) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!show}
      aria-hidden={!show}
      aria-label={label}
      tabIndex={show ? 0 : -1}
      className={`absolute bottom-4 right-4 z-10 inline-flex items-center gap-1.5 h-9 sm:h-10 pl-1.5 pr-4 sm:pl-2 sm:pr-5 rounded-full bg-white border border-gray-200 shadow-md text-[11px] sm:text-xs font-semibold text-[rgb(var(--primary-700))] transition-all duration-300 ease-out hover:shadow-lg hover:-translate-y-0.5 hover:border-[rgb(var(--primary-200))] active:translate-y-0 ${FOCUS_RING} ${
        show ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
      }`}
    >
      <span className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[rgb(var(--primary-50))] text-[rgb(var(--primary-600))] shrink-0">
        <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
});

export default JumpToLatestButton;