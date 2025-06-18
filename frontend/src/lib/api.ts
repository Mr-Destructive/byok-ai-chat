import { API_BASE_URL } from "@/config";

async function fetchApi(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('authToken');
  
  const headers = new Headers(options.headers || {});
  
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response) {
      throw new Error('Network response was not ok');
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.error || errorMessage;
      } catch {
        try {
          const text = await response.text();
          errorMessage += ` | Response: ${text.slice(0, 100)}`;
        } catch {}
      }
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      throw error;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/event-stream')) {
      return response;
    }
    return response;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`Fetch failed for ${endpoint}: Possible CORS or network issue`, error);
    }
    throw error instanceof Error ? error : new Error('An error occurred');
  }
}

interface SendMessageParams {
  message: string;
  thread_id?: string;
  provider: string;
  model_name: string;
  stream?: boolean;  // Made optional to allow default
  branch_id?: string;
  resume_from_chunk?: number;
  stream_id?: string;
}

interface Provider {
  id: string;
  name: string;
}

interface Thread {
  id: string;
  title: string;
  provider: string;
  model_name: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
  parent_message_id?: string;
  branch_id?: string;
  type?: 'text' | 'image' | 'search' | 'research';
  metadata?: any;
}

interface ShareLink {
  link_id: string;
  thread_id: string;
  expires_at?: string;
  created_at: string;
}

interface ProvidersAndModelsResponse {
  providers: Provider[];
  models_by_provider: Record<string, string[]>;
}

interface ApiKey {
  id: string;
  provider: string;
  model_name: string;
  key_name: string;
  is_active: boolean;
  created_at: string;
}

interface ApiKeyCreate {
  provider: string;
  model_name: string;
  api_key: string;
  key_name: string;
}

export const chatApi = {
  async createThread({ title, provider, model_name }: { title: string; provider: string; model_name: string }): Promise<Thread> {
    const response = await fetchApi('/threads', {
      method: 'POST',
      body: JSON.stringify({ title, provider, model_name }),
    });
    return response.json();
  },
  async sendMessage(params: SendMessageParams): Promise<Response> {
    return fetchApi('/chat', {
      method: 'POST',
      body: JSON.stringify({
        ...params,
        stream: params.stream ?? true,  // Default to true if not provided
      }),
    });
  },

  async getThreadMessages(threadId: string, branchId?: string): Promise<Message[]> {
    const url = branchId 
      ? `/threads/${threadId}/messages?branch_id=${branchId}`
      : `/threads/${threadId}/messages`;
    const response = await fetchApi(url, { method: 'GET' });
    return response.json();
  },

  async getProvidersAndModels(): Promise<ProvidersAndModelsResponse> {
    const response = await fetchApi('/providers-and-models', { method: 'GET' });
    return response.json();
  },

  async getThreads(): Promise<Thread[]> {
    const response = await fetchApi('/threads', { method: 'GET' });
    return response.json();
  },

  async createBranch(threadId: string, messageId: string): Promise<Thread> {
    const response = await fetchApi(`/threads/${threadId}/branch/${messageId}`, { method: 'POST' });
    return response.json();
  },

  async createShareLink(threadId: string, expiresInHours?: number): Promise<ShareLink> {
    const response = await fetchApi(`/threads/${threadId}/share`, {
      method: 'POST',
      body: JSON.stringify({ expires_in_hours: expiresInHours }),
    });
    return response.json();
  },

  async getSharedThread(linkId: string, branchId?: string): Promise<Message[]> {
    const url = branchId 
      ? `/shared/${linkId}?branch_id=${branchId}`
      : `/shared/${linkId}`;
    const response = await fetchApi(url, { method: 'GET' });
    return response.json();
  },

  // Tool endpoints remain commented out
};

export const authApi = {
  async login(email: string, password: string) {
    const response = await fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  },

  async register(email: string, password: string, confirmEmail: string) {
    if (email !== confirmEmail) {
      throw new Error('Emails do not match');
    }
    const response = await fetchApi('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  },

  async getMe() {
    const response = await fetchApi('/auth/me', { method: 'GET' });
    return response.json();
  },
};

export const apiKeysApi = {
  async getApiKeys(): Promise<ApiKey[]> {
    const response = await fetchApi('/api-keys', { method: 'GET' });
    return response.json();
  },

  async createApiKey(data: ApiKeyCreate): Promise<ApiKey> {
    const response = await fetchApi('/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async deleteApiKey(keyId: string): Promise<void> {
    await fetchApi(`/api-keys/${keyId}`, { method: 'DELETE' });
  },

  async getProvidersAndModels(): Promise<ProvidersAndModelsResponse> {
    return chatApi.getProvidersAndModels();
  },
};