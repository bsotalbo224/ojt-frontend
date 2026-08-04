import { memo } from "react";
import { Save, Send, Loader2 } from "lucide-react";
import { formatLastSaved } from "../../utils/narrativeUtils";

const NarrativeActionBar = ({ saving, submitting, lastSaved, onSave, onSubmit }) => {
  const saveIndicator = saving
    ? "Saving…"
    : lastSaved
      ? `Last saved at ${formatLastSaved(lastSaved)}`
      : "Unsaved changes";

  return (
    <div className="flex items-center justify-between pt-1 pb-6">
      <p className="text-xs text-slate-400">{saveIndicator}</p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || submitting}
          aria-label="Save draft"
          className="narrative-save-btn flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
            bg-white transition-all duration-150 shadow-sm
            disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="w-4 h-4" aria-hidden="true" />
          )}
          {saving ? "Saving…" : "Save Draft"}
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || saving}
          aria-label="Submit narrative"
          className="narrative-submit-btn flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
            disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="w-4 h-4" aria-hidden="true" />
          )}
          {submitting ? "Submitting…" : "Submit Narrative"}
        </button>
      </div>
    </div>
  );
};

export default memo(NarrativeActionBar);