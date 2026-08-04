import { memo } from "react";
import { AlertCircle } from "lucide-react";

const NarrativeFeedback = ({ feedback, status }) => {
  if (!feedback || status === "approved") return null;

  return (
    <div className="flex gap-3 items-start bg-amber-50 border border-amber-200 border-l-4 border-l-amber-400 rounded-xl p-4 shadow-sm">
      <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1.5">
          Coordinator Feedback
        </p>
        <p className="text-sm text-amber-900 leading-relaxed">{feedback}</p>
      </div>
    </div>
  );
};

export default memo(NarrativeFeedback);