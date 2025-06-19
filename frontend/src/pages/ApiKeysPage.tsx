import React from "react";
import { ApiKeyManager } from "@/components/api-keys/ApiKeyManager";

import { KeyRound } from "lucide-react";

export default function ApiKeysPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      {/* Sticky Top Nav */}
      <header className="sticky top-0 z-50 w-full bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <KeyRound className="w-6 h-6 text-blue-500" />
          <h1 className="text-lg font-semibold text-slate-200">API Key Management</h1>
        </div>
        {/* Theme Toggle Placeholder - Kept for structure, styling adjusted */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Theme</span>
          <button className="rounded-full p-1.5 hover:bg-slate-700 transition-colors">
            {/* Replace with actual theme icon toggle */}
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7.5" stroke="#7dd3fc" strokeWidth="1.5" /></svg>
          </button>
        </div>
      </header>
      {/* Main Content Scrollable Area */}
      <main className="flex-1 flex flex-col items-center justify-start py-8 px-4 overflow-y-auto">
        {/* Adjusted container for ApiKeyManager */}
        <div className="w-full max-w-3xl">
          <p className="mb-6 text-sm text-slate-400 text-center">
            Manage your API keys for all providers here. Keys are stored securely in your browser and never leave your device. Add, edit, or remove keys to enable chat with different providers.
          </p>
          <ApiKeyManager />
        </div>
      </main>
    </div>
  );
}
