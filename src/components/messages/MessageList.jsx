import { memo } from "react";
import MessageBubble from "./MessageBubble";
import SystemMessageCard from "./SystemMessageCard";

const MessageList = memo(function MessageList({
  grouped,
  groupingMap,
  userId,
  isGroupChat,
  reactionPicker,
  handleReact,
  handleTogglePicker,
  handleImageClick,
  DateSeparator,
  onReply,
  onJumpToReply,
  registerMessageRef,
  highlightedMessageId,
}) {
  return (
    <div className="flex flex-col">
      {grouped.map((item) => {
        if (item.type === "date-label") {
          return <DateSeparator key={item.id} label={item.label} />;
        }

        if (item.message_type === "system" || item.type === "system" || item.is_system) {
          return <SystemMessageCard key={item.message_id ?? item.tempId} item={item} />;
        }

        const isSent = userId != null && item.sender_id === userId;
        const msgKey = item.message_id ?? item.tempId;
        const { isGroupStart, isGroupEnd } = groupingMap.get(msgKey) ?? { isGroupStart: true, isGroupEnd: true };

        return (
          <div
            key={msgKey}
            tabIndex={-1}
            ref={(node) => {
              // Registry: real messages only, ignore optimistic/null ids.
              if (item.message_id == null) return;
              registerMessageRef?.(item.message_id, node);
            }}
          >
            <MessageBubble
              item={item}
              isSent={isSent}
              isGroupStart={isGroupStart}
              isGroupEnd={isGroupEnd}
              isGroupChat={isGroupChat}
              onReact={handleReact}
              isPickerOpen={reactionPicker?.messageId === item.message_id}
              onTogglePicker={handleTogglePicker}
              onImageClick={handleImageClick}
              onReply={onReply}
              onJumpToReply={onJumpToReply}
              highlightedMessageId={highlightedMessageId}
            />
          </div>
        );
      })}
    </div>
  );
});

export default MessageList;