import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { chatApi } from "@/lib/api";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { toast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
  parent_message_id?: string;
  branch_id?: string;
}

export const SharedPage: React.FC = () => {
  const { linkId } = useParams<{ linkId: string }>();
  const [currentBranchId, setCurrentBranchId] = useState<string | undefined>();
  const [branchOptions, setBranchOptions] = useState<{ id: string; name: string }[]>([]);

  const { data: messages, error, isLoading } = useQuery({
    queryKey: ["sharedThread", linkId, currentBranchId],
    queryFn: () => chatApi.getSharedThread(linkId!, currentBranchId),
    enabled: !!linkId,
    onSuccess: (messages) => {
      const branchIds = [...new Set(messages.map((m) => m.branch_id).filter(Boolean))] as string[];
      setBranchOptions([
        { id: "", name: "Main Branch" },
        ...branchIds.map((id) => ({ id, name: `Branch ${id.slice(0, 8)}` })),
      ]);
    },
  });

  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load shared conversation",
      });
    }
  }, [error]);

  if (!messages) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-800 text-white">
        <p>{isLoading ? "Loading..." : "Conversation not found or expired"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800 text-white p-4">
      <div className="w-full max-w-2xl">
        <h2 className="text-4xl font-bold mb-6 text-center">Shared Conversation</h2>
        {branchOptions.length > 1 && (
          <div className="mb-4">
            <Select
              value={currentBranchId || ""}
              onValueChange={(value) => setCurrentBranchId(value || undefined)}
            >
              <SelectTrigger className="bg-gray-700 text-white">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branchOptions.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              timestamp={message.created_at}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

