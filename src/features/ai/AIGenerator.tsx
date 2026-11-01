import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, Check, LoaderCircle, Network, Sparkles, X } from 'lucide-react';
import type { Edge } from '@xyflow/react';
import type { AIProviderSummary } from '../../types/desktop';

export type GeneratedMap = { title: string; nodes: { id: string; type: 'mind'; position: { x: number; y: number }; data: { label: string } }[]; edges: Edge[] };

function cleanJson(text: string): unknown {
  const source = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(source);
}

export function mapFromJson(value: unknown): GeneratedMap {
  if (!value || typeof value !== 'object') throw new Error('الاستجابة ليست خريطة JSON.');
  const input = value as { title?: unknown; children?: unknown };
  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 100) : '';
  if (!title || !Array.isArray(input.children)) throw new Error('تنسيق الخريطة ناقص العنوان أو الفروع.');
  const nodes: GeneratedMap['nodes'] = [{ id: 'root', type: 'mind', position: { x: 0, y: 0 }, data: { label: title } }];
  const edges: Edge[] = [];
  let nextId = 0;
  const addChildren = (items: unknown[], parentId: string, depth: number, parentX: number, parentY: number, side: number) => {
    if (depth > 5 || nodes.length > 80) return;
    const valid = items.filter((item): item is { title: string; children?: unknown[] } => Boolean(item) && typeof item === 'object' && typeof (item as { title?: unknown }).title === 'string');
    valid.slice(0, 10).forEach((item, index) => {
      const id = `ai-${++nextId}`;
      const centeredIndex = index - (Math.min(valid.length, 10) - 1) / 2;
      const x = depth === 1 ? (index % 2 === 0 ? 1 : -1) * 310 : parentX + side * 250;
      const y = depth === 1 ? centeredIndex * 150 : parentY + centeredIndex * 115;
      nodes.push({ id, type: 'mind', position: { x, y }, data: { label: item.title.trim().slice(0, 120) } });
      edges.push({ id: `edge-${id}`, source: parentId, target: id, type: 'smoothstep' });
      if (Array.isArray(item.children)) addChildren(item.children, id, depth + 1, x, y, depth === 1 ? Math.sign(x) : side);
    });
  };
  addChildren(input.children, 'root', 1, 0, 0, 1);
  if (!edges.length) throw new Error('لم يُرجع النموذج أي فروع. جرّب وصفاً أوضح.');
  return { title, nodes, edges };
}

export default function AIGenerator({ onClose, onGenerated }: { onClose: () => void; onGenerated: (map: GeneratedMap) => void }) {
  const [providers, setProviders] = useState<AIProviderSummary[]>([]);
  const [providerId, setProviderId] = useState('');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!window.ibraMind?.providers) { setError('مولّد الذكاء الاصطناعي يحتاج مزوداً مضبوطاً داخل تطبيق Windows. افتح الإعدادات ثم مزودو الذكاء الاصطناعي.'); setReady(true); return; }
    void window.ibraMind.providers.list().then((result) => {
      const available = (result.providers || []).filter((provider) => provider.enabled);
      setProviders(available);
      let routed = '';
      try { routed = JSON.parse(localStorage.getItem('ibra-mind-ai-routing-v1') || '{}').mindMapGeneration || ''; } catch { routed = ''; }
      setProviderId(available.find((provider) => provider.id === routed)?.id || available.find((provider) => provider.isDefault)?.id || available[0]?.id || '');
      if (!available.length) setError('أضف مزود ذكاء اصطناعي واختبر الاتصال قبل إنشاء خريطة.');
      setReady(true);
    }).catch(() => { setError('تعذر تحميل إعدادات المزود.'); setReady(true); });
  }, []);
  const selectedProvider = useMemo(() => providers.find((provider) => provider.id === providerId), [providers, providerId]);
  const generate = async (event: FormEvent) => {
    event.preventDefault();
    if (!topic.trim() || !selectedProvider || !window.ibraMind?.providers) return;
    setBusy(true); setError('');
    const result = await window.ibraMind.providers.complete({
      providerId: selectedProvider.id,
      maxTokens: Math.min(selectedProvider.maxTokens, 6000),
      temperature: selectedProvider.temperature,
      messages: [
        { role: 'system', content: 'أنشئ خريطة ذهنية أصلية باللغة المناسبة لموضوع المستخدم. أجب بكائن JSON فقط بالشكل {"title":"عنوان مختصر","children":[{"title":"فرع","children":[{"title":"تفصيل","children":[]}]}]}. أنشئ 4 إلى 7 فروع رئيسية، ولكل فرع من 2 إلى 5 أفكار فرعية. لا تضف Markdown أو شروحاً خارج JSON. لا تضع أسراراً أو شيفرة.' },
        { role: 'user', content: `أنشئ خريطة ذهنية منظمة حول هذا الموضوع: ${topic.trim().slice(0, 3000)}` },
      ],
    });
    setBusy(false);
    if (!result.ok || !result.text) { setError(result.error || 'تعذر توليد الخريطة.'); return; }
    try { onGenerated(mapFromJson(cleanJson(result.text))); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'النتيجة لا تطابق مخطط الخريطة.'); }
  };

  return <div className="dialog-backdrop ai-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!busy)onClose()}}><section className="dialog-card ai-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-title"><button className="dialog-close" aria-label="إغلاق" disabled={busy} onClick={onClose}><X size={18}/></button><div className="dialog-symbol ai-symbol"><Sparkles size={22}/></div><h2 id="ai-title">حوّل موضوعك إلى خريطة</h2><p>تُرسل رسالتك للمزود الذي تختاره. راجع البيانات قبل حفظها في ملف جديد.</p>
    {!ready?<div className="provider-loading"><LoaderCircle size={18}/> جارٍ تحميل المزودين</div>:<form onSubmit={generate}><label className="ai-provider-label">مزود التوليد<select value={providerId} onChange={(event)=>setProviderId(event.target.value)} disabled={!providers.length}>{providers.map((provider)=><option key={provider.id} value={provider.id}>{provider.name} · {provider.model}</option>)}</select></label><label className="ai-topic-label">الموضوع أو السؤال<textarea value={topic} maxLength={3000} onChange={(event)=>setTopic(event.target.value)} placeholder="مثال: خطة عملية لتعلّم البرمجة خلال ستة أشهر" rows={5}/></label><small className="ai-char-count">{topic.length}/3000 حرف</small>{error&&<div className="provider-error" role="alert"><AlertCircle size={16}/>{error}</div>}<div className="dialog-actions"><button type="button" className="editor-button" onClick={onClose} disabled={busy}>إلغاء</button><button className="editor-button primary" type="submit" disabled={!topic.trim()||!selectedProvider||busy}>{busy?<LoaderCircle size={15} className="spin"/>:<Network size={15}/>} إنشاء الخريطة</button></div></form>}
    </section></div>;
}
