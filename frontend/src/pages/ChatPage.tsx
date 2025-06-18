import { useParams } from "react-router-dom";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { useAppContext } from "@/context/AppContext";

interface ChatPageProps {
  currentThreadId?: string;
  setCurrentThreadId: (threadId: string | undefined) => void;
}

export function ChatPage({ currentThreadId, setCurrentThreadId }: ChatPageProps) {
  const { threadId } = useParams<{ threadId?: string }>();
  const { selectedModel, selectedProvider, setSelectedModel, setSelectedProvider } = useAppContext();

  const activeThreadId = threadId || currentThreadId;

  return (
    <ChatInterface
      selectedModel={selectedModel}
      selectedProvider={selectedProvider}
      currentThreadId={activeThreadId}
      setCurrentThreadId={setCurrentThreadId}
      onThreadCreated={setCurrentThreadId}
      onModelChange={setSelectedModel}
      onProviderChange={setSelectedProvider}
    />
  );
}
