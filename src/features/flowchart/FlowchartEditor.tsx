import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addEdge, Background, Controls, Handle, MiniMap, Position, ReactFlow, useEdgesState, useNodesState,
  type Connection, type Edge, type Node, type NodeProps,
} from '@xyflow/react';
import { ArrowRight, Circle, Diamond, Download, FileText, Home, Layers3, Plus, Save, Sparkles, LoaderCircle, Trash2, X, AlertCircle } from 'lucide-react';
import { touchProject } from '../projects/projectStore';
import { loadDocument, saveDocument } from '../storage/documentStore';

type Shape = 'start' | 'end' | 'process' | 'decision' | 'input' | 'output' | 'database' | 'document' | 'connector';
type FlowData = { label: string; shape: Shape; onChange: (id: string, value: string) => void };
type FlowNode = Node<FlowData, 'flow'>;
type Diagram = { nodes: FlowNode[]; edges: Edge[] };
const labels: Record<Shape, string> = {
  start: 'بداية', end: 'نهاية', process: 'عملية', decision: 'قرار؟', input: 'إدخال بيانات',
  output: 'إخراج نتيجة', database: 'قاعدة بيانات', document: 'مستند', connector: 'اتصال',
};
const shapes: { id: Shape; title: string; icon: typeof Circle }[] = [
  { id: 'start', title: 'بداية', icon: Circle }, { id: 'process', title: 'عملية', icon: Layers3 },
  { id: 'decision', title: 'قرار', icon: Diamond }, { id: 'input', title: 'إدخال', icon: FileText },
  { id: 'output', title: 'إخراج', icon: ArrowRight }, { id: 'database', title: 'بيانات', icon: Layers3 },
  { id: 'document', title: 'مستند', icon: FileText }, { id: 'connector', title: 'موصل', icon: Circle },
  { id: 'end', title: 'نهاية', icon: Circle },
];

function DiagramNode({ id, data, selected }: NodeProps<FlowNode>) {
  return <div className={`flow-node flow-${data.shape} ${selected ? 'selected' : ''}`}>
    <Handle type="target" position={Position.Top}/>
    <div className="flow-node-body">
      <input aria-label={`نص الشكل: ${data.label}`} value={data.label} onChange={(event) => data.onChange(id, event.target.value)} />
    </div>
    <Handle type="source" position={Position.Bottom}/>
  </div>;
}

function initialDiagram(): Diagram {
  const seed: [string, Shape, number, number][] = [
    ['start', 'start', 0, 0], ['process', 'process', 0, 155], ['decision', 'decision', 0, 310],
    ['output', 'output', 250, 465], ['end', 'end', 0, 620],
  ];
  return {
    nodes: seed.map(([id, shape, x, y]) => ({ id, type: 'flow' as const, position: { x, y }, data: { label: labels[shape], shape, onChange: () => undefined } })),
    edges: [
      { id: 'start-process', source: 'start', target: 'process', type: 'smoothstep' },
      { id: 'process-decision', source: 'process', target: 'decision', type: 'smoothstep' },
      { id: 'decision-output', source: 'decision', target: 'output', label: 'نعم', type: 'smoothstep' },
      { id: 'output-end', source: 'output', target: 'end', type: 'smoothstep' },
      { id: 'decision-end', source: 'decision', target: 'end', label: 'لا', type: 'smoothstep' },
    ],
  };
}

function decodeDiagram(saved: string | null): Diagram {
  try {
    if (!saved) return initialDiagram();
    const value = JSON.parse(saved) as Diagram;
    if (Array.isArray(value.nodes) && value.nodes.length && Array.isArray(value.edges)) return value;
  } catch { /* Use a valid starter diagram when saved data cannot be read. */ }
  return initialDiagram();
}

