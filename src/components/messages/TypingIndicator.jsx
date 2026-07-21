import { memo } from "react";

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

export default TypingIndicator;