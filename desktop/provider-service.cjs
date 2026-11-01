const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const STORE_NAME = 'ai-providers.secure.json';
const protocols = new Set(['openai-compatible', 'gemini', 'anthropic', 'custom-rest']);

function publicProvider(provider) {
  const { encryptedApiKey, customHeaders, customRequestTemplate, customResponseMapping, ...metadata } = provider;
  return {
    ...metadata,
    customRequestTemplate: customRequestTemplate ? JSON.stringify(customRequestTemplate) : undefined,
    customResponseMapping: customResponseMapping ? JSON.stringify(customResponseMapping) : undefined,
    hasApiKey: Boolean(encryptedApiKey), hasCustomHeaders: Boolean(customHeaders && Object.keys(customHeaders).length),
  };
}

function parseCustomHeaders(raw) {
  if (!raw) return {};
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('رؤوس HTTP الإضافية يجب أن تكون JSON صالحاً مثل {"x-client":"ibra"}.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('الرؤوس الإضافية يجب أن تكون كائناً من أسماء وقيم نصية.');
  const protectedNames = new Set(['authorization', 'content-type', 'host', 'content-length', 'x-api-key', 'x-goog-api-key', 'anthropic-version']);
  const headers = {};
  for (const [name, headerValue] of Object.entries(value)) {
    const normalized = name.trim().toLowerCase();
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(name) || protectedNames.has(normalized)) throw new Error(`اسم الرأس ${name} غير صالح أو محمي.`);
    if (typeof headerValue !== 'string' || /[\r\n]/.test(headerValue) || headerValue.length > 2000) throw new Error(`قيمة الرأس ${name} يجب أن تكون نصاً قصيراً بسطر واحد.`);
    headers[name] = headerValue;
  }
  if (Object.keys(headers).length > 20) throw new Error('الحد الأقصى للرؤوس الإضافية هو 20.');
  return headers;
}

const defaultRestTemplate = { model: '{{model}}', messages: '{{messages}}', max_tokens: '{{maxTokens}}', temperature: '{{temperature}}' };
const defaultRestMapping = { textPath: 'choices.0.message.content', tokenUsagePath: 'usage.total_tokens' };
const restVariables = new Set(['model', 'messages', 'maxTokens', 'temperature', 'system', 'lastUserMessage']);

function parseRestConfig(input, old) {
  const read = (raw, fallback, label) => {
    if (!raw || !String(raw).trim()) return fallback;
    let value;
    try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { throw new Error(`${label} يجب أن يكون JSON صالحاً.`); }
    if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 12000) throw new Error(`${label} يجب أن يكون كائناً بحجم لا يتجاوز 12 كيلوبايت.`);
    return value;
  };
  const requestTemplate = read(input.customRequestTemplate, old?.customRequestTemplate || defaultRestTemplate, 'قالب الطلب');
  const responseMapping = read(input.customResponseMapping, old?.customResponseMapping || defaultRestMapping, 'خريطة الاستجابة');
  const visit = (value, depth = 0) => {
    if (depth > 12) throw new Error('قالب الطلب متداخل بعمق زائد.');
    if (typeof value === 'string') {
      for (const [, variable] of value.matchAll(/\{\{([^{}]+)\}\}/g)) if (!restVariables.has(variable)) throw new Error(`المتغير {{${variable}}} غير معروف في قالب الطلب.`);
    } else if (Array.isArray(value)) value.forEach((item) => visit(item, depth + 1));
    else if (value && typeof value === 'object') Object.values(value).forEach((item) => visit(item, depth + 1));
  };
  visit(requestTemplate);
  if (typeof responseMapping.textPath !== 'string' || !responseMapping.textPath.trim() || responseMapping.textPath.length > 300 || /(^|\.)(__proto__|prototype|constructor)(\.|$)/.test(responseMapping.textPath)) throw new Error('مسار نص الاستجابة غير صالح.');
  if (responseMapping.tokenUsagePath !== undefined && (typeof responseMapping.tokenUsagePath !== 'string' || responseMapping.tokenUsagePath.length > 300 || /(^|\.)(__proto__|prototype|constructor)(\.|$)/.test(responseMapping.tokenUsagePath))) throw new Error('مسار استخدام الرموز غير صالح.');
  return { customRequestTemplate: requestTemplate, customResponseMapping: responseMapping };
}