export default function FlowchartEditor({ projectId, title, onHome }: { projectId: string; title: string; onHome: () => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiNotice, setAiNotice] = useState('');
  const updateLabel = useCallback((id: string, label: string) => setNodes((current) => current.map((node) => node.id === id ? { ...node, data: { ...node.data, label } } : node)), [setNodes]);
  const withCallbacks = useCallback((items: FlowNode[]) => items.map((node) => ({ ...node, data: { ...node.data, onChange: updateLabel } })), [updateLabel]);
  const nodeTypes = useMemo(() => ({ flow: DiagramNode }), []);

  useEffect(() => {
    let active = true;
    setNodes([]);
    setEdges([]);
    void loadDocument(projectId).then((saved) => {
      if (!active) return;
      const diagram = decodeDiagram(saved);
      setNodes(withCallbacks(diagram.nodes));
      setEdges(diagram.edges);
    }).catch(() => {
      if (!active) return;
      setNodes(withCallbacks(initialDiagram().nodes));
      setEdges(initialDiagram().edges);
    });
    return () => { active = false; };
  }, [projectId, setNodes, setEdges, withCallbacks]);
  useEffect(() => {
    if (!nodes.length) return;
    const timer = window.setTimeout(() => {
      void saveDocument(projectId, JSON.stringify({ nodes: nodes.map(({ data, ...node }) => ({ ...node, data: { label: data.label, shape: data.shape } })), edges })).then(() => {
        touchProject(projectId);
        setSavedAt(new Intl.DateTimeFormat('ar-IQ', { hour: '2-digit', minute: '2-digit' }).format(new Date()));
      }).catch(() => setSavedAt('تعذر الحفظ'));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [nodes, edges, projectId]);

  const addShape = (shape: Shape) => {
    const id = `shape-${crypto.randomUUID()}`;
    const parent = nodes.find((node) => node.id === selectedId);
    const index = nodes.length;
    const node: FlowNode = { id, type: 'flow', position: parent ? { x: parent.position.x + 220, y: parent.position.y + 80 } : { x: (index % 4) * 220, y: Math.floor(index / 4) * 160 }, data: { label: labels[shape], shape, onChange: updateLabel } };
    setNodes(withCallbacks([...nodes, node]));
    if (parent) setEdges((current) => [...current, { id: `edge-${crypto.randomUUID()}`, source: parent.id, target: id, type: 'smoothstep' }]);
    setSelectedId(id);
  };
  const connect = (connection: Connection) => setEdges((current) => addEdge({ ...connection, type: 'smoothstep', animated: false }, current));
  const removeSelected = () => {
    if (!selectedId) return;
    setNodes((current) => current.filter((node) => node.id !== selectedId));
    setEdges((current) => current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId));
    setSelectedId(null);
  };
  const arrange = () => setNodes((current) => withCallbacks(current.map((node, index) => ({ ...node, position: { x: 0, y: index * 155 } }))));
  const exportDiagram = () => {
    const blob = new Blob([JSON.stringify({ version: 1, kind: 'flowchart', title, nodes: nodes.map(({ data, ...node }) => ({ ...node, data: { label: data.label, shape: data.shape } })), edges }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[\\/:*?"<>|]/g, '_')}.flowchart.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const generateWithAi = async () => {
    if (!aiTopic.trim() || !window.ibraMind?.providers || aiBusy) return;
    setAiBusy(true); setAiError(''); setAiNotice('');
    try {
      const listed = await window.ibraMind.providers.list();
      const enabled = (listed.providers || []).filter((provider) => provider.enabled);
      let routed = '';
      try { routed = JSON.parse(localStorage.getItem('ibra-mind-ai-routing-v1') || '{}').flowchartGeneration || ''; } catch { routed = ''; }
      const provider = enabled.find((item) => item.id === routed) || enabled.find((item) => item.isDefault) || enabled[0];
      if (!provider) throw new Error('أضف مزوداً مفعّلاً من إعدادات الذكاء الاصطناعي أولاً.');
      const response = await window.ibraMind.providers.complete({
        providerId: provider.id, maxTokens: Math.min(provider.maxTokens, 5000), temperature: provider.temperature,
        messages: [
          { role: 'system', content: 'حوّل وصف المستخدم إلى مخطط انسيابي عملي. أجب JSON فقط بالشكل {"nodes":[{"id":"n1","label":"بداية","shape":"start"},{"id":"n2","label":"خطوة","shape":"process"},{"id":"n3","label":"نهاية","shape":"end"}],"edges":[{"source":"n1","target":"n2","label":""},{"source":"n2","target":"n3","label":""}]}. الأشكال المسموحة: start,end,process,decision,input,output,database,document,connector. استخدم معرفات فريدة، وحافظ على التفرعات الشرطية بوسم نعم أو لا. أنشئ من 3 إلى 30 شكلاً ولا تضف Markdown.' },
          { role: 'user', content: `أنشئ مخططاً انسيابياً لهذا الوصف:\n${aiTopic.trim().slice(0, 2500)}` },
        ],
      });
      if (!response.ok || !response.text) throw new Error(response.error || 'تعذر إنشاء المخطط.');
      const parsed = JSON.parse(response.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as { nodes?: unknown; edges?: unknown };
      const allowed: Shape[] = ['start','end','process','decision','input','output','database','document','connector'];
      if (!Array.isArray(parsed.nodes) || parsed.nodes.length < 2 || parsed.nodes.length > 40 || !Array.isArray(parsed.edges) || parsed.edges.length < 1 || parsed.edges.length > 100) throw new Error('نتيجة النموذج لا تطابق مخطط البيانات المطلوب.');
      const sourceNodes = parsed.nodes as { id?: unknown; label?: unknown; shape?: unknown }[];
      const ids = new Set<string>();
      for (const item of sourceNodes) {
        if (typeof item?.id !== 'string' || !item.id.trim() || ids.has(item.id) || typeof item.label !== 'string' || !item.label.trim() || typeof item.shape !== 'string' || !allowed.includes(item.shape as Shape)) throw new Error('تحتوي النتيجة على شكل أو معرف غير صالح؛ لم يتغير المخطط.');
        ids.add(item.id);
      }
      const sourceEdges = (parsed.edges as { source?: unknown; target?: unknown; label?: unknown }[]).map((edge) => {
        if (typeof edge?.source !== 'string' || typeof edge.target !== 'string' || !ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target) throw new Error('تحتوي النتيجة على اتصال غير صالح؛ لم يتغير المخطط.');
        return { source: edge.source, target: edge.target, label: typeof edge.label === 'string' ? edge.label.slice(0, 80) : '' };
      });
      const baseY = nodes.length ? Math.max(...nodes.map((node) => node.position.y)) + 260 : 0;
      const root = sourceNodes.find((node) => node.shape === 'start')?.id as string | undefined || String(sourceNodes[0].id);
      const depth = new Map<string, number>([[root, 0]]);
      const queue = [root];
      while (queue.length) {
        const parent = queue.shift()!;
        for (const edge of sourceEdges) if (edge.source === parent && !depth.has(edge.target)) { depth.set(edge.target, depth.get(parent)! + 1); queue.push(edge.target); }
      }
      for (const node of sourceNodes) if (!depth.has(String(node.id))) depth.set(String(node.id), 0);
      const rows = new Map<number, typeof sourceNodes>();
      for (const node of sourceNodes) { const level = depth.get(String(node.id))!; rows.set(level, [...(rows.get(level) || []), node]); }
      const nextNodes: FlowNode[] = sourceNodes.map((item) => {
        const id = `ai-flow-${crypto.randomUUID()}`;
        const level = depth.get(String(item.id))!; const row = rows.get(level)!; const index = row.indexOf(item);
        return { id, type: 'flow', position: { x: (index - (row.length - 1) / 2) * 250, y: baseY + level * 155 }, data: { label: String(item.label).trim().slice(0, 120), shape: item.shape as Shape, onChange: updateLabel } };
      });
      const generatedIds = new Map(sourceNodes.map((item, index) => [String(item.id), nextNodes[index].id]));
      const nextEdges: Edge[] = sourceEdges.map((edge) => ({ id: `edge-${crypto.randomUUID()}`, source: generatedIds.get(edge.source)!, target: generatedIds.get(edge.target)!, label: edge.label, type: 'smoothstep' }));
      setNodes((current) => withCallbacks([...current, ...nextNodes]));
      setEdges((current) => [...current, ...nextEdges]);
      setAiNotice(`أُضيف ${nextNodes.length} شكلاً و${nextEdges.length} اتصال من ${provider.name}.`);
      setAiOpen(false); setAiTopic('');
    } catch (failure) { setAiError(failure instanceof Error ? failure.message : 'تعذر إنشاء المخطط.'); }
    finally { setAiBusy(false); }
  };

  return <main className="editor-shell flowchart-shell">
    <header className="editor-topbar"><button className="editor-brand" onClick={onHome}><span className="brand-mark"><ArrowRight size={18}/></span><span>IBRA <b>MIND</b></span></button><div className="editor-title"><small>المخطط الانسيابي</small><b>{title}</b></div><div className="editor-save"><Save size={15}/>{savedAt ? `حُفظ تلقائياً · ${savedAt}` : 'حفظ تلقائي مفعّل'}</div><button className="editor-button subtle" onClick={exportDiagram}><Download size={15}/> تصدير JSON</button><button className="editor-button subtle" onClick={onHome}><Home size={15}/> الرئيسية</button></header>
    <div className="flow-shape-bar">{shapes.map(({ id, title: label, icon: Icon }) => <button key={id} className="editor-button" onClick={() => addShape(id)}><Icon size={14}/>{label}</button>)}<span className="toolbar-divider"/><button className="editor-button primary" onClick={()=>{setAiError('');setAiOpen(true)}}><Sparkles size={14}/> إنشاء بالذكاء</button><button className="editor-button" onClick={arrange}><Layers3 size={14}/> ترتيب رأسي</button><button className="editor-button" onClick={removeSelected} disabled={!selectedId}><Trash2 size={14}/> حذف الشكل</button></div>
    <section className="canvas-wrap" aria-label="لوحة المخطط الانسيابي"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={connect} onNodeClick={(_, node) => setSelectedId(node.id)} onPaneClick={() => setSelectedId(null)} fitView fitViewOptions={{ padding: 0.25 }} minZoom={0.2} maxZoom={2.2} proOptions={{ hideAttribution: true }}><Background color="#dbe0ec" gap={24} size={1}/><Controls position="bottom-left"/><MiniMap position="bottom-right" zoomable pannable nodeColor={(node) => ({ start: '#48a980', end: '#d35e72', decision: '#e8ad45', process: '#7b68e8' } as Record<string,string>)[String(node.data.shape)] ?? '#7b68e8'}/></ReactFlow></section>
    <footer className="editor-footer"><span>{nodes.length} شكل · {edges.length} اتصال</span><span>اسحب من نقطة اتصال إلى شكل آخر لإنشاء مسار</span></footer>
    {aiNotice&&<div className="toast" role="status">{aiNotice}<button onClick={()=>setAiNotice('')}>حسناً</button></div>}
    {aiOpen&&<div className="dialog-backdrop ai-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!aiBusy)setAiOpen(false)}}><section className="dialog-card ai-dialog" role="dialog" aria-modal="true" aria-labelledby="flow-ai-title"><button className="dialog-close" aria-label="إغلاق" disabled={aiBusy} onClick={()=>setAiOpen(false)}><X size={18}/></button><div className="dialog-symbol ai-symbol"><Sparkles size={22}/></div><h2 id="flow-ai-title">إنشاء مخطط بالذكاء الاصطناعي</h2><p>اكتب العملية المطلوبة. سيضيف المخطط الجديد إلى مساحة العمل الحالية، ولن يستبدل الأشكال الموجودة.</p><label className="ai-topic-label">وصف العملية<textarea autoFocus maxLength={2500} rows={5} value={aiTopic} onChange={(event)=>setAiTopic(event.target.value)} placeholder="مثال: خطوات تسجيل طالب جديد والتحقق من المستندات ثم إصدار رقم جامعي"/></label>{aiError&&<div className="provider-error" role="alert"><AlertCircle size={16}/>{aiError}</div>}<div className="dialog-actions"><button className="editor-button" onClick={()=>setAiOpen(false)} disabled={aiBusy}>إلغاء</button><button className="editor-button primary" onClick={()=>void generateWithAi()} disabled={!aiTopic.trim()||aiBusy}>{aiBusy?<LoaderCircle size={15} className="spin"/>:<Sparkles size={15}/>} إنشاء مخطط</button></div></section></div>}
  </main>;
}

