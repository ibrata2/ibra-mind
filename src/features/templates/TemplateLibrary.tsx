import { useMemo, useState } from 'react';
import { BookOpen, Heart, Search, X } from 'lucide-react';
import type { GeneratedMap } from '../ai/AIGenerator';

type TemplateDef = { id: string; title: string; category: string; description: string; branches: { title: string; children: string[] }[] };
const templates: TemplateDef[] = [
  { id:'study',title:'خطة دراسة مادة',category:'التعليم',description:'نظّم وحدات المادة والمراجعة والاختبارات.',branches:[{title:'المحتوى',children:['الوحدات','المفاهيم','المصادر']},{title:'الجدول',children:['خطة أسبوعية','جلسات التركيز','أيام المراجعة']},{title:'الاستعداد للاختبار',children:['أسئلة تدريبية','نقاط صعبة','مراجعة نهائية']}] },
  { id:'business',title:'تحليل مشروع تجاري',category:'الأعمال',description:'حلّل السوق والعملاء والقيمة والإيرادات.',branches:[{title:'السوق',children:['العملاء','المنافسون','حجم الفرصة']},{title:'القيمة',children:['المشكلة','الحل','التميّز']},{title:'التنفيذ',children:['الفريق','التكاليف','الإيرادات']}] },
  { id:'marketing',title:'خطة تسويق',category:'التسويق',description:'اربط الجمهور والرسالة والقنوات والقياس.',branches:[{title:'الجمهور',children:['الشريحة','الاحتياج','رحلة العميل']},{title:'الرسالة',children:['القيمة','النبرة','الدعوة للعمل']},{title:'القنوات',children:['المحتوى','الإعلانات','مؤشرات الأداء']}] },
  { id:'software',title:'تخطيط ميزة برمجية',category:'البرمجة',description:'حوّل الفكرة إلى متطلبات وخطوات إطلاق.',branches:[{title:'المستخدم',children:['المشكلة','السيناريو','معايير القبول']},{title:'التصميم التقني',children:['الواجهة','البيانات','التكاملات']},{title:'التسليم',children:['المهام','الاختبارات','الإطلاق']}] },
  { id:'project',title:'خطة إدارة مشروع',category:'إدارة المشاريع',description:'حدّد النطاق والجدول والمخاطر والتسليم.',branches:[{title:'النطاق',children:['الهدف','المخرجات','خارج النطاق']},{title:'الجدول',children:['المراحل','المواعيد','المسؤوليات']},{title:'المخاطر',children:['الاحتمال','الأثر','خطة المعالجة']}] },
  { id:'personal',title:'تخطيط الأهداف الشخصية',category:'التخطيط الشخصي',description:'حوّل هدفك إلى عادات وخطوات قابلة للقياس.',branches:[{title:'الهدف',children:['لماذا؟','الموعد','مقياس النجاح']},{title:'العادات',children:['يومي','أسبوعي','متابعة التقدم']},{title:'العوائق',children:['المحفزات','الحلول','الدعم']}] },
  { id:'medical',title:'تثقيف صحي للمريض',category:'الطب',description:'قالب تعليمي عام لتنظيم معلومات صحية راجعها مختص.',branches:[{title:'الحالة',children:['التعريف','الأعراض العامة','متى أطلب المساعدة']},{title:'الرعاية',children:['توجيهات المختص','المتابعة','الأدوية الموصوفة']},{title:'المصادر',children:['الطبيب','المصدر الرسمي','أسئلة للزيارة']}] },
  { id:'engineering',title:'تصميم نظام هندسي',category:'الهندسة',description:'رتّب المتطلبات والمكوّنات والتحقق.',branches:[{title:'المتطلبات',children:['الأداء','السلامة','القيود']},{title:'المكوّنات',children:['المدخلات','المعالجة','المخرجات']},{title:'التحقق',children:['النموذج الأولي','الاختبارات','التحسين']}] },
  { id:'science',title:'خريطة بحث علمي',category:'العلوم',description:'نظّم سؤال البحث والمنهج والنتائج والمراجع.',branches:[{title:'السؤال',children:['الخلفية','الفرضية','الأهداف']},{title:'المنهج',children:['العينة','الأدوات','التحليل']},{title:'المخرجات',children:['النتائج','القيود','المراجع']}] },
  { id:'history',title:'تحليل حدث تاريخي',category:'التاريخ',description:'استكشف السياق والأسباب والأطراف والنتائج.',branches:[{title:'السياق',children:['الزمن','المكان','الأوضاع السابقة']},{title:'الحدث',children:['الأسباب','الأطراف','التسلسل']},{title:'الأثر',children:['النتائج المباشرة','التغيرات','وجهات النظر']}] },
  { id:'brainstorm',title:'جلسة عصف ذهني',category:'العصف الذهني',description:'اجمع الأفكار ثم قيّمها واختر الخطوات التالية.',branches:[{title:'التحدي',children:['السياق','الهدف','القيود']},{title:'الأفكار',children:['حلول سريعة','حلول جريئة','فرص جديدة']},{title:'الاختيار',children:['الأثر','الجهد','التجربة الأولى']}] },
  { id:'organization',title:'هيكل فريق',category:'التنظيم',description:'وضّح المسؤوليات والتواصل ونقاط التسليم.',branches:[{title:'الأدوار',children:['المسؤوليات','الصلاحيات','المهارات']},{title:'العمليات',children:['الاجتماعات','الموافقات','التسليم']},{title:'التواصل',children:['القنوات','التصعيد','التوثيق']}] },
];
const categories = ['الكل',...Array.from(new Set(templates.map((item)=>item.category)))];
const FAVORITES_KEY='ibra-mind-template-favorites-v1';