function resolveTemplate(value, variables) {
  if (Array.isArray(value)) return value.map((item) => resolveTemplate(item, variables));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveTemplate(item, variables)]));
  if (typeof value !== 'string') return value;
  const exact = value.match(/^\{\{([^{}]+)\}\}$/);
  if (exact) return variables[exact[1]];
  return value.replace(/\{\{([^{}]+)\}\}/g, (_, key) => {
    const replacement = variables[key];
    if (replacement === undefined || replacement === null || typeof replacement === 'object') throw new Error(`لا يمكن إدراج {{${key}}} كنص داخل قيمة JSON.`);
    return String(replacement);
  });
}

function readMappedValue(value, pathExpression) {
  if (!pathExpression) return undefined;
  return pathExpression.split('.').reduce((current, key) => current == null ? undefined : current[key], value);
}

function sanitizeProviderError(value, provider, apiKey) {
  let message = String(value || 'تعذر تنفيذ الطلب.');
  for (const secret of [apiKey, ...Object.values(provider?.customHeaders || {})]) {
    if (typeof secret === 'string' && secret.length >= 4) message = message.split(secret).join('[مخفي]');
  }
  return message.slice(0, 500);
}

function createProviderService({ app, ipcMain, safeStorage }) {
  const storePath = () => path.join(app.getPath('userData'), STORE_NAME);
  const canEncrypt = () => safeStorage.isEncryptionAvailable();

  async function readStore() {
    if (!canEncrypt()) throw new Error('التخزين الآمن للمفاتيح غير متاح على هذا الجهاز.');
    try {
      const encrypted = await fs.readFile(storePath(), 'utf8');
      const clear = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
      const value = JSON.parse(clear);
      return Array.isArray(value) ? value : [];
    } catch (error) {
      if (error && error.code === 'ENOENT') return [];
      if (error instanceof SyntaxError) throw new Error('تعذر قراءة إعدادات مزودي الذكاء الاصطناعي.');
      throw error;
    }
  }

  async function writeStore(providers) {
    if (!canEncrypt()) throw new Error('التخزين الآمن للمفاتيح غير متاح على هذا الجهاز.');
    const encrypted = safeStorage.encryptString(JSON.stringify(providers)).toString('base64');
    await fs.mkdir(app.getPath('userData'), { recursive: true });
    await fs.writeFile(storePath(), encrypted, { encoding: 'utf8', mode: 0o600 });
  }

  function validateProvider(input) {
    if (!input || typeof input !== 'object') throw new Error('بيانات المزود غير صالحة.');
    const name = String(input.name || '').trim();
    const model = String(input.model || '').trim();
    const protocol = protocols.has(input.protocol) ? input.protocol : 'openai-compatible';
    const rawUrl = String(input.baseUrl || '').trim();
    if (!name || !model || !rawUrl) throw new Error('أدخل اسم المزود والرابط ومعرّف النموذج.');
    let url;
    try { url = new URL(rawUrl); } catch { throw new Error('رابط API غير صالح.'); }
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('استخدم رابط HTTPS أو HTTP محلياً لخادم Ollama.');
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('يُسمح برابط HTTP للخوادم المحلية فقط. استخدم HTTPS للخدمات الخارجية.');
    const apiKeyHeader = String(input.apiKeyHeader || 'Authorization').trim();
    const apiKeyPrefix = input.apiKeyPrefix === undefined ? (apiKeyHeader.toLowerCase() === 'authorization' ? 'Bearer' : '') : String(input.apiKeyPrefix).trim();
    if (protocol === 'custom-rest' && (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(apiKeyHeader) || ['content-type', 'host', 'content-length'].includes(apiKeyHeader.toLowerCase()))) throw new Error('اسم رأس مفتاح API غير صالح.');
    if (protocol === 'custom-rest' && (/[\r\n]/.test(apiKeyPrefix) || apiKeyPrefix.length > 32)) throw new Error('بادئة مفتاح API غير صالحة.');
    const rest = protocol === 'custom-rest' ? parseRestConfig(input, null) : {};
    return {
      id: String(input.id || randomUUID()), name: name.slice(0, 100), baseUrl: url.toString().replace(/\/$/, ''), model: model.slice(0, 200), protocol,
      ...(protocol === 'custom-rest' ? { apiKeyHeader, apiKeyPrefix } : {}),
      ...rest,
      enabled: input.enabled !== false, isDefault: Boolean(input.isDefault),
      timeoutMs: Math.min(180000, Math.max(5000, Number(input.timeoutMs) || 60000)),
      maxTokens: Math.min(32768, Math.max(256, Number(input.maxTokens) || 4096)),
      temperature: Math.min(2, Math.max(0, Number.isFinite(Number(input.temperature)) ? Number(input.temperature) : 0.4)),
    };
  }

  function requestUrl(provider) {
    if (provider.protocol === 'custom-rest') return provider.baseUrl;
    if (provider.protocol === 'gemini') return `${provider.baseUrl.replace(/\/$/, '')}/${encodeURIComponent(provider.model)}:generateContent`;
    if (provider.protocol === 'anthropic') return `${provider.baseUrl.replace(/\/$/, '').replace(/\/messages$/, '')}/messages`;
    const base = provider.baseUrl.replace(/\/$/, '');
    return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
  }

  function multimodalParts(content, providerProtocol) {
    const items = Array.isArray(content) ? content : [{ type: 'text', text: String(content || '') }];
    return items.map((item) => {
      if (item.type !== 'image_url' || !item.image_url?.url) return providerProtocol === 'gemini' ? { text: item.text || '' } : item;
      const match = item.image_url.url.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([a-z0-9+/=]+)$/i);
      if (!match || match[2].length > 14_000_000) throw new Error('الصورة غير صالحة أو أكبر من 10 ميغابايت.');
      if (providerProtocol === 'gemini') return { inlineData: { mimeType: match[1], data: match[2] } };
      if (providerProtocol === 'anthropic') return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } };
      return item;
    });
  }

  async function send(provider, apiKey, messages, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), provider.timeoutMs);
    const started = Date.now();
    let body;
      const headers = { 'content-type': 'application/json' };
    let url = requestUrl(provider);
    if (provider.protocol === 'gemini') {
      if (!apiKey) throw new Error('أضف مفتاح API لهذا المزود.');
      headers['x-goog-api-key'] = apiKey;
      body = {
        contents: messages.filter((message) => message.role !== 'system').map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: multimodalParts(message.content, 'gemini') })),
        systemInstruction: messages.find((message) => message.role === 'system') ? { parts: multimodalParts(messages.find((message) => message.role === 'system').content, 'gemini') } : undefined,
        generationConfig: { maxOutputTokens: options.maxTokens ?? provider.maxTokens, temperature: options.temperature ?? provider.temperature },
      };
    } else if (provider.protocol === 'anthropic') {
      if (!apiKey) throw new Error('أضف مفتاح API لهذا المزود.');
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      const system = messages.find((message) => message.role === 'system')?.content;
      body = { model: provider.model, max_tokens: options.maxTokens ?? provider.maxTokens, temperature: options.temperature ?? provider.temperature, system, messages: messages.filter((message) => message.role !== 'system').map((message) => ({ ...message, content: multimodalParts(message.content, 'anthropic') })) };
    } else if (provider.protocol === 'custom-rest') {
      if (apiKey) headers[provider.apiKeyHeader || 'Authorization'] = [provider.apiKeyPrefix, apiKey].filter(Boolean).join(' ');
      const system = messages.find((message) => message.role === 'system')?.content;
      const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content;
      body = resolveTemplate(provider.customRequestTemplate || defaultRestTemplate, {
        model: provider.model, maxTokens: options.maxTokens ?? provider.maxTokens,
        temperature: options.temperature ?? provider.temperature, messages, system, lastUserMessage,
      });
    } else {
      if (apiKey) headers.authorization = `Bearer ${apiKey}`;
      body = { model: provider.model, max_tokens: options.maxTokens ?? provider.maxTokens, temperature: options.temperature ?? provider.temperature, messages };
    }
    Object.assign(headers, provider.customHeaders || {});
    try {
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 800) }; }
      if (!response.ok) {
        const detail = data?.error?.message || data?.message || `HTTP ${response.status}`;
        throw new Error(sanitizeProviderError(detail, provider, apiKey));
      }
      const output = provider.protocol === 'custom-rest'
        ? readMappedValue(data, provider.customResponseMapping?.textPath || defaultRestMapping.textPath)
        : provider.protocol === 'gemini'
        ? data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('')
        : provider.protocol === 'anthropic'
          ? data?.content?.filter((part) => part.type === 'text').map((part) => part.text).join('')
          : data?.choices?.[0]?.message?.content;
      if (typeof output !== 'string' || !output.trim()) throw new Error('استجاب المزود دون نص قابل للاستخدام.');
      const mappedUsage = provider.protocol === 'custom-rest' ? readMappedValue(data, provider.customResponseMapping?.tokenUsagePath || defaultRestMapping.tokenUsagePath) : undefined;
      const tokenUsage = Number(mappedUsage || data?.usage?.total_tokens || ((data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0)) || data?.usageMetadata?.totalTokenCount || 0);
      return { text: output, responseMs: Date.now() - started, tokenUsage };
    } finally {
      clearTimeout(timer);
    }
  }

  async function updateUsage(id, changes) {
    const providers = await readStore();
    const index = providers.findIndex((provider) => provider.id === id);
    if (index < 0) return;
    providers[index] = { ...providers[index], ...changes };
    await writeStore(providers);
  }

  async function recordFailure(id, message) {
    try {
      const safeMessage = String(message || 'تعذر تنفيذ الطلب.').slice(0, 400);
      const providers = await readStore();
      const provider = providers.find((item) => item.id === id);
      if (provider) await updateUsage(id, { errorCount: (provider.errorCount || 0) + 1, lastError: safeMessage, lastTest: new Date().toISOString() });
    } catch { /* Never replace the original provider error with a logging failure. */ }
  }

  ipcMain.handle('providers:list', async () => {
    if (!canEncrypt()) return { available: false, providers: [], error: 'التخزين الآمن غير متاح.' };
    try { return { available: true, providers: (await readStore()).map(publicProvider) }; }
    catch (error) { return { available: false, providers: [], error: error.message }; }
  });

  ipcMain.handle('providers:save', async (_event, input) => {
    try {
      const metadata = validateProvider(input);
      const providers = await readStore();
      const old = providers.find((provider) => provider.id === metadata.id);
      const apiKey = String(input.apiKey || '').trim();
      const customHeaders = String(input.customHeaders || '').trim() ? parseCustomHeaders(String(input.customHeaders).trim()) : old?.customHeaders || {};
      const rest = metadata.protocol === 'custom-rest' ? parseRestConfig(input, old) : {};
      if (metadata.isDefault) providers.forEach((provider) => { provider.isDefault = false; });
      const next = { ...old, ...metadata, ...rest, customHeaders, encryptedApiKey: apiKey ? safeStorage.encryptString(apiKey).toString('base64') : old?.encryptedApiKey };
      const saved = old ? providers.map((provider) => provider.id === old.id ? next : provider) : [next, ...providers];
      await writeStore(saved);
      return { ok: true, provider: publicProvider(next) };
    } catch (error) { return { ok: false, error: error.message }; }
  });

  ipcMain.handle('providers:remove', async (_event, id) => {
    try { await writeStore((await readStore()).filter((provider) => provider.id !== String(id))); return { ok: true }; }
    catch (error) { return { ok: false, error: error.message }; }
  });

  ipcMain.handle('providers:models', async (_event, id) => {
    try {
      const provider = (await readStore()).find((item) => item.id === String(id) && item.enabled);
      if (!provider) throw new Error('المزود غير موجود أو متوقف.');
      if (provider.protocol === 'custom-rest') throw new Error('هذا المزود يستخدم نقطة REST مخصصة؛ أدخل معرّف النموذج يدوياً لأن نقطة جلب النماذج تختلف حسب الخدمة.');
      const apiKey = provider.encryptedApiKey ? safeStorage.decryptString(Buffer.from(provider.encryptedApiKey, 'base64')) : '';
      const url = provider.protocol === 'gemini'
        ? provider.baseUrl.replace(/\/$/, '')
        : `${provider.baseUrl.replace(/\/$/, '').replace(/\/chat\/completions$/, '')}/models`;
      const headers = { ...(provider.customHeaders || {}) };
      if (provider.protocol === 'gemini') headers['x-goog-api-key'] = apiKey;
      else if (provider.protocol === 'anthropic') { headers['x-api-key'] = apiKey; headers['anthropic-version'] = '2023-06-01'; }
      else if (apiKey) headers.authorization = `Bearer ${apiKey}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), provider.timeoutMs);
      let response;
      try { response = await fetch(url, { headers, signal: controller.signal }); }
      finally { clearTimeout(timer); }
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = { message: raw }; }
      if (!response.ok) throw new Error(sanitizeProviderError(data?.error?.message || data?.message || `HTTP ${response.status}`, provider, apiKey));
      let models = provider.protocol === 'gemini'
        ? (data.models || []).filter((model) => !model.supportedGenerationMethods || model.supportedGenerationMethods.includes('generateContent')).map((model) => String(model.name || '').replace(/^models\//, ''))
        : provider.protocol === 'anthropic'
          ? (data.data || []).map((model) => model.id)
          : (data.data || []).map((model) => model.id);
      models = [...new Set(models.filter((model) => typeof model === 'string' && model.trim()).map((model) => model.slice(0, 200)))].slice(0, 500);
      return { ok: true, models };
    } catch (error) { return { ok: false, error: error.name === 'AbortError' ? 'انتهت مهلة جلب النماذج.' : error.message, models: [] }; }
  });

  ipcMain.handle('providers:test', async (_event, id) => {
    try {
      const provider = (await readStore()).find((item) => item.id === String(id));
      if (!provider) throw new Error('المزود غير موجود.');
      const key = provider.encryptedApiKey ? safeStorage.decryptString(Buffer.from(provider.encryptedApiKey, 'base64')) : '';
      const result = await send(provider, key, [{ role: 'user', content: 'Respond with exactly: OK' }], { maxTokens: 16, temperature: 0 });
      await updateUsage(provider.id, { lastTest: new Date().toISOString(), lastError: '', lastResponseMs: result.responseMs });
      return { ok: true, message: `تم الاتصال بنجاح (${result.responseMs} ms).`, responseMs: result.responseMs };
    } catch (error) {
      const message = error.name === 'AbortError' ? 'انتهت مهلة الاتصال.' : error.message;
      await recordFailure(id, message);
      return { ok: false, message, error: message };
    }
  });

  ipcMain.handle('providers:complete', async (_event, request) => {
    try {
      const provider = (await readStore()).find((item) => item.id === String(request?.providerId) && item.enabled);
      if (!provider) throw new Error('اختر مزوداً مفعّلاً أولاً.');
      const key = provider.encryptedApiKey ? safeStorage.decryptString(Buffer.from(provider.encryptedApiKey, 'base64')) : '';
      const result = await send(provider, key, request.messages, request);
      await updateUsage(provider.id, { requestCount: (provider.requestCount || 0) + 1, lastResponseMs: result.responseMs, lastError: '', totalTokens: (provider.totalTokens || 0) + result.tokenUsage });
      return { ok: true, ...result };
    } catch (error) {
      const message = error.name === 'AbortError' ? 'انتهت مهلة الاتصال.' : error.message;
      if (request?.providerId) await recordFailure(String(request.providerId), message);
      return { ok: false, error: message };
    }
  });

  ipcMain.handle('providers:transcribe', async (_event, request) => {
    const id = String(request?.providerId || '');
    try {
      const provider = (await readStore()).find((item) => item.id === id && item.enabled);
      if (!provider) throw new Error('اختر مزوداً مفعّلاً أولاً.');
      if (provider.protocol !== 'openai-compatible') throw new Error('تحويل الصوت متاح حالياً عبر نقطة OpenAI Compatible تدعم audio/transcriptions.');
      if (!/^(audio\/(?:mpeg|wav|mp4|x-m4a|x-wav|aac|x-aac|ogg|webm)|video\/mp4)$/.test(String(request?.mimeType || ''))) throw new Error('صيغة الصوت غير مدعومة.');
      const encoded = String(request?.base64 || '').replace(/^data:[^,]+;base64,/, '');
      if (!encoded || encoded.length > 36_000_000 || !/^[a-z0-9+/]+=*$/i.test(encoded)) throw new Error('حجم الصوت يجب ألا يتجاوز 25 ميغابايت.');
      const apiKey = provider.encryptedApiKey ? safeStorage.decryptString(Buffer.from(provider.encryptedApiKey, 'base64')) : '';
      if (!apiKey) throw new Error('أضف مفتاح API لهذا المزود.');
      const audio = Buffer.from(encoded, 'base64');
      if (audio.length > 25 * 1024 * 1024) throw new Error('حجم الصوت يجب ألا يتجاوز 25 ميغابايت.');
      const form = new FormData();
      const fileName = String(request.fileName || 'recording.webm').replace(/[^\p{L}\p{N}._-]/gu, '_').slice(0, 100);
      form.append('file', new Blob([audio], { type: request.mimeType }), fileName);
      form.append('model', provider.model);
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'segment');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), provider.timeoutMs);
      const started = Date.now();
      try {
        const url = `${provider.baseUrl.replace(/\/$/, '').replace(/\/chat\/completions$/, '')}/audio/transcriptions`;
        const response = await fetch(url, { method: 'POST', headers: { ...(provider.customHeaders || {}), authorization: `Bearer ${apiKey}` }, body: form, signal: controller.signal });
        const raw = await response.text();
        let data;
        try { data = JSON.parse(raw); } catch { data = { message: raw }; }
        if (!response.ok) throw new Error(sanitizeProviderError(data?.error?.message || data?.message || `HTTP ${response.status}`, provider, apiKey));
        if (typeof data?.text !== 'string' || !data.text.trim()) throw new Error('استجاب مزود الصوت دون نص.');
        const responseMs = Date.now() - started;
        await updateUsage(id, { requestCount: (provider.requestCount || 0) + 1, lastResponseMs: responseMs, lastError: '', totalTokens: (provider.totalTokens || 0) + Number(data?.usage?.total_tokens || 0) });
        return { ok: true, text: data.text, responseMs, segments: Array.isArray(data.segments) ? data.segments.map((segment) => ({ start: Number(segment.start) || 0, end: Number(segment.end) || 0, text: String(segment.text || '') })) : [] };
      } finally { clearTimeout(timeout); }
    } catch (error) {
      const message = error.name === 'AbortError' ? 'انتهت مهلة تحويل الصوت.' : error.message;
      if (id) await recordFailure(id, message);
      return { ok: false, error: message };
    }
  });
}

module.exports = { createProviderService };

