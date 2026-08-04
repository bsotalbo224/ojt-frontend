import { memo } from "react";
import { ArrowLeft, FileText, ChevronDown } from "lucide-react";
import StatusBadge from "../editor/StatusBadge";
import { PAPER_SIZES } from "../editor/EditorConstants";
import { formatLastSaved } from "../../utils/narrativeUtils";

const NarrativeHeader = ({
  onBack,
  status,
  lastSaved,
  paperSize,
  onPaperSizeChange,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-slate-200/80 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to logs"
          title="Back to logs"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="narrative-icon-badge w-7 h-7 rounded-lg flex items-center justify-center shadow-sm shrink-0">
            <FileText className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-800 leading-none truncate">Daily Narrative</h1>
            <p className="text-[11px] text-slate-400 leading-none mt-0.5 hidden sm:block">
              Document your daily OJT experience
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-[11px] text-slate-400 hidden sm:block">
              Saved {formatLastSaved(lastSaved)}
            </span>
          )}

          <StatusBadge status={status} />

          {/* Paper selector */}
          <div className="relative hidden sm:flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <div className="relative">
              <select
                value={paperSize}
                onChange={(e) => onPaperSizeChange(e.target.value)}
                aria-label="Paper size"
                className="narrative-paper-select appearance-none text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 cursor-pointer transition-colors outline-none"
              >
                {Object.entries(PAPER_SIZES).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default memo(NarrativeHeader);