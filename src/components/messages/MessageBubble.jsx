import { useCallback, memo } from "react";
import { Check, CheckCheck, Clock, AlertCircle, SmilePlus, Reply } from "lucide-react";
import Avatar from "../ui/Avatar";
import ReactionIcon from "../ui/ReactionIcon";
import AttachmentBlock from "./AttachmentBlock";
import { getReactionMeta } from "../../constants/reactions";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-400))]";
const PRIMARY_TEXT = "text-[rgb(var(--primary-700))]";
const SENT_BUBBLE = "bg-[rgb(var(--primary-700))] text-white";

/* -------------------------------- Helpers ---------------------------------- */

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

/* ---------------------------- Attachment Layout ----------------------------- */

function isImageAttachment(attachment) {
  return !!attachment?.attachment_url && typeof attachment.attachment_type === "string" && attachment.attachment_type.startsWith("image/");
}

function splitAttachments(attachments) {
  const images = [];
  const files = [];
  (Array.isArray(attachments) ? attachments : []).forEach((a) => {
    if (isImageAttachment(a)) images.push(a);
    else files.push(a);
  });
  return { images, files };
}

function getReplyPreviewText(replyTo) {
  if (!replyTo) return "Message unavailable";

  const text = typeof replyTo.message === "string" ? replyTo.message.trim() : "";
  if (text) return text;

  const { images, files } = splitAttachments(replyTo.attachments);
  if (images.length > 0) return images.length > 1 ? `📷 ${images.length} Photos` : "📷 Photo";
  if (files.length > 0) {
    const firstName = files[0]?.attachment_name || "File";
    return files.length > 1 ? `📄 ${firstName} (+${files.length - 1})` : `📄 ${firstName}`;
  }

  return "Message unavailable";
}

/* ----------------------------- Message Actions ------------------------------ */

const ReactionBar = memo(function ReactionBar({ reactions, isSent, onReact, messageId }) {
  if (!reactions || !reactions.total) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${isSent ? "justify-end" : "justify-start"}`} aria-label="Message reactions">
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

const ReactionToggleButton = memo(function ReactionToggleButton({ isPickerOpen, onClick }) {
  return (
    <button
      type="button"
      data-reaction-toggle-btn
      onClick={onClick}
      aria-label="Add reaction"
      aria-haspopup="menu"
      aria-expanded={isPickerOpen}
      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 hover:scale-110 active:scale-95 transition-all duration-150 ${FOCUS_RING} ${
        isPickerOpen ? "bg-gray-100 text-gray-600" : ""
      }`}
    >
      <SmilePlus className="w-3.5 h-3.5" />
    </button>
  );
});

const ReplyButton = memo(function ReplyButton({ onClick }) {
  return (
    <button
      type="button"
      data-reply-btn
      onClick={onClick}
      aria-label="Reply to message"
      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 hover:scale-110 active:scale-95 transition-all duration-150 ${FOCUS_RING}`}
    >
      <Reply className="w-3.5 h-3.5" />
    </button>
  );
});

const MessageActionGroup = memo(function MessageActionGroup({ isPickerOpen, children }) {
  return (
    <div
      className={`flex items-center gap-0.5 shrink-0 opacity-0 hover:opacity-100 md:group-hover/bubble:opacity-100 group-focus-within/bubble:opacity-100 transition-opacity duration-150 ${
        isPickerOpen ? "opacity-100" : ""
      }`}
    >
      {children}
    </div>
  );
});

/* -------------------------------- Reply Preview ------------------------------ */

const ReplyPreview = memo(function ReplyPreview({ replyTo, isSent }) {
  if (!replyTo) return null;

  const senderName = getFullName(replyTo);
  const previewText = getReplyPreviewText(replyTo);

  return (
    <div
      className={`max-w-full px-2 py-0.5 rounded-md border-l border-gray-300/80 bg-gray-500/5 ${
        isSent ? "self-end" : "self-start"
      }`}
    >
      <p className={`text-[10px] font-semibold leading-tight truncate ${PRIMARY_TEXT}`}>{senderName}</p>
      <p className="text-[10.5px] leading-tight text-gray-500 truncate">{previewText}</p>
    </div>
  );
});

/* -------------------------------- Message Bubble ------------------------------ */

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
  onReply,
}) {
  const ts = resolveTimestamp(item);

  const sentCorners = ["rounded-2xl", !isGroupStart && "rounded-tr-md", !isGroupEnd && "rounded-br-md"].filter(Boolean).join(" ");
  const recvCorners = ["rounded-2xl", !isGroupStart && "rounded-tl-md", !isGroupEnd && "rounded-bl-md"].filter(Boolean).join(" ");

  const senderName = getFullName(item);
  const hasText = typeof item.message === "string" && item.message.trim() !== "";

  const { images: imageAttachments, files: fileAttachments } = splitAttachments(item.attachments);
  const hasImages = imageAttachments.length > 0;
  const hasFiles = fileAttachments.length > 0;
  const hasBubble = hasText || hasFiles;
  const imageFirst = hasImages && hasFiles;
  const imageOnlyItem = hasImages ? { ...item, attachments: imageAttachments } : null;
  const fileOnlyItem = hasFiles ? { ...item, attachments: fileAttachments } : null;

  const bubbleClass = `px-4 py-2.5 text-xs leading-relaxed shadow-sm transition-shadow duration-150 ${
    isSent ? `${sentCorners} ${SENT_BUBBLE}` : `bg-white border border-gray-200 text-gray-800 ${recvCorners}`
  } ${item.pending ? "opacity-70" : ""}`;

  const handleToggleClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onTogglePicker(item.message_id, rect, e.currentTarget);
  }, [onTogglePicker, item.message_id]);

  const handleReplyClick = useCallback(() => {
    onReply?.(item);
  }, [onReply, item]);

  const bubbleNode = hasBubble && (
    <div className={bubbleClass}>
      {hasText && <div>{renderMessageContent(item.message, item.mentions)}</div>}
      {hasFiles && (
        <div className={hasText ? "mt-1" : undefined}>
          <AttachmentBlock item={fileOnlyItem} isSent={isSent} onImageClick={onImageClick} />
        </div>
      )}
    </div>
  );

  const imageNode = hasImages && (
    <div className={item.pending ? "opacity-70" : ""}>
      <AttachmentBlock item={imageOnlyItem} isSent={isSent} onImageClick={onImageClick} />
    </div>
  );

  const actionButtons = item.message_id != null && (
    <MessageActionGroup isPickerOpen={isPickerOpen}>
      <ReplyButton onClick={handleReplyClick} />
      <ReactionToggleButton isPickerOpen={isPickerOpen} onClick={handleToggleClick} />
    </MessageActionGroup>
  );

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
          {isSent && actionButtons}

          <div className={`flex flex-col gap-1 ${isSent ? "items-end" : "items-start"}`}>
            {item.reply_to && <ReplyPreview replyTo={item.reply_to} isSent={isSent} />}

            {imageFirst ? (
              <>
                {imageNode}
                {bubbleNode}
              </>
            ) : (
              <>
                {bubbleNode}
                {imageNode}
              </>
            )}
          </div>

          {!isSent && actionButtons}
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