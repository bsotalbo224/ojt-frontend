import { memo } from "react";
import { Lock } from "lucide-react";

const READ_ONLY_MESSAGES = {
  submitted: "This narrative has been submitted and is locked for editing.",
  approved: "This narrative has been approved and is locked for editing.",
};

const ReadOnlyBanner = ({ status }) => {
  const message = READ_ONLY_MESSAGES[status];
  if (!message) return null;

  return (
    <div className="flex gap-3 items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
      <Lock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
};

export default memo(ReadOnlyBanner);