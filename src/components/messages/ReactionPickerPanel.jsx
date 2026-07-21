import { useEffect, useRef, useCallback, memo } from "react";
import ReactionIcon from "../../ui/ReactionIcon";
import { REACTION_CODES, getReactionMeta } from "../../../constants/reactions";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-400))]";

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

export default ReactionPickerPanel;