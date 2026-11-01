import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type CloudConfig = { url: string; key: string };
const CONFIG_KEY = 'ibra-mind-cloud-config-v1';
let cachedSignature = '';
let cachedClient: SupabaseClient | null = null;

export function readCloudConfig(): CloudConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { url: import.meta.env.VITE_SUPABASE_URL ?? '', key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '' };
    const parsed = JSON.parse(raw) as CloudConfig;
    return { url: parsed.url || '', key: parsed.key || '' };
  } catch { return { url: '', key: '' }; }
}

export function saveCloudConfig(config: CloudConfig) {
  const normalized = { url: config.url.trim().replace(/\/$/, ''), key: config.key.trim() };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
  cachedSignature = '';
  cachedClient = null;
  return normalized;
}

export function getCloudClient(): SupabaseClient | null {
  const { url, key } = readCloudConfig();
  if (!url || !key) return null;
  const signature = `${url}|${key}`;
  if (signature !== cachedSignature) {
    cachedSignature = signature;
    const desktopStorage = window.ibraMind?.auth.storage;
    const storage = desktopStorage ? {
      getItem: async (storageKey: string) => {
        const encrypted = await desktopStorage.getItem(storageKey);
        if (encrypted) return encrypted;
        const legacy = localStorage.getItem(storageKey);
        if (legacy) { await desktopStorage.setItem(storageKey, legacy); localStorage.removeItem(storageKey); }
        return legacy;
      },
      setItem: (storageKey: string, value: string) => desktopStorage.setItem(storageKey, value),
      removeItem: (storageKey: string) => desktopStorage.removeItem(storageKey),
    } : localStorage;
    cachedClient = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: !desktopStorage, storage } });
  }
  return cachedClient;
}

export function cloudConfigured() { return Boolean(readCloudConfig().url && readCloudConfig().key); }
