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
          <MessageBubble
            key={msgKey}
            item={item}
            isSent={isSent}
            isGroupStart={isGroupStart}
            isGroupEnd={isGroupEnd}
            isGroupChat={isGroupChat}
            onReact={handleReact}
            isPickerOpen={reactionPicker?.messageId === item.message_id}
            onTogglePicker={handleTogglePicker}
            onImageClick={handleImageClick}
          />
        );
      })}
    </div>
  );
});

export default MessageList;