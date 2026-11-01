import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Image, LoaderCircle, Network, Upload, X } from 'lucide-react';
import type { AIProviderSummary } from '../../types/desktop';
import { mapFromJson, type GeneratedMap } from '../ai/AIGenerator';

const toDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('تعذر قراءة الصورة.'));
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('ملف الصورة غير صالح.'));
  reader.readAsDataURL(file);
});
const cleanJson = (value: string) => JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));

export default function ImageAnalyzer({ onClose, onGenerated }: { onClose: () => void; onGenerated: (map: GeneratedMap) => void }) {
  const [providers, setProviders] = useState<AIProviderSummary[]>([]);
  const [providerId, setProviderId] = useState('');
  const [imageData, setImageData] = useState('');
  const [imageName, setImageName] = useState('');
  const [instruction, setInstruction] = useState('استخرج النصوص والمعلومات والأفكار المهمة من الصورة');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!window.ibraMind?.providers) { setError('تحليل الصور متاح في تطبيق Windows بعد ضبط مزود يدعم الصور.'); setReady(true); return; }
    void window.ibraMind.providers.list().then((result) => {
      const enabled = (result.providers || []).filter((item) => item.enabled);
      setProviders(enabled);
      let route = '';
      try { route = JSON.parse(localStorage.getItem('ibra-mind-ai-routing-v1') || '{}').imageAnalysis || ''; } catch { route = ''; }
      setProviderId(enabled.find((item) => item.id === route)?.id || enabled.find((item) => item.isDefault)?.id || enabled[0]?.id || '');
      if (!enabled.length) setError('أضف مزود ذكاء اصطناعي يدعم تحليل الصور أولاً.');
      setReady(true);
    }).catch(() => { setError('تعذر تحميل إعدادات المزود.'); setReady(true); });
  }, []);
  const provider = useMemo(() => providers.find((item) => item.id === providerId), [providers, providerId]);
  const choose = async (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { setError('الصيغ المدعومة: PNG وJPG وWEBP وGIF.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('حجم الصورة يجب ألا يتجاوز 10 ميغابايت.'); return; }
    try { setImageData(await toDataUrl(file)); setImageName(file.name); setError(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'تعذر قراءة الصورة.'); }
  };
  const analyze = async () => {
    if (!imageData || !provider || !window.ibraMind?.providers) return;
    setBusy(true); setError('');
    const result = await window.ibraMind.providers.complete({ providerId, maxTokens: Math.min(provider.maxTokens, 6000), temperature: provider.temperature, messages: [
      { role: 'system', content: 'حلل الصورة بعناية واستخرج النصوص والعناصر الرئيسية وعلاقاتها. أعد خريطة ذهنية منظمة بكائن JSON فقط بالشكل {"title":"عنوان","children":[{"title":"فكرة","children":[{"title":"تفصيل","children":[]}]}]}. لا تدّع قراءة نص غير واضح.' },
      { role: 'user', content: [{ type: 'text', text: `${instruction}\nاسم الملف: ${imageName}` }, { type: 'image_url', image_url: { url: imageData } }] },
    ] });
    setBusy(false);
    if (!result.ok || !result.text) { setError(result.error || 'تعذر تحليل الصورة. تحقق من دعم المزود للرؤية.'); return; }
    try { onGenerated(mapFromJson(cleanJson(result.text))); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'استجابة تحليل الصورة غير صالحة.'); }
  };
  return <div className="dialog-backdrop ai-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!busy)onClose()}}><section className="dialog-card ai-dialog document-dialog" role="dialog" aria-modal="true" aria-labelledby="image-title"><button className="dialog-close" aria-label="إغلاق" disabled={busy} onClick={onClose}><X size={18}/></button><div className="dialog-symbol ai-symbol"><Image size={22}/></div><h2 id="image-title">حلّل صورة إلى خريطة</h2><p>تُرسل الصورة مباشرة إلى مزود يدعم الرؤية؛ تأكد من صلاحية النموذج قبل الإرسال.</p>
    {!ready?<div className="provider-loading"><LoaderCircle size={18}/> جارٍ تحميل المزودين</div>:<><label className="ai-provider-label">مزود تحليل الصور<select value={providerId} onChange={(event)=>setProviderId(event.target.value)} disabled={!providers.length}>{providers.map((item)=><option key={item.id} value={item.id}>{item.name} · {item.model}</option>)}</select></label><label className="document-drop"><Upload size={20}/><span>{imageName||'اختر صورة PNG أو JPG أو WEBP (10 ميغابايت كحد أقصى)'}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event)=>void choose(event.target.files?.[0])}/></label>{imageData&&<img className="image-analysis-preview" src={imageData} alt="معاينة الصورة المراد تحليلها"/>}<label className="ai-topic-label">ما الذي تريد استخراجه؟<textarea value={instruction} maxLength={500} onChange={(event)=>setInstruction(event.target.value)} rows={2}/></label>{error&&<div className="provider-error" role="alert"><AlertCircle size={16}/>{error}</div>}<div className="dialog-actions"><button type="button" className="editor-button" onClick={onClose} disabled={busy}>إغلاق</button><button className="editor-button primary" onClick={()=>void analyze()} disabled={!imageData||!provider||busy}>{busy?<LoaderCircle size={15} className="spin"/>:<Network size={15}/>} تحليل الصورة</button></div></>}
    </section></div>;
}
