import { memo } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import Avatar from "../ui/Avatar";

const BADGE_SURFACE = "bg-[rgb(var(--primary-50))] border border-[rgb(var(--primary-100))]";
const PRIMARY_TEXT = "text-[rgb(var(--primary-700))]";

const GroupAvatar = memo(function GroupAvatar({ label }) {
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-100 text-gray-500"
      role="img"
      aria-label={label}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m5-2.13a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm6 1a4 4 0 1 0 0-8" />
      </svg>
    </div>
  );
});

const ConversationHeader = memo(function ConversationHeader({ selectedConversation, selectedName, isGroupChat, isOnline, onBack }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shadow-sm shrink-0">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Back to conversations"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-all md:hidden shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      )}

      <div className="relative shrink-0">
        {isGroupChat ? (
          <GroupAvatar label={selectedName} />
        ) : (
          <Avatar name={selectedName} src={selectedConversation.photo} size="md" />
        )}
        {isOnline && !isGroupChat && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white bg-[rgb(var(--primary-500))]" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold text-gray-800 truncate">{selectedName}</h3>
          {isOnline && !isGroupChat && (
            <span className="text-[10px] font-semibold shrink-0 text-[rgb(var(--primary-600))]">Online</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {!isGroupChat && selectedConversation.role && (
            <span className="text-[10px] text-gray-500 capitalize font-medium">{selectedConversation.role}</span>
          )}
          {isGroupChat && selectedConversation.member_count != null && (
            <span className="text-[10px] text-gray-500 font-medium">{selectedConversation.member_count} members</span>
          )}
          {(selectedConversation.role || isGroupChat) && <span className="text-[10px] text-gray-300">·</span>}
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${BADGE_SURFACE} ${PRIMARY_TEXT}`}>
            <BookOpen className="w-2.5 h-2.5" />OJT Consultation
          </span>
        </div>
      </div>
    </div>
  );
});

export default ConversationHeader;