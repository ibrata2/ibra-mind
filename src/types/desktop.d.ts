export type ProviderProtocol = 'openai-compatible' | 'gemini' | 'anthropic';

export type AIProviderSummary = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  protocol: ProviderProtocol;
  hasApiKey: boolean;
  hasCustomHeaders?: boolean;
  enabled: boolean;
  isDefault: boolean;
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
  requestCount: number;
  errorCount: number;
  totalTokens?: number;
  lastResponseMs?: number;
  lastTest?: string;
  lastError?: string;
};

export type ProviderDraft = Omit<AIProviderSummary, 'hasApiKey' | 'hasCustomHeaders' | 'requestCount' | 'errorCount' | 'lastResponseMs' | 'lastTest' | 'lastError'> & { apiKey?: string; customHeaders?: string };
export type ProviderMessageContent = string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];


declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  }
  interface ImportMeta { readonly env: ImportMetaEnv }
  interface Window {
    ibraMind?: {
      auth: { takePending: () => Promise<string>; acknowledge: (url: string) => Promise<{ ok: boolean }>; onCallback: (handler: (url: string) => void) => () => void };
      media: { requestMicrophone: () => Promise<{ ok: boolean; error?: string }> };
      providers: {
        list: () => Promise<{ available: boolean; providers: AIProviderSummary[]; error?: string }>;
        save: (provider: ProviderDraft) => Promise<{ ok: boolean; provider?: AIProviderSummary; error?: string }>;
        remove: (id: string) => Promise<{ ok: boolean; error?: string }>;
        models: (id: string) => Promise<{ ok: boolean; models: string[]; error?: string }>;
        test: (id: string) => Promise<{ ok: boolean; message: string; responseMs?: number; error?: string }>;
        complete: (request: { providerId: string; messages: { role: 'system' | 'user' | 'assistant'; content: ProviderMessageContent }[]; maxTokens?: number; temperature?: number }) => Promise<{ ok: boolean; text?: string; error?: string; responseMs?: number }>;
        transcribe: (request: { providerId: string; fileName: string; mimeType: string; base64: string }) => Promise<{ ok: boolean; text?: string; segments?: { start: number; end: number; text: string }[]; error?: string }>;
      };
    };
  }
}
