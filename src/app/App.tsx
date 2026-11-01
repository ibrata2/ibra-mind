import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutDashboard, Network, PanelsTopLeft, Sparkles, Clock3, Star, Settings, Plus, Search, MoreHorizontal, FileText, Image, AudioLines, BookOpen, Youtube, FolderKanban, ArrowUpLeft, Command, Grid2X2, List, Trash2, X } from 'lucide-react';
import ProviderManager from '../features/ai/ProviderManager';
import type { GeneratedMap } from '../features/ai/AIGenerator';
import { createProject, deleteProject, documentKey, listProjects, updateProject, type ProjectRecord } from '../features/projects/projectStore';
import { peekDocument, saveDocument } from '../features/storage/documentStore';

const MindMapEditor = lazy(() => import('../features/mindmap/MindMapEditor'));
const FlowchartEditor = lazy(() => import('../features/flowchart/FlowchartEditor'));
const WhiteboardEditor = lazy(() => import('../features/whiteboard/WhiteboardEditor'));
const AIGenerator = lazy(() => import('../features/ai/AIGenerator'));
const DocumentAnalyzer = lazy(() => import('../features/documents/DocumentAnalyzer'));
const ImageAnalyzer = lazy(() => import('../features/documents/ImageAnalyzer'));
const AudioAnalyzer = lazy(() => import('../features/documents/AudioAnalyzer'));
const TemplateLibrary = lazy(() => import('../features/templates/TemplateLibrary'));
const YouTubeAnalyzer = lazy(() => import('../features/video/YouTubeAnalyzer'));
const CloudAccount = lazy(() => import('../features/cloud/CloudAccount'));

