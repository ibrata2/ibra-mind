import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addEdge, Background, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState,
  type Connection, type Edge, type Node, type NodeProps,
} from '@xyflow/react';
import { ArrowRight, ChevronRight, CircleHelp, Download, Home, Plus, Redo2, Save, Trash2, Undo2 } from 'lucide-react';

type MindData = { label: string; onLabelChange: (id: string, value: string) => void };
type MindNodeType = Node<MindData, 'mind'>;
type Snapshot = { nodes: MindNodeType[]; edges: Edge[] };
const STORE_KEY = 'ibra-mind-map-v1';

function TopicNode({ id, data, selected }: NodeProps<MindNodeType>) {
  return <div className={`mind-node ${selected ? 'is-selected' : ''}`}>
    <input aria-label="عنوان الفرع" value={data.label} onChange={(event) => data.onLabelChange(id, event.target.value)} />
  </div>;
}

const initialNodes: MindNodeType[] = [
  { id: 'root', type: 'mind', position: { x: 0, y: 0 }, data: { label: 'فكرتي الجديدة', onLabelChange: () => undefined } },
  { id: 'branch-1', type: 'mind', position: { x: -285, y: -120 }, data: { label: 'الموضوع الأول', onLabelChange: () => undefined } },
  { id: 'branch-2', type: 'mind', position: { x: 285, y: 120 }, data: { label: 'الموضوع الثاني', onLabelChange: () => undefined } },
];
const initialEdges: Edge[] = [
  { id: 'root-1', source: 'root', target: 'branch-1', type: 'smoothstep' },
  { id: 'root-2', source: 'root', target: 'branch-2', type: 'smoothstep' },
];

function readSaved(): Snapshot {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { nodes: initialNodes, edges: initialEdges };
    const saved = JSON.parse(raw) as Snapshot;
    return saved.nodes?.length ? saved : { nodes: initialNodes, edges: initialEdges };
  } catch {
    return { nodes: initialNodes, edges: initialEdges };
  }
}

