import { useCallback, memo } from "react";
import { Check, CheckCheck, Clock, AlertCircle, SmilePlus } from "lucide-react";
import Avatar from "../../ui/Avatar";
import ReactionIcon from "../../ui/ReactionIcon";
import AttachmentBlock from "./AttachmentBlock";
import { getReactionMeta } from "../../../constants/reactions";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-400))]";
const PRIMARY_TEXT = "text-[rgb(var(--primary-700))]";
const SENT_BUBBLE = "bg-[rgb(var(--primary-700))] text-white";

/* ----------------------------- Local helpers ------------------------------ */
// Duplicated (not moved) from ChatWindow.jsx, which still uses its own copies
// for date-grouping and the conversation header — keeping MessageBubble
// self-contained avoids reaching back into ChatWindow for shared utilities.

const getFullName = (user = {}) => {
  if (user.f_name || user.l_name) return `${user.f_name ?? ""} ${user.l_name ?? ""}`.trim();
  return user.name || "Unknown";
};

const resolveTimestamp = (item) => item?.created_at || item?.sent_at || null;

function formatTime(ts) {
  if (!ts) return "";
  try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

function renderMessageContent(text, mentions) {
  if (!text) return null;
  if (!Array.isArray(mentions) || mentions.length === 0) return text;

  const names = mentions
    .map((m) => {
      if (m.mention_type === "everyone") return "everyone";
      if (m.mention_type === "student") return "student";
      if (m.mention_type === "coordinator") return "coordinator";
      return `${m.f_name ?? ""} ${m.l_name ?? ""}`.trim();
    })
    .filter(Boolean);

  if (names.length === 0) return text;

  const escaped = names
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);

  const regex = new RegExp(`@(${escaped.join("|")})`, "gi");
  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <span key={`mention-${key++}`} className={`font-semibold ${PRIMARY_TEXT}`}>
        {match[0]}
      </span>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return parts;
}

/* -------------------------------------------------------------------------- */

const ReactionBar = memo(function ReactionBar({ reactions, isSent, onReact, messageId }) {
  if (!reactions || !reactions.total) return null;

  return (
    <div className={`flex flex-wrap gap-1 mt-1.5 ${isSent ? "justify-end" : "justify-start"}`} aria-label="Message reactions">
      {reactions.reactions.map((r) => {
        const meta = getReactionMeta(r.reaction_code);
        return (
          <button
            key={r.reaction_code}
            type="button"
            onClick={() => onReact?.(messageId, r.reaction_code)}
            title={r.users.map((u) => getFullName(u)).join(", ")}
            aria-label={`${meta?.label ?? r.reaction_code} reaction, ${r.count}`}
            className={`group inline-flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full bg-white border border-gray-200/80 text-[10.5px] shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300 active:translate-y-0 active:scale-95 ${FOCUS_RING}`}
          >
            <ReactionIcon reactionCode={r.reaction_code} size="xs" decorative />
            <span className="text-gray-500 font-semibold tabular-nums group-hover:text-gray-700 transition-colors">
              {r.count}
            </span>
          </button>
        );
      })}
    </div>
  );
});

const ReactionToggleButton = memo(function ReactionToggleButton({ isPickerOpen, onClick, orderFirst }) {
  return (
    <button
      type="button"
      data-reaction-toggle-btn
      onClick={onClick}
      aria-label="Add reaction"
      aria-haspopup="menu"
      aria-expanded={isPickerOpen}
      className={`${orderFirst ? "order-first" : ""} shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 opacity-0 md:group-hover/bubble:opacity-100 hover:opacity-100 hover:bg-gray-100 hover:text-gray-600 hover:scale-110 active:scale-95 transition-all duration-150 focus-visible:opacity-100 ${FOCUS_RING} ${
        isPickerOpen ? "opacity-100 bg-gray-100 text-gray-600" : ""
      }`}
    >
      <SmilePlus className="w-3.5 h-3.5" />
    </button>
  );
});