const nav = [
  { label: 'مساحة العمل', icon: LayoutDashboard, key: 'all' }, { label: 'مشاريعي', icon: FolderKanban, key: 'all' },
  { label: 'الخرائط الذهنية', icon: Network, key: 'mindmap' }, { label: 'المخططات', icon: PanelsTopLeft, key: 'flowchart' }, { label: 'اللوحة البيضاء', icon: PanelsTopLeft, key: 'whiteboard' },
  { label: 'المفضلة', icon: Star, key: 'favorites' }, { label: 'الأخيرة', icon: Clock3, key: 'recent' }, { label: 'القوالب', icon: BookOpen, key: 'templates' },
];
function previewLabels(project: ProjectRecord) {
  try {
    const value = JSON.parse(peekDocument(project.id) || localStorage.getItem(documentKey(project.id)) || 'null') as { nodes?: { id: string; data?: { label?: string; text?: string } }[]; edges?: { source: string; target: string }[] } | null;
    const nodes = value?.nodes ?? [];
    const edges = value?.edges ?? [];
    const root = nodes.find((node) => node.id === 'root') ?? nodes.find((node) => !edges.some((edge) => edge.target === node.id)) ?? nodes[0];
    const branches = edges.filter((edge) => edge.source === root?.id).map((edge) => nodes.find((node) => node.id === edge.target)).filter(Boolean);
    return { root: root?.data?.label ?? root?.data?.text ?? '', first: branches[0]?.data?.label ?? branches[0]?.data?.text ?? '', second: branches[1]?.data?.label ?? branches[1]?.data?.text ?? '' };
  } catch {
    return { root: '', first: '', second: '' };
  }
}
export default function App() {
  const [tab, setTab] = useState('all');
  const [notice, setNotice] = useState('');
  const [projects, setProjects] = useState<ProjectRecord[]>(() => listProjects());
  const [activeProject, setActiveProject] = useState<ProjectRecord | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'about' | 'providers' | 'cloud'>('about');
  const [aiOpen, setAiOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [menuProject, setMenuProject] = useState<string | null>(null);
  const handledAuthCallbacks = useRef(new Set<string>());
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCreateOpen(true);
      }
    };
    window.addEventListener('keydown', onShortcut);
    const onLocalProjectsChanged = () => setProjects(listProjects());
    window.addEventListener('ibra:projects-changed', onLocalProjectsChanged);
    return () => { window.removeEventListener('keydown', onShortcut); window.removeEventListener('ibra:projects-changed', onLocalProjectsChanged); };
  }, []);
  useEffect(() => {
    const auth = window.ibraMind?.auth;
    if (!auth) return;
    const processCallback = (url: string) => {
      if (!url || handledAuthCallbacks.current.has(url)) return;
      handledAuthCallbacks.current.add(url);
      void import('../features/cloud/authCallback').then(({ completeDesktopAuthCallback }) => completeDesktopAuthCallback(url))
        .then(setNotice)
        .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'تعذر إكمال التحقق من الحساب.'))
        .finally(() => { void auth.acknowledge(url); });
    };
    const removeListener = auth.onCallback(processCallback);
    void auth.takePending().then(processCallback).catch(() => setNotice('تعذر قراءة رابط التحقق من الحساب.'));
    return removeListener;
  }, []);
  const visibleProjects = useMemo(() => {
    let filtered = projects;
    if (tab === 'favorites') filtered = filtered.filter((project) => project.favorite);
    else if (tab === 'recent') filtered = [...filtered].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
    else if (tab === 'mindmap') filtered = filtered.filter((project) => project.kind === 'mindmap');
    else if (tab === 'flowchart') filtered = filtered.filter((project) => project.kind === 'flowchart');
    else if (tab === 'whiteboard') filtered = filtered.filter((project) => project.kind === 'whiteboard');
    else if (tab === 'shared') filtered = [];
    const query = search.trim().toLocaleLowerCase();
    if (query) filtered = filtered.filter((project) => project.title.toLocaleLowerCase().includes(query));
    return filtered;
  }, [projects, tab, search]);
  const openNewMap = (title = 'خريطة ذهنية جديدة') => {
    const project = createProject(title);
    setProjects(listProjects());
    setActiveProject(project);
    setCreateOpen(false);
    setNewTitle('');
  };
  const openNewFlowchart = () => {
    const project = createProject('مخطط انسيابي جديد', 'flowchart');
    setProjects(listProjects());
    setActiveProject(project);
  };
  const openNewWhiteboard = () => {
    const project = createProject('لوحة بيضاء جديدة', 'whiteboard');
    setProjects(listProjects());
    setActiveProject(project);
  };
  const handleGeneratedMap = async (map: GeneratedMap) => {
    const project = createProject(map.title, 'mindmap');
    try {
      await saveDocument(project.id, JSON.stringify({ version: 1, title: map.title, nodes: map.nodes, edges: map.edges }));
    } catch {
      setProjects(deleteProject(project.id));
      setNotice('تعذر حفظ الخريطة المولّدة في قاعدة البيانات المحلية.');
      setAiOpen(false);
      setDocumentOpen(false);
      setImageOpen(false);
      setAudioOpen(false);
      setTemplatesOpen(false);
      setYoutubeOpen(false);
      return;
    }
    setProjects(listProjects());
    setActiveProject(project);
    setAiOpen(false);
    setDocumentOpen(false);
    setImageOpen(false);
    setAudioOpen(false);
    setTemplatesOpen(false);
    setYoutubeOpen(false);
  };
  const refreshProjects = () => setProjects(listProjects());
  if (activeProject) {
    const onHome = () => { setActiveProject(null); refreshProjects(); };
    if (activeProject.kind === 'flowchart') return <Suspense fallback={<div className="feature-loading">جارٍ فتح المخطط…</div>}><FlowchartEditor projectId={activeProject.id} title={activeProject.title} onHome={onHome} /></Suspense>;
    if (activeProject.kind === 'whiteboard') return <Suspense fallback={<div className="feature-loading">جارٍ فتح اللوحة…</div>}><WhiteboardEditor projectId={activeProject.id} title={activeProject.title} onHome={onHome} /></Suspense>;
    return <Suspense fallback={<div className="feature-loading">جارٍ فتح الخريطة…</div>}><MindMapEditor projectId={activeProject.id} title={activeProject.title} onHome={onHome} /></Suspense>;
  }
  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><img className="brand-mark" src="./ibra-mind-icon.png" alt="شعار IBRA MIND"/><div><b>IBRA <span>MIND</span></b><small>مساحة التفكير البصري</small></div></div>
      <button className="new-button" onClick={() => setCreateOpen(true)}><Plus size={18}/> مشروع جديد <span>Ctrl K</span></button>
      <div className="nav-label">القائمة</div><nav>{nav.map(({label,icon:Icon,key})=><button key={label} onClick={() => {if(key==='templates'){setTab('all');setTemplatesOpen(true);}else setTab(key)}} className={`nav-item ${key==='templates'?templatesOpen?'active':'':tab===key?'active':''}`}><Icon size={17}/>{label}</button>)}</nav>
      <div className="nav-label space-label">المساحات</div><button className={`nav-item ${tab==='all'?'active':''}`} onClick={()=>setTab('all')}><span className="space-dot violet-dot"/> مشاريعي الشخصية</button><button className={`nav-item ${tab==='shared'?'active':''}`} onClick={()=>setTab('shared')}><span className="space-dot blue-dot"/> مساحة الفريق</button>
      <div className="sidebar-bottom"><div className="upgrade"><Sparkles size={17}/><b>مساحة الذكاء الاصطناعي</b><p>إدارة المزودين وتوليد الخرائط من إعدادات التطبيق.</p><button onClick={() => {setSettingsTab('providers');setSettingsOpen(true)}}>إعدادات المزودين <ArrowUpLeft size={14}/></button></div><button className="nav-item" onClick={() => setSettingsOpen(true)}><Settings size={17}/> الإعدادات</button><div className="profile"><div className="avatar">إ</div><div><b>إبراهيم الخزرجي</b><small>مساحة شخصية محلية</small></div><button className="profile-menu-button" aria-label="إعدادات الحساب المحلي" onClick={()=>setSettingsOpen(true)}><MoreHorizontal size={18}/></button></div></div>
    </aside>
    <section className="main-area">
      <header className="topbar"><div className="breadcrumbs">مساحة العمل <span>/</span> <b>{tab==='shared'?'مساحة الفريق':nav.find((item)=>item.key===tab)?.label || 'الرئيسية'}</b></div><div className="top-actions"><label className="search"><Search size={16}/><input aria-label="البحث في ملفاتك" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="ابحث في ملفاتك"/><kbd><Command size={11}/> K</kbd></label><button className="icon-button" aria-label="الإعدادات" onClick={()=>setSettingsOpen(true)}><Settings size={17}/></button><div className="avatar small-avatar">إ</div></div></header>
      <div className="content"><div className="welcome"><div><div className="eyebrow"><span/> مساحة عملك جاهزة</div><h1>أهلاً بك، إبراهيم <span>✦</span></h1><p>كل فكرة عظيمة تبدأ بخطوة. ماذا ستبني اليوم؟</p></div><div className="welcome-actions"><button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={17}/> مشروع جديد</button><button className="editor-button" onClick={()=>setTemplatesOpen(true)}><BookOpen size={15}/> القوالب</button><button className="editor-button" onClick={()=>setYoutubeOpen(true)}><Youtube size={15}/> YouTube</button></div></div>
        <div className="quick-grid"><button className="quick-card purple-card" onClick={()=>openNewMap()}><div className="quick-icon"><Network size={21}/></div><div><b>خريطة ذهنية</b><small>افتح خريطة محلية قابلة للتحرير</small></div><Plus size={17} className="quick-plus"/></button><button className="quick-card blue-card" onClick={openNewFlowchart}><div className="quick-icon"><PanelsTopLeft size={21}/></div><div><b>مخطط انسيابي</b><small>أنشئ الأشكال واربط المسارات</small></div><Plus size={17} className="quick-plus"/></button><button className="quick-card mint-card" onClick={openNewWhiteboard}><div className="quick-icon"><PanelsTopLeft size={21}/></div><div><b>لوحة بيضاء</b><small>أضف نصوصاً وملاحظات وأشكالاً</small></div><Plus size={17} className="quick-plus"/></button><button className="quick-card amber-card" onClick={()=>setAiOpen(true)}><div className="quick-icon"><Sparkles size={21}/></div><div><b>توليد خريطة بالذكاء الاصطناعي</b><small>اكتب موضوعاً واحصل على خريطة قابلة للتحرير</small></div><Plus size={17} className="quick-plus"/></button><button className="quick-card blue-card" onClick={()=>setDocumentOpen(true)}><div className="quick-icon"><FileText size={21}/></div><div><b>تحليل مستند</b><small>PDF وWord وPowerPoint وExcel ونصوص</small></div><Plus size={17} className="quick-plus"/></button><button className="quick-card mint-card" onClick={()=>setImageOpen(true)}><div className="quick-icon"><Image size={21}/></div><div><b>تحليل صورة</b><small>استخرج الأفكار والنصوص بخدمة رؤية</small></div><Plus size={17} className="quick-plus"/></button><button className="quick-card amber-card" onClick={()=>setAudioOpen(true)}><div className="quick-icon"><AudioLines size={21}/></div><div><b>تحليل صوت</b><small>سجّل أو ارفع ملفاً وحوّله إلى خريطة</small></div><Plus size={17} className="quick-plus"/></button></div>
        <div className="section-heading"><div><h2>ملفاتك</h2><p>{visibleProjects.length} مساحة محفوظة على هذا الجهاز</p></div><div className="view-switch"><button aria-label="عرض شبكي" className={view==='grid'?'chosen':''} onClick={()=>setView('grid')}><Grid2X2 size={16}/></button><button aria-label="عرض قائمة" className={view==='list'?'chosen':''} onClick={()=>setView('list')}><List size={17}/></button></div></div>
        <div className="tabs">{[['all','الكل'],['recent','الأخيرة'],['favorites','المفضلة'],['shared','مشتركة']].map(([key,label])=><button onClick={()=>setTab(key)} className={tab===key?'selected':''} key={key}>{label}</button>)}</div>
        <div className={`project-grid ${view==='list'?'list-view':''}`}>{visibleProjects.map((project,i)=>{const color=['violet','blue','mint'][i%3];const type=project.kind==='mindmap'?'خريطة ذهنية':project.kind==='flowchart'?'مخطط انسيابي':'لوحة بيضاء';const date=new Intl.DateTimeFormat('ar-IQ',{dateStyle:'medium'}).format(new Date(project.updatedAt));const preview=previewLabels(project);return <article className="project-card" key={project.id}><div className={`project-preview ${color}`} role="button" tabIndex={0} onClick={()=>setActiveProject(project)} onKeyDown={(event)=>{if(event.key==='Enter')setActiveProject(project)}} aria-label={`فتح ${project.title}`}><div className="preview-toolbar"><span/><span/><span/></div><div className="preview-map"><div className="map-root">{preview.root||project.title}</div>{preview.first&&<div className="map-branch left-branch">{preview.first}</div>}{preview.second&&<div className="map-branch right-branch">{preview.second}</div>}{preview.first&&<i className="connector c1"/>}{preview.second&&<i className="connector c2"/>}</div><button className="project-more" aria-label="خيارات الملف" onClick={(event)=>{event.stopPropagation();setMenuProject(menuProject===project.id?null:project.id)}}><MoreHorizontal size={17}/></button>{menuProject===project.id&&<div className="project-menu"><button onClick={(event)=>{event.stopPropagation();const title=window.prompt('غيّر اسم الملف',project.title);if(title?.trim()){setProjects(updateProject(project.id,{title:title.trim()}));}setMenuProject(null)}}>إعادة تسمية</button><button onClick={(event)=>{event.stopPropagation();if(projects.length<2||window.confirm('هل تريد حذف هذا الملف وكل محتواه المحلي؟'))setProjects(deleteProject(project.id));setMenuProject(null)}}><Trash2 size={14}/> حذف الملف</button></div>}</div><div className="project-info"><div className={`file-icon ${color}`}><FileText size={17}/></div><button className="project-open" onClick={()=>setActiveProject(project)}><b>{project.title}</b><small>{type} · {date}</small></button><button className="project-star" aria-label={project.favorite?'إزالة من المفضلة':'إضافة إلى المفضلة'} onClick={()=>setProjects(updateProject(project.id,{favorite:!project.favorite}))}><Star size={16} fill={project.favorite?'currentColor':'none'}/></button></div></article>})}</div>
        {!visibleProjects.length&&<div className="empty-hint"><span>✧</span><div><b>{search?'ما لقينا ملف بهذا الاسم':tab==='shared'?'مساحة الفريق فارغة':'ماكو ملفات بهذا القسم بعد'}</b><p>{search?'جرّب كلمة ثانية أو امسح البحث.':tab==='shared'?'المشاركة السحابية ودعوات الفريق تحتاج إعداد خدمة مزامنة.':'أنشئ خريطة ذهنية حتى تظهر هنا.'}</p></div>{tab!=='shared'&&<button onClick={()=>search?setSearch(''):setCreateOpen(true)}>{search?'مسح البحث':'إنشاء خريطة'} <ArrowUpLeft size={14}/></button>}</div>}
        {visibleProjects.length>0&&<div className="empty-hint"><span>✧</span><div><b>ملفاتك محفوظة على هذا الجهاز</b><p>أنشئ خريطة جديدة؛ كل مساحة تحتفظ بمحتواها بشكل مستقل.</p></div><button onClick={()=>setCreateOpen(true)}>خريطة جديدة <ArrowUpLeft size={14}/></button></div>}
        <footer><span>IBRA MIND · الإصدار 0.4.0</span><span>برمجة وتطوير <b>إبراهيم الخزرجي</b> · © 2026</span></footer>
      </div>
    </section>{notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice('')}>حسناً</button></div>}
    {createOpen&&<div className="dialog-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setCreateOpen(false)}}><section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="create-title"><button className="dialog-close" aria-label="إغلاق" onClick={()=>setCreateOpen(false)}><X size={18}/></button><div className="dialog-symbol"><Network size={22}/></div><h2 id="create-title">ابدأ خريطة ذهنية</h2><p>سمّ مساحة أفكارك. تُحفظ ملفاتك محلياً على هذا الجهاز.</p><form onSubmit={(event)=>{event.preventDefault();openNewMap(newTitle||'خريطة ذهنية جديدة')}}><label htmlFor="project-title">اسم الخريطة</label><input id="project-title" autoFocus maxLength={80} value={newTitle} onChange={(event)=>setNewTitle(event.target.value)} placeholder="مثال: خطة تعلم جديدة"/><div className="dialog-actions"><button type="button" className="editor-button" onClick={()=>setCreateOpen(false)}>إلغاء</button><button className="editor-button primary" type="submit"><Plus size={15}/> إنشاء الخريطة</button></div></form></section></div>}
    {settingsOpen&&<div className="dialog-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setSettingsOpen(false)}}><section className="dialog-card settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><button className="dialog-close" aria-label="إغلاق" onClick={()=>setSettingsOpen(false)}><X size={18}/></button><div className="settings-tabs"><button className={settingsTab==='about'?'selected':''} onClick={()=>setSettingsTab('about')}>عام وحول</button><button className={settingsTab==='providers'?'selected':''} onClick={()=>setSettingsTab('providers')}>مزودو الذكاء الاصطناعي</button><button className={settingsTab==='cloud'?'selected':''} onClick={()=>setSettingsTab('cloud')}>الحساب والسحابة</button></div>{settingsTab==='providers'?<ProviderManager/>:settingsTab==='cloud'?<CloudAccount/>:<div className="about-dialog-content"><img className="about-app-icon" src="./ibra-mind-icon.png" alt="شعار IBRA MIND"/><h2 id="settings-title">حول IBRA MIND</h2><p>استوديو الخرائط الذهنية والتفكير البصري</p><dl><div><dt>الإصدار</dt><dd>0.4.0</dd></div><div><dt>برمجة وتطوير</dt><dd>إبراهيم الخزرجي</dd></div><div><dt>تيليغرام</dt><dd><a href="https://t.me/ibraprogram" target="_blank" rel="noreferrer">t.me/ibraprogram</a></dd></div><div><dt>TikTok</dt><dd>@ibraprogram</dd></div><div><dt>الحفظ</dt><dd>ملفات محلية لكل مساحة</dd></div></dl><small>© 2026 إبراهيم الخزرجي. جميع الحقوق محفوظة.</small></div>}</section></div>}
    {aiOpen&&<Suspense fallback={<div className="feature-loading">جارٍ تجهيز الاستوديو…</div>}><AIGenerator onClose={()=>setAiOpen(false)} onGenerated={handleGeneratedMap}/></Suspense>}
    {documentOpen&&<Suspense fallback={<div className="feature-loading">جارٍ تجهيز محلل المستندات…</div>}><DocumentAnalyzer onClose={()=>setDocumentOpen(false)} onGenerated={handleGeneratedMap}/></Suspense>}
    {imageOpen&&<Suspense fallback={<div className="feature-loading">جارٍ تجهيز محلل الصور…</div>}><ImageAnalyzer onClose={()=>setImageOpen(false)} onGenerated={handleGeneratedMap}/></Suspense>}
    {audioOpen&&<Suspense fallback={<div className="feature-loading">جارٍ تجهيز محلل الصوت…</div>}><AudioAnalyzer onClose={()=>setAudioOpen(false)} onGenerated={handleGeneratedMap}/></Suspense>}
    {templatesOpen&&<Suspense fallback={<div className="feature-loading">جارٍ تجهيز مكتبة القوالب…</div>}><TemplateLibrary onClose={()=>setTemplatesOpen(false)} onSelect={handleGeneratedMap}/></Suspense>}
    {youtubeOpen&&<Suspense fallback={<div className="feature-loading">جارٍ تجهيز محلل YouTube…</div>}><YouTubeAnalyzer onClose={()=>setYoutubeOpen(false)} onGenerated={handleGeneratedMap}/></Suspense>}
  </main>;
}