export default function MindMapEditor({ onHome }: { onHome: () => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<MindNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState('');
  const history = useRef<Snapshot[]>([]);
  const historyIndex = useRef(-1);
  const ready = useRef(false);
  const flowRef = useRef<HTMLDivElement>(null);

  const updateLabel = useCallback((id: string, label: string) => {
    setNodes((items) => items.map((node) => node.id === id ? { ...node, data: { ...node.data, label } } : node));
  }, [setNodes]);
  const withCallbacks = useCallback((items: MindNodeType[]) => items.map((node) => ({ ...node, data: { ...node.data, onLabelChange: updateLabel } })), [updateLabel]);
  const nodeTypes = useMemo(() => ({ mind: TopicNode }), []);

  useEffect(() => {
    const snapshot = readSaved();
    setNodes(withCallbacks(snapshot.nodes));
    setEdges(snapshot.edges);
    history.current = [snapshot];
    historyIndex.current = 0;
    ready.current = true;
  }, [setEdges, setNodes, withCallbacks]);

  const checkpoint = useCallback((nextNodes: MindNodeType[], nextEdges: Edge[]) => {
    const clean = { nodes: nextNodes.map((node) => ({ ...node, data: { label: node.data.label, onLabelChange: () => undefined } })), edges: nextEdges };
    history.current = history.current.slice(0, historyIndex.current + 1);
    history.current.push(clean);
    if (history.current.length > 80) history.current.shift();
    historyIndex.current = history.current.length - 1;
  }, []);

  useEffect(() => {
    if (!ready.current || !nodes.length) return;
    const timer = window.setTimeout(() => {
      const serializable = { nodes: nodes.map(({ data, ...node }) => ({ ...node, data: { label: data.label, onLabelChange: undefined } })), edges };
      localStorage.setItem(STORE_KEY, JSON.stringify(serializable));
      setSavedAt(new Intl.DateTimeFormat('ar-IQ', { hour: '2-digit', minute: '2-digit' }).format(new Date()));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [nodes, edges]);

  const addTopic = useCallback(() => {
    const parent = nodes.find((node) => node.id === selectedId) ?? nodes.find((node) => node.id === 'root') ?? nodes[0];
    if (!parent) return;
    const id = `topic-${crypto.randomUUID()}`;
    const siblings = nodes.filter((node) => node.id !== parent.id);
    const sign = siblings.length % 2 ? -1 : 1;
    const child: MindNodeType = { id, type: 'mind', position: { x: parent.position.x + sign * 250, y: parent.position.y + 115 }, data: { label: 'موضوع جديد', onLabelChange: updateLabel } };
    const nextNodes = withCallbacks([...nodes, child]);
    const nextEdges = [...edges, { id: `edge-${id}`, source: parent.id, target: id, type: 'smoothstep' }];
    checkpoint(nextNodes, nextEdges);
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedId(id);
  }, [nodes, selectedId, edges, updateLabel, withCallbacks, checkpoint, setNodes, setEdges]);

  const removeSelected = useCallback(() => {
    if (!selectedId || selectedId === 'root') return;
    const removed = new Set([selectedId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of edges) if (removed.has(edge.source) && !removed.has(edge.target)) { removed.add(edge.target); changed = true; }
    }
    const nextNodes = nodes.filter((node) => !removed.has(node.id));
    const nextEdges = edges.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target));
    checkpoint(nextNodes, nextEdges);
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedId(null);
  }, [selectedId, nodes, edges, checkpoint, setNodes, setEdges]);

  const restoreHistory = useCallback((step: -1 | 1) => {
    const nextIndex = historyIndex.current + step;
    const snapshot = history.current[nextIndex];
    if (!snapshot) return;
    historyIndex.current = nextIndex;
    setNodes(withCallbacks(snapshot.nodes));
    setEdges(snapshot.edges);
  }, [setNodes, setEdges, withCallbacks]);

  const connect = useCallback((connection: Connection) => {
    const nextEdges = addEdge({ ...connection, type: 'smoothstep' }, edges);
    checkpoint(nodes, nextEdges);
    setEdges(nextEdges);
  }, [nodes, edges, checkpoint, setEdges]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'Tab' || event.key === 'Insert') { event.preventDefault(); addTopic(); }
      if (event.key === 'Delete' || event.key === 'Backspace') removeSelected();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); restoreHistory(event.shiftKey ? 1 : -1); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); restoreHistory(1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addTopic, removeSelected, restoreHistory]);

  const exportMap = () => {
    const blob = new Blob([JSON.stringify({ version: 1, title: 'IBRA MIND', nodes: nodes.map(({ data, ...node }) => ({ ...node, data: { label: data.label } })), edges }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ibra-mind-map.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return <main className="editor-shell" ref={flowRef}>
    <header className="editor-topbar"><button className="editor-brand" onClick={onHome}><span className="brand-mark"><ArrowRight size={18}/></span><span>IBRA <b>MIND</b></span></button><div className="editor-title"><small>خريطتي الذهنية</small><b>فكرتي الجديدة</b></div><div className="editor-save"><Save size={15}/>{savedAt ? `حُفظ تلقائياً · ${savedAt}` : 'حفظ تلقائي مفعّل'}</div><button className="editor-button subtle" onClick={exportMap}><Download size={15}/> تصدير JSON</button><button className="editor-button subtle" onClick={onHome}><Home size={15}/> الرئيسية</button></header>
    <div className="editor-toolbar"><button className="editor-button primary" onClick={addTopic}><Plus size={16}/> إضافة فرع <kbd>Tab</kbd></button><button className="editor-button" onClick={removeSelected} disabled={!selectedId || selectedId === 'root'}><Trash2 size={15}/> حذف</button><span className="toolbar-divider"/><button className="editor-icon-button" aria-label="تراجع" onClick={() => restoreHistory(-1)}><Undo2 size={17}/></button><button className="editor-icon-button" aria-label="إعادة" onClick={() => restoreHistory(1)}><Redo2 size={17}/></button><span className="editor-help"><CircleHelp size={15}/> اختر عقدة ثم أضف فرعاً. اسحب العقد لترتيبها.</span></div>
    <section className="canvas-wrap" aria-label="لوحة الخريطة الذهنية"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={connect} onNodeClick={(_, node) => setSelectedId(node.id)} onPaneClick={() => setSelectedId(null)} onNodeDragStop={(_, __, movedNodes) => checkpoint(withCallbacks(movedNodes), edges)} fitView fitViewOptions={{ padding: 0.3 }} minZoom={0.2} maxZoom={2.2} proOptions={{ hideAttribution: true }}><Background color="#343746" gap={24} size={1}/><Controls position="bottom-left"/><MiniMap position="bottom-right" zoomable pannable nodeColor="#8d79ee"/></ReactFlow></section>
    <footer className="editor-footer"><span>{nodes.length} عقدة · {edges.length} اتصال</span><span>Tab إضافة فرع · Delete حذف · Ctrl+Z تراجع</span></footer>
  </main>;
}
