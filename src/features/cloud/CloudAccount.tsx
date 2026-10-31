import { useEffect, useState } from 'react';
import { Cloud, Download, History, LogOut, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import { createProject, listProjects } from '../projects/projectStore';
import { loadDocument, saveDocument } from '../storage/documentStore';
import { getCloudClient, readCloudConfig, saveCloudConfig, type CloudConfig } from './supabase';
import { PASSWORD_RECOVERY_KEY } from './authCallback';

type CloudProject = { id: string; title: string; kind: 'mindmap' | 'flowchart' | 'whiteboard'; content: unknown; updated_at: string };
type CloudVersion = { id: string; project_id: string; title: string; content: unknown; created_at: string };

function message(error: unknown) {
  const text = error instanceof Error ? error.message : 'حدث خطأ غير معروف.';
  if (/relation .* does not exist|Could not find the table/i.test(text)) return 'نفّذ ملف إعداد قاعدة البيانات أولاً من supabase/migrations/001_cloud_projects.sql.';
  if (/row-level security|permission denied/i.test(text)) return 'رفضت قاعدة البيانات الطلب. تحقق من سياسات الأمان وتسجيل الدخول.';
  return text;
}

function authRedirectUrl() {
  return window.location.protocol === 'file:' ? 'ibramind://auth' : `${window.location.origin}/`;
}

export default function CloudAccount() {
  const [config, setConfig] = useState<CloudConfig>(() => readCloudConfig());
  const [configured, setConfigured] = useState(Boolean(config.url && config.key));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(() => localStorage.getItem(PASSWORD_RECOVERY_KEY) === 'pending');
  const [identity, setIdentity] = useState('');
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [versions, setVersions] = useState<CloudVersion[]>([]);
  const [selected, setSelected] = useState('');
  const [localProjectId, setLocalProjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!configured) return;
    const client = getCloudClient();
    if (!client) return;
    let alive = true;
    void client.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setSignedIn(Boolean(data.user));
      setIdentity(data.user?.email ?? '');
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      setSignedIn(Boolean(session?.user));
      if (event === 'PASSWORD_RECOVERY') { localStorage.setItem(PASSWORD_RECOVERY_KEY, 'pending'); setRecoveryMode(true); }
      if (event === 'SIGNED_OUT') { localStorage.removeItem(PASSWORD_RECOVERY_KEY); setRecoveryMode(false); }
      setIdentity(session?.user?.email ?? '');
      setProjects([]); setVersions([]);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, [configured]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setNotice('');
    try { await action(); }
    catch (error) { setNotice(message(error)); }
    finally { setBusy(false); }
  };

  const authenticate = (kind: 'signIn' | 'signUp') => run(async () => {
    const client = getCloudClient();
    if (!client) throw new Error('احفظ رابط المشروع والمفتاح العام أولاً.');
    if (kind === 'signIn') {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setNotice('تم تسجيل الدخول.');
    } else {
      const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: authRedirectUrl() } });
      if (error) throw error;
      if (!data.session) setNotice('أرسلنا رسالة تأكيد إلى بريدك. أكّد الحساب ثم سجّل الدخول.');
      else setNotice('تم إنشاء الحساب وتسجيل الدخول.');
    }
  });

  const sendPasswordReset = () => run(async () => {
    const client = getCloudClient();
    if (!client || !email.trim()) throw new Error('أدخل البريد الإلكتروني أولاً.');
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirectUrl() });
    if (error) throw error;
    setNotice('أرسلنا رابط استعادة كلمة المرور إلى بريدك.');
  });

  const updatePassword = () => run(async () => {
    if (password.length < 8) throw new Error('اختر كلمة مرور من 8 أحرف على الأقل.');
    const { error } = await getCloudClient()!.auth.updateUser({ password });
    if (error) throw error;
    localStorage.removeItem(PASSWORD_RECOVERY_KEY); setRecoveryMode(false); setPassword(''); setNotice('تم تحديث كلمة المرور.');
  });

  const loadCloudProjects = async () => {
    const client = getCloudClient();
    if (!client) throw new Error('إعداد السحابة غير مكتمل.');
    const { data, error } = await client.from('ibra_projects').select('id,title,kind,content,updated_at').order('updated_at', { ascending: false });
    if (error) throw error;
    setProjects((data ?? []) as CloudProject[]);
    return (data ?? []).length;
  };

  const refreshProjects = () => run(async () => {
    const count = await loadCloudProjects();
    setNotice(`تم تحميل ${count} ملفاً من السحابة.`);
  });

  const pushLocal = () => run(async () => {
    const client = getCloudClient();
    const user = await client?.auth.getUser();
    if (!client || !user?.data.user) throw new Error('سجّل الدخول قبل الرفع.');
    const local = listProjects().find((item) => item.id === localProjectId);
    if (!local) throw new Error('اختر ملفاً محلياً صالحاً.');
    const raw = await loadDocument(local.id);
    if (!raw) throw new Error('هذا الملف لا يحتوي على محتوى محفوظ.');
    const content = JSON.parse(raw) as unknown;
    const { error } = await client.rpc('save_ibra_project', { p_project_id: local.id, p_title: local.title, p_kind: local.kind, p_content: content });
    if (error) throw error;
    await loadCloudProjects();
    setNotice('رُفع الملف إلى حسابك وحُفظت نسخة استرجاع.');
  });

  const loadVersions = (projectId: string) => run(async () => {
    setSelected(projectId);
    const client = getCloudClient();
    const { data, error } = await client!.from('ibra_project_versions').select('id,project_id,title,content,created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(30);
    if (error) throw error;
    setVersions((data ?? []) as CloudVersion[]);
  });

  const restore = (record: CloudProject | CloudVersion) => run(async () => {
    const content = typeof record.content === 'string' ? record.content : JSON.stringify(record.content);
    const data = JSON.parse(content) as { nodes?: unknown[]; edges?: unknown[] };
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) throw new Error('نسخة الملف تالفة ولا يمكن استعادتها.');
    const cloudProject = 'kind' in record ? record : projects.find((item) => item.id === record.project_id);
    const project = createProject(`${record.title} · استعادة`, cloudProject?.kind ?? 'mindmap');
    await saveDocument(project.id, content);
    window.dispatchEvent(new Event('ibra:projects-changed'));
    setNotice(`استُعيد الملف محلياً باسم «${project.title}».`);
  });

  return <section className="cloud-account" aria-label="الحساب والتخزين السحابي">
    <div className="provider-heading"><div><Cloud size={19}/><h2>الحساب والسحابة</h2></div><span>حفظ محلي أولاً</span></div>
    <p className="cloud-intro">ملفاتك تبقى على الجهاز. عند إعداد مشروعك السحابي تستطيع تسجيل الدخول، رفع نسخة مشفرة أثناء النقل، واستعادة سجل النسخ على أجهزتك.</p>
    <details className="cloud-config" open={!configured}>
      <summary>إعداد مشروع Supabase</summary>
      <label>رابط المشروع<input type="url" value={config.url} onChange={(event)=>setConfig({...config,url:event.target.value})} placeholder="https://project-id.supabase.co" autoComplete="url"/></label>
      <label>المفتاح العام / Publishable Key<input type="password" value={config.key} onChange={(event)=>setConfig({...config,key:event.target.value})} placeholder="sb_publishable_…" autoComplete="off"/></label>
      <div className="cloud-config-actions"><button className="editor-button primary" disabled={busy||!config.url.trim()||!config.key.trim()} onClick={()=>{try{const saved=saveCloudConfig(config);setConfig(saved);setConfigured(true);setNotice('حُفظ إعداد الاتصال محلياً.');}catch(e){setNotice(message(e));}}}>حفظ الإعداد</button><small>المفتاح العام مخصص للعميل؛ لا تضع Service Role Key هنا.</small></div>
    </details>
    {configured&&<>
      {!signedIn?<form className="cloud-login" onSubmit={(event)=>{event.preventDefault();void authenticate('signIn');}}>
        <label>البريد الإلكتروني<input type="email" required value={email} onChange={(event)=>setEmail(event.target.value)} autoComplete="email"/></label>
        <label>كلمة المرور<input type="password" minLength={8} required value={password} onChange={(event)=>setPassword(event.target.value)} autoComplete="current-password"/></label>
        <div className="cloud-config-actions"><button className="editor-button primary" disabled={busy}>تسجيل الدخول</button><button type="button" className="editor-button" disabled={busy} onClick={()=>void authenticate('signUp')}>إنشاء حساب</button><button type="button" className="editor-button" disabled={busy} onClick={()=>void sendPasswordReset()}>نسيت كلمة المرور</button></div>
      </form>:<div className="cloud-signed-in"><ShieldCheck size={17}/><b>{identity}</b>{recoveryMode?<><input aria-label="كلمة المرور الجديدة" type="password" minLength={8} value={password} onChange={(event)=>setPassword(event.target.value)} placeholder="كلمة المرور الجديدة"/><button className="editor-button primary" disabled={busy} onClick={()=>void updatePassword()}>تحديث كلمة المرور</button></>:<button className="editor-button" disabled={busy} onClick={()=>void run(async()=>{const {error}=await getCloudClient()!.auth.signOut();if(error)throw error;setIdentity('');})}><LogOut size={14}/> تسجيل الخروج</button>}</div>}
      {signedIn&&<div className="cloud-sync">
        <div className="cloud-local-upload"><label>الملف المحلي<select value={localProjectId} onChange={(event)=>setLocalProjectId(event.target.value)}><option value="">اختر ملفاً لرفعه</option>{listProjects().map((project)=><option key={project.id} value={project.id}>{project.title}</option>)}</select></label><button className="editor-button primary" disabled={busy||!localProjectId} onClick={()=>void pushLocal()}><Upload size={14}/> رفع وحفظ نسخة</button></div>
        <div className="cloud-list-heading"><b>ملفات الحساب</b><button className="editor-button" disabled={busy} onClick={()=>void refreshProjects()}><RefreshCw size={14}/> مزامنة القائمة</button></div>
        {projects.map((project)=><article className="cloud-project" key={project.id}><span><b>{project.title}</b><small>{new Intl.DateTimeFormat('ar-IQ',{dateStyle:'medium',timeStyle:'short'}).format(new Date(project.updated_at))}</small></span><div><button className="editor-button" disabled={busy} onClick={()=>void restore(project)}><Download size={14}/> استعادة</button><button className="editor-button" disabled={busy} onClick={()=>void loadVersions(project.id)}><History size={14}/> النسخ</button></div></article>)}
        {selected&&versions.map((version)=><article className="cloud-version" key={version.id}><span>{new Intl.DateTimeFormat('ar-IQ',{dateStyle:'medium',timeStyle:'short'}).format(new Date(version.created_at))}</span><button className="editor-button" disabled={busy} onClick={()=>void restore(version)}><Download size={14}/> استعادة النسخة</button></article>)}
      </div>}
    </>}
    {notice&&<p className="cloud-notice" role="status">{notice}</p>}
    {busy&&<small>جارٍ الاتصال…</small>}
  </section>;
}
