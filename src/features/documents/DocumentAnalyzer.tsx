import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { AlertCircle, FileText, LoaderCircle, Network, Upload, X } from 'lucide-react';
import type { AIProviderSummary } from '../../types/desktop';
import { extractDocumentText, type ExtractedDocument } from './extractDocumentText';
import { mapFromJson, type GeneratedMap } from '../ai/AIGenerator';

const CHUNK_SIZE = 16_000;
const cleanJson = (value: string) => JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));

export default function DocumentAnalyzer({ onClose, onGenerated }: { onClose: () => void; onGenerated: (map: GeneratedMap) => void }) {
  const [providers, setProviders] = useState<AIProviderSummary[]>([]);
  const [providerId, setProviderId] = useState('');
  const [document, setDocument] = useState<ExtractedDocument | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!window.ibraMind?.providers) { setError('تحليل الذكاء الاصطناعي متاح في تطبيق Windows بعد ضبط مزود من الإعدادات.'); setReady(true); return; }
    void window.ibraMind.providers.list().then((result) => {
      const enabled = (result.providers || []).filter((item) => item.enabled);
      setProviders(enabled);
      let route = '';
      try { route = JSON.parse(localStorage.getItem('ibra-mind-ai-routing-v1') || '{}').documentAnalysis || ''; } catch { route = ''; }
      setProviderId(enabled.find((item) => item.id === route)?.id || enabled.find((item) => item.isDefault)?.id || enabled[0]?.id || '');
      if (!enabled.length) setError('أضف مزود ذكاء اصطناعي واختبره من الإعدادات أولاً.');
      setReady(true);
    }).catch(() => { setError('تعذر تحميل إعدادات المزود.'); setReady(true); });
  }, []);
  const provider = useMemo(() => providers.find((item) => item.id === providerId), [providers, providerId]);
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setError(''); setDocument(null);
    try { setDocument(await extractDocumentText(file)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'تعذر قراءة هذا الملف.'); }
  };
  const analyze = async () => {
    if (!document || !provider || !window.ibraMind?.providers) return;
    setBusy(true); setError('');
    try {
      let analysisText = document.text;
      const scanned = document.scannedPages ?? [];
      const ocrText: string[] = [];
      for (let index = 0; index < scanned.length; index += 1) {
        const page = scanned[index];
        setProgress(`قراءة الصفحة المصوّرة ${index + 1} من ${scanned.length} بواسطة مزود الرؤية`);
        const ocr = await window.ibraMind.providers.complete({ providerId, maxTokens: 3500, temperature: 0, messages: [
          { role: 'system', content: 'استخرج كل النص الظاهر في صورة صفحة المستند بدقة، محافظاً على العربية والإنجليزية والأرقام وترتيب القراءة. أجب بالنص المستخرج فقط. لا تلخص ولا تخترع نصاً غير ظاهر. إذا تعذر قراءة شيء فاكتب [غير مقروء].' },
          { role: 'user', content: [
            { type: 'text', text: `OCR الصفحة ${page.pageNumber} من الملف ${document.sourceName}.` },
            { type: 'image_url', image_url: { url: page.imageDataUrl } },
          ] },
        ] });
        if (!ocr.ok || !ocr.text) throw new Error(ocr.error || `تعذر استخراج نص صفحة PDF ${page.pageNumber}. تأكد أن المزود يدعم الصور.`);
        ocrText.push(`[صفحة ${page.pageNumber} · OCR]\n${ocr.text.slice(0, 6000)}`);
      }
      if (ocrText.length) analysisText = [analysisText, ...ocrText].filter(Boolean).join('\n\n');
      const chunks: string[] = [];
      for (let start = 0; start < analysisText.length; start += CHUNK_SIZE) chunks.push(analysisText.slice(start, start + CHUNK_SIZE));
      const summaries: string[] = [];
      for (let index = 0; index < chunks.length; index += 1) {
        setProgress(`تحليل الجزء ${index + 1} من ${chunks.length}`);
        const part = await window.ibraMind.providers.complete({ providerId, maxTokens: 700, temperature: 0.2, messages: [
          { role: 'system', content: 'لخص الجزء التالي بدقة بالعربية في نقاط قصيرة، مع حفظ أسماء المصطلحات والتواريخ والأرقام المهمة. هذا جزء من مستند؛ لا تستنتج خلاصة نهائية للمستند كله.' },
          { role: 'user', content: `المستند: ${document.sourceName}\nالجزء ${index + 1}/${chunks.length}\n\n${chunks[index]}` },
        ] });
        if (!part.ok || !part.text) throw new Error(part.error || `تعذر تحليل الجزء ${index + 1}.`);
        summaries.push(part.text.slice(0, 4000));
      }
      setProgress('ترتيب الأفكار في خريطة ذهنية');
      const final = await window.ibraMind.providers.complete({ providerId, maxTokens: Math.min(provider.maxTokens, 6000), temperature: provider.temperature, messages: [
        { role: 'system', content: 'حوّل ملخصات المستند إلى خريطة ذهنية. أجب بكائن JSON فقط: {"title":"عنوان","children":[{"title":"فكرة","children":[{"title":"تفصيل","children":[]}]}]}. احتفظ بالإشارات إلى أرقام الصفحات أو الشرائح ضمن عناوين الفروع عند وجودها. أنشئ 4 إلى 8 فروع رئيسية.' },
        { role: 'user', content: `أنشئ خريطة من هذا المستند: ${document.sourceName}\n\n${summaries.join('\n\n')}` },
      ] });
      if (!final.ok || !final.text) throw new Error(final.error || 'تعذر إنشاء الخريطة.');
      onGenerated(mapFromJson(cleanJson(final.text)));
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'فشل تحليل المستند.'); }
    finally { setBusy(false); setProgress(''); }
  };

  return <div className="dialog-backdrop ai-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!busy)onClose()}}><section className="dialog-card ai-dialog document-dialog" role="dialog" aria-modal="true" aria-labelledby="document-title"><button className="dialog-close" aria-label="إغلاق" disabled={busy} onClick={onClose}><X size={18}/></button><div className="dialog-symbol ai-symbol"><FileText size={22}/></div><h2 id="document-title">حوّل مستنداً إلى خريطة</h2><p>يُستخرج النص محلياً، ثم يُرسل للمزود على دفعات لتحليله. صفحات PDF المصورة تُقرأ عبر نموذج رؤية، وتُرسل صورها إليه وتُحتسب ضمن استخدامك.</p>
    {!ready?<div className="provider-loading"><LoaderCircle size={18}/> جارٍ تحميل المزودين</div>:<><label className="ai-provider-label">مزود التحليل<select value={providerId} onChange={(event)=>setProviderId(event.target.value)} disabled={!providers.length}>{providers.map((item)=><option key={item.id} value={item.id}>{item.name} · {item.model}</option>)}</select></label>
      <label className="document-drop"><Upload size={20}/><span>{document ? document.sourceName : 'اختر PDF أو DOCX أو PPTX أو XLSX أو TXT أو Markdown'}</span><input type="file" accept=".pdf,.docx,.pptx,.xlsx,.txt,.md,.markdown,.csv" onChange={(event)=>void chooseFile(event)}/></label>
      {document&&<div className="document-preview"><b>{document.text.length.toLocaleString()} حرف مستخرج{document.pages?` · ${document.pages} صفحة PDF`:''}{document.scannedPages?.length?` · ${document.scannedPages.length} صفحات مصوّرة ستُرسل للـOCR`:''}</b>{document.moreScannedPages&&<p>اكتشفنا أكثر من 10 صفحات مصوّرة؛ سيقتصر OCR على أول 10 لتجنب إرسال عدد كبير من الصور دفعة واحدة.</p>}<p>{document.text.slice(0,450)}{document.text.length>450?'…':document.scannedPages?.length&&!document.text?'صور الصفحات جاهزة لاستخراج النص عبر مزود الرؤية.':''}</p></div>}
      {error&&<div className="provider-error" role="alert"><AlertCircle size={16}/>{error}</div>}{progress&&<div className="provider-loading" role="status"><LoaderCircle className="spin" size={16}/>{progress}</div>}
      <div className="dialog-actions"><button type="button" className="editor-button" onClick={onClose} disabled={busy}>إغلاق</button><button className="editor-button primary" onClick={()=>void analyze()} disabled={!document||!provider||busy}>{busy?<LoaderCircle size={15} className="spin"/>:<Network size={15}/>} تحليل وإنشاء خريطة</button></div></>}
    </section></div>;
}
