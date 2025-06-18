import React from "react";
import { MessageSquare } from "lucide-react";

interface Thread {
  id: string;
  title: string;
  provider: string;
  model_name: string;
  created_at: string;
  updated_at: string;
}

interface ChatHistorySidebarProps {
  threads: Thread[];
  isThreadsLoading: boolean;
  selectedThread: Thread | null;
  handleThreadSelect: (thread: Thread) => void;
}

export function ChatHistorySidebar({
  threads,
  isThreadsLoading,
  selectedThread,
  handleThreadSelect
}: ChatHistorySidebarProps) {
  return (
    <div className="flex flex-col gap-2 mt-6">
      <h3 className="text-base font-semibold text-sidebar-foreground mb-1">Chats</h3>
      <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1" style={{ maxHeight: '180px' }}>
        {isThreadsLoading ? (
          <div className="text-xs text-sidebar-foreground/60 italic text-center py-4">Loading chats...</div>
        ) : threads.length === 0 ? (
          <div className="text-xs text-sidebar-foreground/60 italic text-center py-4">No chats yet.</div>
        ) : (
          threads.map((thread) => (
            <div
              key={thread.id}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-sidebar-accent/70 cursor-pointer transition-all ${selectedThread && selectedThread.id === thread.id ? 'bg-sidebar-accent/70' : ''}`}
              onClick={() => handleThreadSelect(thread)}
            >
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <span className="truncate text-sm text-sidebar-foreground">{thread.title}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