const MessageBubble = memo(function MessageBubble({
  item,
  isSent,
  isGroupStart,
  isGroupEnd,
  isGroupChat,
  onReact,
  isPickerOpen,
  onTogglePicker,
  onImageClick,
}) {
  const ts = resolveTimestamp(item);

  const sentCorners = ["rounded-2xl", !isGroupStart && "rounded-tr-md", !isGroupEnd && "rounded-br-md"].filter(Boolean).join(" ");
  const recvCorners = ["rounded-2xl", !isGroupStart && "rounded-tl-md", !isGroupEnd && "rounded-bl-md"].filter(Boolean).join(" ");

  const senderName = getFullName(item);
  const hasText = typeof item.message === "string" && item.message.trim() !== "";

  const handleToggleClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onTogglePicker(item.message_id, rect, e.currentTarget);
  }, [onTogglePicker, item.message_id]);

  return (
    <div
      data-reaction-picker-root
      className={`flex gap-2 items-end ${isSent ? "flex-row-reverse" : "flex-row"} ${isGroupStart ? "mt-3" : "mt-1"}`}
    >
      {!isSent && (
        <div className="shrink-0 w-7 self-end mb-1">
          {isGroupEnd ? <Avatar name={senderName} src={item.photo} size="sm" /> : <div className="w-7 h-7" />}
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[78%] sm:max-w-[70%] md:max-w-[58%] ${isSent ? "items-end" : "items-start"}`}>
        {!isSent && isGroupChat && isGroupStart && (
          <span className="text-[10px] font-semibold text-gray-500 px-1">{senderName}</span>
        )}

        <div className="relative group/bubble flex items-center gap-1">
          {isSent && item.message_id != null && (
            <ReactionToggleButton isPickerOpen={isPickerOpen} onClick={handleToggleClick} orderFirst />
          )}

          <div
            className={`px-4 py-2.5 text-xs leading-relaxed shadow-sm transition-shadow duration-150 ${
              isSent ? `${sentCorners} ${SENT_BUBBLE}` : `bg-white border border-gray-200 text-gray-800 ${recvCorners}`
            } ${item.pending ? "opacity-70" : ""}`}
          >
            <AttachmentBlock item={item} isSent={isSent} onImageClick={onImageClick} />
            {hasText && renderMessageContent(item.message, item.mentions)}
          </div>

          {!isSent && item.message_id != null && (
            <ReactionToggleButton isPickerOpen={isPickerOpen} onClick={handleToggleClick} />
          )}
        </div>

        <ReactionBar reactions={item.reactions} isSent={isSent} onReact={onReact} messageId={item.message_id} />

        {isGroupEnd && (
          <div className={`flex items-center gap-1.5 px-1 ${isSent ? "flex-row-reverse" : "flex-row"}`}>
            <span className="text-[10px] text-gray-400">{formatTime(ts)}</span>
            {item.failed && <span className="text-[10px] text-red-400">Failed to send</span>}
            {isSent && !item.failed && (
              <span className="opacity-80">
                {item.pending ? (
                  <Clock className="w-3 h-3 text-gray-300" />
                ) : item.is_read ? (
                  <CheckCheck className="w-3 h-3 text-[rgb(var(--primary-500))]" />
                ) : item.delivered ? (
                  <CheckCheck className="w-3 h-3 text-gray-400" />
                ) : (
                  <Check className="w-3 h-3 text-gray-400" />
                )}
              </span>
            )}
            {isSent && item.failed && <AlertCircle className="w-3 h-3 text-red-400" />}
            {isSent && isGroupChat && !item.pending && !item.failed && Number.isFinite(item.read_count) && (
              <span className="text-[9px] text-gray-400">
                {item.read_count > 0 ? `· Read by ${item.read_count}` : "· Sent"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default MessageBubble;