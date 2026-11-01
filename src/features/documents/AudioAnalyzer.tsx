import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AudioLines, LoaderCircle, Mic, Network, Square, Upload, X } from 'lucide-react';
import type { AIProviderSummary } from '../../types/desktop';
import { mapFromJson, type GeneratedMap } from '../ai/AIGenerator';

type Transcript = { text: string; segments?: { start: number; end: number; text: string }[] };
const jsonFrom = (value: string) => JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('تعذرت قراءة الملف الصوتي.'));
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1] || '') : reject(new Error('الملف الصوتي غير صالح.'));
  reader.readAsDataURL(file);
});
const stamp = (seconds: number) => { const s = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };

export default function AudioAnalyzer({ onClose, onGenerated }: { onClose: () => void; onGenerated: (map: GeneratedMap) => void }) {
  const [providers, setProviders] = useState<AIProviderSummary[]>([]);
  const [transcribeId, setTranscribeId] = useState('');
  const [mapProviderId, setMapProviderId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [ready, setReady] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  useEffect(() => {
    if (!window.ibraMind?.providers) { setError('تحويل الصوت متاح في تطبيق Windows بعد ضبط مزود صوت متوافق.'); setReady(true); return; }
    void window.ibraMind.providers.list().then((result) => {
      const enabled = (result.providers || []).filter((item) => item.enabled);
      const audio = enabled.filter((item) => item.protocol === 'openai-compatible');
      setProviders(enabled);
      let routes: Record<string,string> = {};
      try { routes = JSON.parse(localStorage.getItem('ibra-mind-ai-routing-v1') || '{}'); } catch { routes = {}; }
      setTranscribeId(audio.find((item) => item.id === routes.audioTranscription)?.id || audio.find((item) => item.model.toLowerCase().includes('whisper'))?.id || audio[0]?.id || '');
      setMapProviderId(enabled.find((item) => item.id === routes.mindMapGeneration)?.id || enabled.find((item) => item.isDefault)?.id || enabled[0]?.id || '');
      if (!audio.length) setError('أضف مزود OpenAI Compatible يدعم audio/transcriptions ونموذجاً مثل whisper-1.');
      setReady(true);
    }).catch(() => { setError('تعذر تحميل إعدادات المزود.'); setReady(true); });
    return () => { stream.current?.getTracks().forEach((track)=>track.stop()); };
  }, []);
  const audioProviders = useMemo(() => providers.filter((item)=>item.enabled&&item.protocol==='openai-compatible'),[providers]);

  const loadFile = async (selected?: File) => {
    if (!selected) return;
    const validType = /^(audio\/(mpeg|wav|mp4|aac|ogg|webm|x-m4a|x-wav)|video\/mp4)$/i.test(selected.type) || /\.(mp3|wav|m4a|aac|ogg|webm)$/i.test(selected.name);
    if (!validType) { setError('الصيغ المدعومة: MP3 وWAV وM4A وAAC وOGG.'); return; }
    if (selected.size > 25*1024*1024) { setError('حجم الملف يجب ألا يتجاوز 25 ميغابايت.'); return; }
    setFile(selected); setTranscript(null); setError('');
  };
  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('التسجيل غير متاح في هذا النظام. استخدم رفع ملف صوتي.'); return; }
    try {
      const permission = await window.ibraMind?.media?.requestMicrophone();
      if (permission && !permission.ok) throw new Error(permission.error || 'تعذر السماح بالميكروفون.');
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'].find((type)=>MediaRecorder.isTypeSupported(type));
      recorder.current = new MediaRecorder(stream.current, mimeType?{mimeType}:undefined);
      chunks.current = [];
      recorder.current.ondataavailable = (event) => { if(event.data.size) chunks.current.push(event.data); };
      recorder.current.onstop = () => {
        const blob = new Blob(chunks.current,{type:recorder.current?.mimeType||'audio/webm'});
        if(blob.size>25*1024*1024){setError('التسجيل تجاوز 25 ميغابايت.');return;}
        setFile(new File([blob],`recording.${blob.type.includes('ogg')?'ogg':'webm'}`,{type:blob.type}));setTranscript(null);
        stream.current?.getTracks().forEach((track)=>track.stop());stream.current=null;
      };
      recorder.current.start(500);setRecording(true);setError('');
    } catch { setError('تعذر الوصول إلى الميكروفون. اسمح بالتسجيل أو ارفع ملفاً صوتياً.'); }
  };
  const stopRecording = () => { recorder.current?.stop();setRecording(false); };

  const transcribe = async () => {
    if(!file||!window.ibraMind?.providers)return;
    setBusy(true);setError('');
    try {
      const base64=await toBase64(file);
      const result=await window.ibraMind.providers.transcribe({providerId:transcribeId,fileName:file.name,mimeType:file.type||'audio/mpeg',base64});
      if(!result.ok||!result.text)throw new Error(result.error||'تعذر تحويل الصوت إلى نص.');
      setTranscript({text:result.text,segments:result.segments});
    } catch(failure){setError(failure instanceof Error?failure.message:'فشل تحويل الصوت.');}
    finally{setBusy(false);}
  };
  const createMap = async () => {
    const provider=providers.find((item)=>item.id===mapProviderId);
    if(!transcript||!provider||!window.ibraMind?.providers)return;
    setBusy(true);setError('');
    const result=await window.ibraMind.providers.complete({providerId:provider.id,maxTokens:Math.min(provider.maxTokens,6000),temperature:provider.temperature,messages:[
      {role:'system',content:'حوّل التفريغ الصوتي إلى خريطة ذهنية دقيقة. أجب بـ JSON فقط: {"title":"عنوان","children":[{"title":"فكرة","children":[{"title":"تفصيل","children":[]}]}]}. لا تضف معلومات غير موجودة. اجعل الفروع بلغة المتحدث.'},
      {role:'user',content:`أنشئ خريطة ذهنية من هذا التفريغ الصوتي (${file?.name||'تسجيل'}):\n\n${transcript.text.slice(0,24000)}`},
    ]});
    setBusy(false);
    if(!result.ok||!result.text){setError(result.error||'تعذر إنشاء خريطة.');return;}
    try{onGenerated(mapFromJson(jsonFrom(result.text)));}catch(failure){setError(failure instanceof Error?failure.message:'استجابة الخريطة غير صالحة.');}
  };

  return <div className="dialog-backdrop ai-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!busy&&!recording)onClose()}}><section className="dialog-card ai-dialog document-dialog" role="dialog" aria-modal="true" aria-labelledby="audio-title"><button className="dialog-close" aria-label="إغلاق" disabled={busy||recording} onClick={onClose}><X size={18}/></button><div className="dialog-symbol ai-symbol"><AudioLines size={22}/></div><h2 id="audio-title">حوّل الصوت إلى خريطة</h2><p>ارفع تسجيلاً أو سجّل مباشرة. التفريغ يُرسل إلى مزود صوت متوافق مع OpenAI.</p>
    {!ready?<div className="provider-loading"><LoaderCircle size={18}/> جارٍ تحميل المزودين</div>:<><label className="ai-provider-label">مزود تحويل الصوت<select value={transcribeId} onChange={(event)=>setTranscribeId(event.target.value)} disabled={!audioProviders.length}>{audioProviders.map((item)=><option key={item.id} value={item.id}>{item.name} · {item.model}</option>)}</select></label><label className="document-drop"><Upload size={20}/><span>{file?.name||'اختر MP3 أو WAV أو M4A أو AAC أو OGG'}</span><input type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg" onChange={(event)=>void loadFile(event.target.files?.[0])}/></label><div className="audio-actions"><button className="editor-button" onClick={()=>void startRecording()} disabled={recording||busy}><Mic size={15}/> بدء تسجيل</button><button className="editor-button" onClick={stopRecording} disabled={!recording}><Square size={14}/> إيقاف</button>{recording&&<span>جارٍ التسجيل…</span>}</div>{file&&<button className="editor-button primary audio-transcribe" onClick={()=>void transcribe()} disabled={busy||!transcribeId}>{busy?<LoaderCircle size={15} className="spin"/>:<AudioLines size={15}/>} تحويل إلى نص</button>}
      {transcript&&<><div className="document-preview"><b>التفريغ الصوتي</b><p>{transcript.text}</p></div>{Boolean(transcript.segments?.length)&&<div className="audio-segments">{transcript.segments!.map((segment,index)=><p key={`${index}-${segment.start}`}><time>{stamp(segment.start)}</time> {segment.text}</p>)}</div>}<label className="ai-provider-label">مزود إنشاء الخريطة<select value={mapProviderId} onChange={(event)=>setMapProviderId(event.target.value)}>{providers.map((item)=><option key={item.id} value={item.id}>{item.name} · {item.model}</option>)}</select></label><button className="editor-button primary audio-transcribe" onClick={()=>void createMap()} disabled={busy||!mapProviderId}>{busy?<LoaderCircle size={15} className="spin"/>:<Network size={15}/>} إنشاء خريطة من التفريغ</button></>}
      {error&&<div className="provider-error" role="alert"><AlertCircle size={16}/>{error}</div>}<div className="dialog-actions"><button type="button" className="editor-button" onClick={onClose} disabled={busy||recording}>إغلاق</button></div></>}
    </section></div>;
}
