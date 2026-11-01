import { getCloudClient } from './supabase';

export const PASSWORD_RECOVERY_KEY = 'ibra-mind-password-recovery-pending';

export async function completeDesktopAuthCallback(value: string) {
  const client = getCloudClient();
  if (!client) throw new Error('أكمل إعداد اتصال Supabase في إعدادات التطبيق أولاً.');
  const callback = new URL(value);
  if (callback.protocol !== 'ibramind:' || callback.hostname !== 'auth') throw new Error('رابط مصادقة التطبيق غير صالح.');
  const hash = new URLSearchParams(callback.hash.slice(1));
  const type = callback.searchParams.get('type') ?? hash.get('type');
  const code = callback.searchParams.get('code');
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else if (hash.get('access_token') && hash.get('refresh_token')) {
    const { error } = await client.auth.setSession({ access_token: hash.get('access_token')!, refresh_token: hash.get('refresh_token')! });
    if (error) throw error;
  } else throw new Error('رابط المصادقة لا يحتوي رمز جلسة صالحاً.');
  if (type === 'recovery') localStorage.setItem(PASSWORD_RECOVERY_KEY, 'pending');
  else localStorage.removeItem(PASSWORD_RECOVERY_KEY);
  return type === 'recovery' ? 'أدخل كلمة مرور جديدة في إعدادات الحساب والسحابة.' : 'اكتمل تأكيد الحساب.';
}
