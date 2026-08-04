import { memo } from "react";
import { CheckCircle2, Clock, RotateCcw, Send } from "lucide-react";

/* ─────────────────────────────────────────
   Status config
   Frozen (including each entry) so nothing downstream can mutate it
   at runtime — it's shared, read-only lookup data.
───────────────────────────────────────────*/
const STATUS_CONFIG = Object.freeze({
  draft: Object.freeze({
    label: "Draft",
    icon: Clock,
    className: "bg-slate-100 text-slate-600 border border-slate-300",
    dot: "bg-slate-400",
  }),
  submitted: Object.freeze({
    label: "Submitted",
    icon: Send,
    className: "border",
    dot: null,
  }),
  revision: Object.freeze({
    label: "For Revision",
    icon: RotateCcw,
    className: "bg-amber-50 text-amber-700 border border-amber-300",
    dot: "bg-amber-500",
  }),
  approved: Object.freeze({
    label: "Approved",
    icon: CheckCircle2,
    className: "border",
    dot: null,
  }),
});

// Statuses that use the theme accent color instead of a fixed palette.
const PRIMARY_STATUSES = new Set(["submitted", "approved"]);

/* ─────────────────────────────────────────
   StatusBadge
   Wrapped in React.memo since it's rendered in lists/headers and only
   needs to re-render when `status` itself changes.
───────────────────────────────────────────*/
const StatusBadge = memo(function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status];

  if (!cfg && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(`StatusBadge: unrecognized status "${status}" — falling back to "draft".`);
  }

  const resolved = cfg || STATUS_CONFIG.draft;
  const Icon = resolved.icon;
  const isPrimary = PRIMARY_STATUSES.has(status);

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full ${resolved.className}`}
      style={
        isPrimary
          ? {
              backgroundColor: `rgb(var(--p50))`,
              color: `rgb(var(--p700))`,
              borderColor: `rgb(var(--p400))`,
            }
          : undefined
      }
    >
      <span
        className={resolved.dot ? `w-1.5 h-1.5 rounded-full ${resolved.dot}` : "w-1.5 h-1.5 rounded-full"}
        style={isPrimary ? { backgroundColor: `rgb(var(--p500))` } : undefined}
        aria-hidden="true"
      />
      <Icon className="w-3 h-3" aria-hidden="true" />
      {resolved.label}
    </span>
  );
});

export default StatusBadge;