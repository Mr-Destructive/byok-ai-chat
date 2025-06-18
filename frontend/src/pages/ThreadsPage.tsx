import { useQuery } from "@tanstack/react-query";
import { chatApi } from "@/lib/api";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Thread {
  id: string;
  name: string;
  created_at: string;
  branches?: { id: string; name: string }[];
}

export function ThreadsPage() {
  const { toast } = useToast();

  const { data: threads, isLoading, error } = useQuery({
    queryKey: ["threads"],
    queryFn: () => chatApi.getThreads(),
  });

  if (isLoading) return <div className="text-white text-center p-4">Loading threads...</div>;
  if (error) {
    toast({ title: "Error", description: "Failed to load threads", variant: "destructive" });
    return <div className="text-red-400 text-center p-4">Error loading threads</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-white mb-4">Your Threads</h1>
      <div className="space-y-4">
        {threads?.map((thread: Thread) => (
          <div key={thread.id} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
            <Link to={`/threads/${thread.id}`} className="text-blue-400 hover:underline">
              {thread.name || `Thread ${thread.id}`}
            </Link>
            <p className="text-slate-400 text-sm">
              Created: {new Date(thread.created_at).toLocaleString()}
            </p>
            {thread.branches && thread.branches.length > 0 && (
              <div className="mt-2">
                <p className="text-slate-300 text-sm">Branches:</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {thread.branches.map((branch) => (
                    <Link
                      key={branch.id}
                      to={`/threads/${branch.id}`}
                      className="text-blue-400 hover:underline text-sm"
                    >
                      {branch.name || `Branch ${branch.id}`}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {threads?.length === 0 && (
          <p className="text-slate-400">No threads yet. Start a new conversation in Chat!</p>
        )}
      </div>
    </div>
  );
}