function asMap(template:TemplateDef):GeneratedMap{
  const nodes:GeneratedMap['nodes']=[{id:'root',type:'mind',position:{x:0,y:0},data:{label:template.title}}];
  const edges:GeneratedMap['edges']=[];
  template.branches.forEach((branch,index)=>{
    const branchId=`branch-${index+1}`;const side=index%2===0?1:-1;
    nodes.push({id:branchId,type:'mind',position:{x:side*300,y:(index-1)*170},data:{label:branch.title}});
    edges.push({id:`edge-${branchId}`,source:'root',target:branchId,type:'smoothstep'});
    branch.children.forEach((label,childIndex)=>{
      const id=`${branchId}-${childIndex+1}`;
      nodes.push({id,type:'mind',position:{x:side*560,y:(index-1)*170+(childIndex-1)*90},data:{label}});
      edges.push({id:`edge-${id}`,source:branchId,target:id,type:'smoothstep'});
    });
  });
  return{title:template.title,nodes,edges};
}

export default function TemplateLibrary({onClose,onSelect}:{onClose:()=>void;onSelect:(map:GeneratedMap)=>void}){
  const [category,setCategory]=useState('الكل');const [query,setQuery]=useState('');const [favorites,setFavorites]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]')}catch{return[]}});
  const visible=useMemo(()=>templates.filter((item)=>(category==='الكل'||item.category===category)&&(!query.trim()||`${item.title} ${item.description} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase()))),[category,query]);
  const toggleFavorite=(id:string)=>setFavorites((current)=>{const next=current.includes(id)?current.filter((value)=>value!==id):[...current,id];localStorage.setItem(FAVORITES_KEY,JSON.stringify(next));return next;});
  return <div className="dialog-backdrop template-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose()}}><section className="template-dialog" role="dialog" aria-modal="true" aria-labelledby="templates-title"><header><div><span className="dialog-symbol"><BookOpen size={22}/></span><h2 id="templates-title">مكتبة القوالب</h2><p>اختر قالباً ليصبح ملف خريطة ذهنية محلياً قابلاً للتعديل.</p></div><button className="dialog-close" aria-label="إغلاق" onClick={onClose}><X size={18}/></button></header><label className="template-search"><Search size={16}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="ابحث عن قالب"/></label><nav className="template-categories" aria-label="تصنيفات القوالب">{categories.map((item)=><button key={item} className={category===item?'selected':''} onClick={()=>setCategory(item)}>{item}</button>)}</nav><div className="template-grid">{visible.map((item,index)=><article className={`template-card template-tone-${index%4}`} key={item.id}><div className="template-card-preview"><span>{item.category}</span><div className="template-mini-map"><b>{item.title}</b>{item.branches.map((branch)=><i key={branch.title}>{branch.title}</i>)}</div><button aria-label={favorites.includes(item.id)?'إزالة من القوالب المفضلة':'أضف إلى القوالب المفضلة'} onClick={()=>toggleFavorite(item.id)}><Heart size={16} fill={favorites.includes(item.id)?'currentColor':'none'}/></button></div><div className="template-card-body"><h3>{item.title}</h3><p>{item.description}</p><button onClick={()=>onSelect(asMap(item))}>استخدم القالب</button></div></article>)}</div>{!visible.length&&<div className="empty-hint"><span>✧</span><div><b>لا توجد قوالب بهذا البحث</b><p>غيّر كلمة البحث أو اختر تصنيفاً آخر.</p></div></div>}</section></div>;
}
