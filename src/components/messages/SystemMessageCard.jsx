import { memo } from "react";
import { FileText, ScrollText } from "lucide-react";

const BADGE_SURFACE = "bg-[rgb(var(--primary-50))] border border-[rgb(var(--primary-100))]";
const PRIMARY_TEXT = "text-[rgb(var(--primary-700))]";

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

export default SystemMessageCard;