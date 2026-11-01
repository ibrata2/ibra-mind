import { useEffect, useState } from 'react';
import { Check, CircleAlert, LoaderCircle, Plus, RefreshCw, Save, ShieldCheck, Trash2, Wifi } from 'lucide-react';
import type { AIProviderSummary, ProviderDraft, ProviderProtocol } from '../../types/desktop';

const defaults: ProviderDraft = {
  id: '', name: '', baseUrl: 'https://api.openai.com/v1', model: '', protocol: 'openai-compatible',
  enabled: true, isDefault: false, timeoutMs: 60000, maxTokens: 4096, temperature: 0.4, apiKey: '',
  customHeaders: '',
};
const presets: { name: string; baseUrl: string; protocol: ProviderProtocol; model: string }[] = [
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', protocol: 'openai-compatible', model: 'gpt-4o-mini' },
  { name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models', protocol: 'gemini', model: 'gemini-2.5-flash' },
  { name: 'Anthropic Claude', baseUrl: 'https://api.anthropic.com/v1', protocol: 'anthropic', model: 'claude-3-5-haiku-latest' },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', protocol: 'openai-compatible', model: 'deepseek-v4-pro' },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', protocol: 'openai-compatible', model: 'openai/gpt-oss-20b' },
  { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', protocol: 'openai-compatible', model: 'openai/gpt-oss-20b' },
  { name: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1', protocol: 'openai-compatible', model: 'mistral-large-latest' },
  { name: 'Ollama (محلي)', baseUrl: 'http://localhost:11434/v1', protocol: 'openai-compatible', model: 'qwen2.5:7b' },
  { name: 'OpenAI Compatible', baseUrl: 'https://', protocol: 'openai-compatible', model: '' },
];
const routingTasks = [
  ['mindMapGeneration', 'توليد خريطة'], ['expansion', 'توسيع فرع'], ['summarization', 'تلخيص'], ['documentAnalysis', 'تحليل مستند'], ['imageAnalysis', 'تحليل صورة'], ['flowchartGeneration', 'توليد مخطط'], ['translation', 'ترجمة'], ['explanation', 'شرح'],
] as const;
const ROUTING_KEY = 'ibra-mind-ai-routing-v1';

export default function ProviderManager() {
  const [providers, setProviders] = useState<AIProviderSummary[]>([]);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<ProviderDraft | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [routing, setRouting] = useState<Record<string, string>>({});
  const [availableModels, setAvailableModels] = useState<Record<string, string[]>>({});

  const refresh = async () => {
    setLoading(true);
    setError('');
    if (!window.ibraMind?.providers) {
      setAvailable(false);
      setProviders([]);
      setError('تخزين المفاتيح الآمن متوفر في تطبيق Windows. اربط خادم AI آمن لاستخدام إعدادات المزود من نسخة الويب.');
      setLoading(false);
      return;
    }
    const result = await window.ibraMind.providers.list();
    setAvailable(result.available);
    setProviders(result.providers || []);
    if (result.error) setError(result.error);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    try { setRouting(JSON.parse(localStorage.getItem(ROUTING_KEY) || '{}')); } catch { setRouting({}); }
  }, []);

  const save = async () => {
    if (!draft || !window.ibraMind?.providers) return;
    setBusyId(draft.id || 'new');
    const result = await window.ibraMind.providers.save({ ...draft, id: draft.id || crypto.randomUUID() });
    setBusyId(null);
    if (!result.ok) { setError(result.error || 'تعذر حفظ المزود.'); return; }
    setDraft(null);
    setNotice('حُفظ إعداد المزود. المفتاح مشفّر خارج واجهة التطبيق.');
    await refresh();
  };

  const test = async (provider: AIProviderSummary) => {
    if (!window.ibraMind?.providers) return;
    setBusyId(provider.id);
    const result = await window.ibraMind.providers.test(provider.id);
    setBusyId(null);
    setNotice(result.message);
    if (!result.ok) setError(result.message);
    await refresh();
  };

  const remove = async (provider: AIProviderSummary) => {
    if (!window.ibraMind?.providers || !window.confirm(`حذف إعداد ${provider.name}؟`)) return;
    const result = await window.ibraMind.providers.remove(provider.id);
    if (!result.ok) { setError(result.error || 'تعذر حذف المزود.'); return; }
    setProviders((current) => current.filter((item) => item.id !== provider.id));
    setRouting((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([, value]) => value !== provider.id));
      localStorage.setItem(ROUTING_KEY, JSON.stringify(next));
      return next;
    });
    setNotice('تم حذف المزود ومفتاحه المشفّر.');
  };

  const fetchModels = async (provider: AIProviderSummary) => {
    if (!window.ibraMind?.providers) return;
    setBusyId(provider.id); setError('');
    const result = await window.ibraMind.providers.models(provider.id);
    setBusyId(null);
    if (!result.ok) { setError(result.error || 'تعذر جلب قائمة النماذج.'); return; }
    setAvailableModels((current)=>({...current,[provider.id]:result.models}));
    if (!result.models.length) setNotice('لم يرجع المزود قائمة نماذج. أدخل معرّف النموذج يدوياً.');
    else setNotice(`عُثر على ${result.models.length} نموذجاً لدى ${provider.name}.`);
  };

  const chooseModel = async (provider: AIProviderSummary, model: string) => {
    if (!model || !window.ibraMind?.providers) return;
    setBusyId(provider.id);
    const result = await window.ibraMind.providers.save({ ...provider, model, apiKey: '' });
    setBusyId(null);
    if (!result.ok) { setError(result.error || 'تعذر تحديث النموذج.'); return; }
    setNotice(`تم تعيين ${model} لمزود ${provider.name}.`);
    await refresh();
  };

  const edit = (provider: AIProviderSummary) => setDraft({
    id: provider.id, name: provider.name, baseUrl: provider.baseUrl, model: provider.model, protocol: provider.protocol,
    enabled: provider.enabled, isDefault: provider.isDefault, timeoutMs: provider.timeoutMs, maxTokens: provider.maxTokens, temperature: provider.temperature, apiKey: '',
    customHeaders: '',
  });
  const addPreset = (preset: typeof presets[number]) => setDraft({ ...defaults, ...preset, id: '', isDefault: providers.length === 0 });

  return <div className="provider-manager">
    <div className="provider-heading"><div><h3>مزودو الذكاء الاصطناعي</h3><p>المفاتيح تحفظ مشفّرة في Windows ولا تُرسل إلى واجهة React.</p></div><button className="provider-refresh" aria-label="تحديث" onClick={()=>void refresh()}><RefreshCw size={15}/></button></div>
    {!available && <div className="provider-notice"><ShieldCheck size={18}/><span>{error || 'إعدادات المزود الآمنة غير متاحة.'}</span></div>}
    {error && available && <div className="provider-error" role="alert"><CircleAlert size={16}/>{error}</div>}
    {notice && <div className="provider-success" role="status"><Check size={16}/>{notice}</div>}
    <div className="provider-list">
      {loading ? <div className="provider-loading"><LoaderCircle size={18}/> جارٍ تحميل إعدادات الاتصال</div> : providers.map((provider)=><article className="provider-card" key={provider.id}>
        <div className="provider-card-main"><div className="provider-avatar"><Wifi size={17}/></div><div className="provider-card-text"><b>{provider.name}{provider.isDefault&&<span className="default-pill">افتراضي</span>}</b><small>{provider.model} · {provider.baseUrl}</small><small>{provider.hasApiKey?'مفتاح محفوظ بشكل آمن':'بدون مفتاح · مناسب لخادم محلي'}{provider.hasCustomHeaders?' · رؤوس مخصصة محفوظة':''} · {provider.enabled?'مفعّل':'متوقف'}</small></div></div>
        <div className="provider-actions"><button onClick={()=>void test(provider)} disabled={busyId===provider.id} className="provider-test">{busyId===provider.id?<LoaderCircle size={14} className="spin"/>:<Wifi size={14}/>} اختبار الاتصال</button><button onClick={()=>void fetchModels(provider)} disabled={busyId===provider.id}><RefreshCw size={13}/> جلب النماذج</button><button onClick={()=>edit(provider)}>تعديل</button><button aria-label="حذف المزود" onClick={()=>void remove(provider)}><Trash2 size={14}/></button></div>
        {availableModels[provider.id]&&<label className="available-model-select">اختر نموذجاً من قائمة المزود<select value="" disabled={busyId===provider.id} onChange={(event)=>void chooseModel(provider,event.target.value)}><option value="">النموذج الحالي: {provider.model}</option>{availableModels[provider.id].map((model)=><option key={model} value={model}>{model}</option>)}</select></label>}
        <div className="provider-usage"><span>طلبات: {provider.requestCount||0}</span><span>رموز تقريبية: {provider.totalTokens||0}</span><span>وقت آخر استجابة: {provider.lastResponseMs?`${provider.lastResponseMs} ms`:'—'}</span><span>أخطاء: {provider.errorCount||0}</span></div>
      </article>)}
    </div>

    {draft ? <section className="provider-form"><div className="provider-form-head"><h4>{draft.id?'تعديل إعداد المزود':'إضافة مزود'}</h4><button onClick={()=>setDraft(null)}>إلغاء</button></div>
      <div className="provider-presets">{presets.map((preset)=><button key={preset.name} onClick={()=>setDraft((current)=>current?({...current,...preset}):({...defaults,...preset}))}>{preset.name}</button>)}</div>
      <div className="provider-fields">
        <label>اسم المزود<input value={draft.name} maxLength={100} onChange={(event)=>setDraft({...draft,name:event.target.value})} placeholder="مزودي الخاص"/></label>
        <label>البروتوكول<select value={draft.protocol} onChange={(event)=>setDraft({...draft,protocol:event.target.value as ProviderProtocol})}><option value="openai-compatible">OpenAI Compatible</option><option value="gemini">Google Gemini</option><option value="anthropic">Anthropic Messages</option></select></label>
        <label className="wide-field">عنوان API<input dir="ltr" value={draft.baseUrl} onChange={(event)=>setDraft({...draft,baseUrl:event.target.value})} placeholder="https://api.example.com/v1"/></label>
        <label>معرّف النموذج<input dir="ltr" value={draft.model} onChange={(event)=>setDraft({...draft,model:event.target.value})} placeholder="اسم النموذج عند المزود"/></label>
        <label>مفتاح API<input dir="ltr" type="password" autoComplete="new-password" value={draft.apiKey||''} onChange={(event)=>setDraft({...draft,apiKey:event.target.value})} placeholder={draft.id?'اتركه فارغاً للاحتفاظ بالمفتاح الحالي':'يُحفظ مشفّراً في Windows'}/></label>
        <label>المهلة بالثواني<input type="number" min="5" max="180" value={Math.round(draft.timeoutMs/1000)} onChange={(event)=>setDraft({...draft,timeoutMs:Number(event.target.value)*1000})}/></label>
        <label>الحد الأعلى للرموز<input type="number" min="256" max="32768" step="256" value={draft.maxTokens} onChange={(event)=>setDraft({...draft,maxTokens:Number(event.target.value)})}/></label>
        <label>درجة الحرارة<input type="number" min="0" max="2" step="0.1" value={draft.temperature} onChange={(event)=>setDraft({...draft,temperature:Number(event.target.value)})}/></label>
        <label className="wide-field">رؤوس HTTP مخصصة بصيغة JSON<textarea dir="ltr" rows={3} value={draft.customHeaders||''} onChange={(event)=>setDraft({...draft,customHeaders:event.target.value})} placeholder={'{"HTTP-Referer":"https://your-app.example"}'}/><small>اختياري. لا تضع Authorization أو مفاتيح API هنا. عند تعديل مزود موجود، اترك الحقل فارغاً للاحتفاظ بالرؤوس؛ أدخل {} لمسحها.</small></label>
      </div>
      <div className="provider-checks"><label><input type="checkbox" checked={draft.enabled} onChange={(event)=>setDraft({...draft,enabled:event.target.checked})}/> تفعيل المزود</label><label><input type="checkbox" checked={draft.isDefault} onChange={(event)=>setDraft({...draft,isDefault:event.target.checked})}/> المزود الافتراضي</label></div>
      <button className="provider-save" onClick={()=>void save()} disabled={!available||busyId!==null}><Save size={15}/> حفظ الإعداد</button>
    </section> : <button className="provider-add" onClick={()=>setDraft({...defaults,isDefault:providers.length===0})} disabled={!available}><Plus size={16}/> إضافة مزود</button>}

    <section className="model-routing"><h4>توجيه النموذج حسب المهمة</h4><p>اختيار المزود لكل مهمة يُحفظ محلياً. المهمة تستخدم الافتراضي عند عدم اختيار مزود.</p><div>{routingTasks.map(([key,label])=><label key={key}>{label}<select value={routing[key]||''} onChange={(event)=>setRouting((current)=>{const next={...current,[key]:event.target.value};localStorage.setItem(ROUTING_KEY,JSON.stringify(next));return next})}><option value="">المزود الافتراضي</option>{providers.map((provider)=><option key={provider.id} value={provider.id}>{provider.name} · {provider.model}</option>)}</select></label>)}</div></section>
    <small className="provider-cost-note">استهلاك الرموز تقديري؛ التكلفة المالية تعتمد على أسعار مزود الخدمة وحسابه.</small>
  </div>;
}
