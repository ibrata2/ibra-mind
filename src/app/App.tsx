import { useState } from 'react';
import { Brain, LayoutDashboard, Network, PanelsTopLeft, Sparkles, Clock3, Star, Settings, Plus, Search, Bell, ChevronDown, MoreHorizontal, FileText, FolderKanban, ArrowUpLeft, Command } from 'lucide-react';

const projects = [
  { title: 'خطة تعلم الذكاء الاصطناعي', type: 'خريطة ذهنية', date: 'تم التعديل قبل ساعة', color: 'violet', icon: '✦' },
  { title: 'إطلاق المنتج الجديد', type: 'خطة مشروع', date: 'تم التعديل أمس', color: 'blue', icon: '◈' },
  { title: 'مبادئ البرمجة', type: 'مخطط انسيابي', date: 'تم التعديل قبل 3 أيام', color: 'mint', icon: '⌘' },
];
const nav = [
  { label: 'مساحة العمل', icon: LayoutDashboard, active: true }, { label: 'مشاريعي', icon: FolderKanban },
  { label: 'الخرائط الذهنية', icon: Network }, { label: 'المخططات', icon: PanelsTopLeft },
  { label: 'المفضلة', icon: Star }, { label: 'الأخيرة', icon: Clock3 },
];
export default function App() {
  const [tab, setTab] = useState('الكل');
  const [notice, setNotice] = useState('');
  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Brain size={21}/></div><div><b>IBRA <span>MIND</span></b><small>مساحة التفكير البصري</small></div></div>
      <button className="new-button" onClick={() => setNotice('سيتم تفعيل محرر الخرائط في المرحلة التالية')}><Plus size={18}/> مشروع جديد <span>⌘ K</span></button>
      <div className="nav-label">القائمة</div><nav>{nav.map(({label,icon:Icon,active})=><button key={label} className={`nav-item ${active?'active':''}`}><Icon size={17}/>{label}</button>)}</nav>
      <div className="nav-label space-label">المساحات</div><button className="nav-item"><span className="space-dot violet-dot"/> مشاريعي الشخصية</button><button className="nav-item"><span className="space-dot blue-dot"/> مساحة الفريق</button>
      <div className="sidebar-bottom"><div className="upgrade"><Sparkles size={17}/><b>اكتشف قوة الذكاء الاصطناعي</b><p>حوّل أفكارك إلى خرائط واضحة.</p><button onClick={() => setNotice('مركز الذكاء الاصطناعي ضمن مراحل التطوير القادمة')}>اعرف المزيد <ArrowUpLeft size={14}/></button></div><button className="nav-item"><Settings size={17}/> الإعدادات</button><div className="profile"><div className="avatar">إ</div><div><b>إبراهيم الخزرجي</b><small>مساحة شخصية</small></div><MoreHorizontal size={18}/></div></div>
    </aside>
    <section className="main-area">
      <header className="topbar"><div className="breadcrumbs">مساحة العمل <span>/</span> <b>الرئيسية</b></div><div className="top-actions"><button className="search"><Search size={16}/> ابحث في ملفاتك <kbd><Command size={11}/> K</kbd></button><button className="icon-button"><Bell size={17}/></button><div className="avatar small-avatar">إ</div></div></header>
      <div className="content"><div className="welcome"><div><div className="eyebrow"><span/> مساحة عملك جاهزة</div><h1>أهلاً بك، إبراهيم <span>✦</span></h1><p>كل فكرة عظيمة تبدأ بخطوة. ماذا ستبني اليوم؟</p></div><button className="primary-button" onClick={() => setNotice('سيتم تجهيز محرر المشروع في المرحلة التالية')}><Plus size={17}/> مشروع جديد</button></div>
        <div className="quick-grid"><button className="quick-card purple-card" onClick={()=>setNotice('محرر الخرائط الذهنية قيد البناء ضمن المرحلة الثانية')}><div className="quick-icon"><Network size={21}/></div><div><b>خريطة ذهنية</b><small>رتّب أفكارك بصرياً</small></div><Plus size={17} className="quick-plus"/></button><button className="quick-card blue-card" onClick={()=>setNotice('محرر المخططات قيد البناء ضمن المرحلة السابعة')}><div className="quick-icon"><PanelsTopLeft size={21}/></div><div><b>مخطط انسيابي</b><small>ارسم سير عملك</small></div><Plus size={17} className="quick-plus"/></button><button className="quick-card amber-card" onClick={()=>setNotice('مولد الذكاء الاصطناعي قيد البناء ضمن المرحلة العاشرة')}><div className="quick-icon"><Sparkles size={21}/></div><div><b>توليد بالذكاء الاصطناعي</b><small>ابدأ من موضوع أو فكرة</small></div><Plus size={17} className="quick-plus"/></button></div>
        <div className="section-heading"><div><h2>ملفاتك</h2><p>تابع مشاريعك وأفكارك الأخيرة</p></div><button className="view-button">كل الملفات <ChevronDown size={15}/></button></div>
        <div className="tabs">{['الكل','الأخيرة','المفضلة','مشتركة'].map(x=><button onClick={()=>setTab(x)} className={tab===x?'selected':''} key={x}>{x}</button>)}</div>
        <div className="project-grid">{projects.map((p,i)=><article className="project-card" key={p.title}><div className={`project-preview ${p.color}`}><div className="preview-toolbar"><span/><span/><span/></div><div className="preview-map"><div className="map-root">{p.icon} {i===0?'الذكاء الاصطناعي':i===1?'إطلاق المنتج':'البرمجة'}</div><div className="map-branch left-branch">التخطيط</div><div className="map-branch right-branch">الأفكار</div><i className="connector c1"/><i className="connector c2"/></div><button className="project-more"><MoreHorizontal size={17}/></button></div><div className="project-info"><div className={`file-icon ${p.color}`}><FileText size={17}/></div><div><b>{p.title}</b><small>{p.type} · {p.date}</small></div><Star size={16} className="project-star"/></div></article>)}</div>
        <div className="empty-hint"><span>✧</span><div><b>أفكارك تستحق مساحة أكبر</b><p>ابدأ بخريطة ذهنية جديدة أو استكشف قوالب جاهزة لمشروعك التالي.</p></div><button onClick={()=>setNotice('مكتبة القوالب قيد التخطيط')}>استكشف القوالب <ArrowUpLeft size={14}/></button></div>
        <footer><span>IBRA MIND · الإصدار 0.1.0</span><span>برمجة وتطوير <b>إبراهيم الخزرجي</b> · © 2026</span></footer>
      </div>
    </section>{notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice('')}>حسناً</button></div>}
  </main>;
}
