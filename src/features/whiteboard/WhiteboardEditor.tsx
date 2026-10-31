import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addEdge, Background, Controls, Handle, MiniMap, NodeResizer, Position, ReactFlow,
  useEdgesState, useNodesState, type Connection, type Edge, type Node, type NodeProps,
} from '@xyflow/react';
import { ArrowRight, Circle, Copy, Download, FileImage, Home, Layers3, Lock, Plus, Save, Square, StickyNote, Trash2, Type, Unlock, Ungroup } from 'lucide-react';
import { touchProject } from '../projects/projectStore';
import { loadDocument, saveDocument } from '../storage/documentStore';

type BoardKind = 'text' | 'sticky' | 'rectangle' | 'circle' | 'diamond' | 'image' | 'group';
type BoardData = { text: string; kind: BoardKind; locked?: boolean; image?: string; onChange: (id: string, text: string) => void };
type BoardNode = Node<BoardData, 'board'>;
type BoardDocument = { nodes: BoardNode[]; edges: Edge[] };

function BoardItem({ id, data, selected }: NodeProps<BoardNode>) {
  return <div className={`board-item board-${data.kind} ${selected ? 'selected' : ''} ${data.locked ? 'locked' : ''}`}>
    {selected && !data.locked && <NodeResizer minWidth={90} minHeight={56} color="#7966ee"/>}
    {data.kind !== 'group' && <><Handle type="target" position={Position.Top}/><Handle type="source" position={Position.Bottom}/></>}
    {data.kind === 'image' && data.image ? <img src={data.image} alt={data.text || 'صورة على اللوحة'}/> : null}
    <textarea aria-label={`محتوى العنصر: ${data.text || data.kind}`} value={data.text} onChange={(event) => data.onChange(id, event.target.value)} rows={data.kind === 'text' ? 3 : 2} />
  </div>;
}

function decodeBoard(saved: string | null): BoardDocument {
  try {
    const data = saved ? JSON.parse(saved) as BoardDocument : null;
    if (data && Array.isArray(data.nodes) && Array.isArray(data.edges)) return data;
  } catch { /* Start a fresh board when the saved document is unreadable. */ }
  return { nodes: [], edges: [] };
}

export default function WhiteboardEditor({ projectId, title, onHome }: { projectId: string; title: string; onHome: () => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState('');
  const [notice, setNotice] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);
  const updateText = useCallback((id: string, text: string) => setNodes((current) => current.map((node) => node.id === id ? { ...node, data: { ...node.data, text } } : node)), [setNodes]);
  const withCallbacks = useCallback((items: BoardNode[]) => items.map((node) => ({ ...node, data: { ...node.data, onChange: updateText } })), [updateText]);
  const nodeTypes = useMemo(() => ({ board: BoardItem }), []);

  useEffect(() => {
    let active = true;
    setNodes([]);
    setEdges([]);
    void loadDocument(projectId).then((saved) => {
      if (!active) return;
      const board = decodeBoard(saved);
      setNodes(withCallbacks(board.nodes));
      setEdges(board.edges);
    }).catch(() => {
      if (!active) return;
      setNodes([]);
      setEdges([]);
      setNotice('تعذر فتح مخزن الملفات المحلي. حاول إعادة فتح الملف.');
    });
    return () => { active = false; };
  }, [projectId, setNodes, setEdges, withCallbacks]);
  useEffect(() => {
    if (!nodes.length && !edges.length) return;
    const timer = window.setTimeout(() => {
      const serialized = JSON.stringify({ nodes: nodes.map(({ data, ...node }) => ({ ...node, data: { text: data.text, kind: data.kind, locked: data.locked, image: data.image } })), edges });
      void saveDocument(projectId, serialized).then(() => {
        touchProject(projectId);
        setSavedAt(new Intl.DateTimeFormat('ar-IQ', { hour: '2-digit', minute: '2-digit' }).format(new Date()));
      }).catch(() => setNotice('تعذر حفظ اللوحة في قاعدة البيانات المحلية. صدّر نسخة JSON قبل إغلاق التطبيق.'));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [nodes, edges, projectId]);

  const addItem = (kind: BoardKind, image?: string) => {
    const id = `item-${crypto.randomUUID()}`;
    const selected = nodes.find((node) => selectedIds.includes(node.id));
    const index = nodes.length;
    const node: BoardNode = {
      id, type: 'board', position: selected ? { x: selected.position.x + 100, y: selected.position.y + 100 } : { x: 100 + (index % 4) * 240, y: 80 + Math.floor(index / 4) * 180 },
      style: kind === 'circle' || kind === 'diamond' ? { width: 150, height: 125 } : { width: kind === 'sticky' ? 190 : 220, height: kind === 'text' ? 100 : 130 },
      data: { text: kind === 'image' ? 'صورة' : kind === 'text' ? 'اكتب فكرتك هنا' : '', kind, image, onChange: updateText },
    };
    setNodes(withCallbacks([...nodes, node]));
    setSelectedIds([id]);
  };
  const connect = (connection: Connection) => setEdges((current) => addEdge({ ...connection, type: 'smoothstep' }, current));
  const removeSelected = () => {
    if (!selectedIds.length) return;
    const removed = new Set(selectedIds);
    nodes.filter((node) => selectedIds.includes(node.id) && node.data.kind === 'group').forEach((group) => nodes.filter((node) => node.parentId === group.id).forEach((child) => removed.add(child.id)));
    setNodes((current) => current.filter((node) => !removed.has(node.id)));
    setEdges((current) => current.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)));
    setSelectedIds([]);
  };
  const duplicate = () => {
    const selected = nodes.filter((node) => selectedIds.includes(node.id));
    if (!selected.length) return;
    const ids = new Map(selected.map((node) => [node.id, `item-${crypto.randomUUID()}`]));
    const copies = selected.map((node) => ({ ...node, id: ids.get(node.id)!, position: { x: node.position.x + 36, y: node.position.y + 36 } }));
    const copiedEdges = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).map((edge) => ({ ...edge, id: `edge-${crypto.randomUUID()}`, source: ids.get(edge.source)!, target: ids.get(edge.target)! }));
    setNodes(withCallbacks([...nodes, ...copies]));
    setEdges([...edges, ...copiedEdges]);
    setSelectedIds(copies.map((node) => node.id));
  };
  const toggleLock = () => {
    if (!selectedIds.length) return;
    setNodes((current) => current.map((node) => selectedIds.includes(node.id) ? { ...node, draggable: Boolean(node.data.locked), data: { ...node.data, locked: !node.data.locked } } : node));
  };
  const moveLayer = (front: boolean) => {
    if (!selectedIds.length) return;
    const selected = new Set(selectedIds);
    setNodes((current) => current.map((node, index) => ({ ...node, zIndex: selected.has(node.id) ? (front ? current.length + index : -current.length - index) : node.zIndex })));
  };
  const groupSelected = () => {
    const selected = nodes.filter((node) => selectedIds.includes(node.id) && node.data.kind !== 'group');
    if (selected.length < 2) return;
    const left = Math.min(...selected.map((node) => node.position.x));
    const top = Math.min(...selected.map((node) => node.position.y));
    const right = Math.max(...selected.map((node) => node.position.x + (Number(node.style?.width) || 180)));
    const bottom = Math.max(...selected.map((node) => node.position.y + (Number(node.style?.height) || 90)));
    const id = `group-${crypto.randomUUID()}`;
    const group: BoardNode = { id, type: 'board', position: { x: left - 24, y: top - 42 }, style: { width: right - left + 48, height: bottom - top + 66 }, zIndex: -1, data: { kind: 'group', text: 'مجموعة جديدة', onChange: updateText } };
    const children = selected.map((node) => ({ ...node, parentId: id, extent: 'parent' as const, position: { x: node.position.x - left + 24, y: node.position.y - top + 42 } }));
    const next = [...nodes.filter((node) => !selectedIds.includes(node.id)), group, ...children];
    setNodes(withCallbacks(next));
    setSelectedIds([id]);
  };
  const ungroupSelected = () => {
    const groups = nodes.filter((node) => selectedIds.includes(node.id) && node.data.kind === 'group');
    if (!groups.length) return;
    const groupIds = new Set(groups.map((group) => group.id));
    const groupById = new Map(groups.map((group) => [group.id, group]));
    const children = nodes.filter((node) => node.parentId && groupIds.has(node.parentId));
    const next = nodes.filter((node) => !groupIds.has(node.id)).map((node) => {
      const parent = node.parentId ? groupById.get(node.parentId) : undefined;
      if (!parent) return node;
      const { parentId: _parentId, extent: _extent, ...rest } = node;
      return { ...rest, position: { x: parent.position.x + node.position.x, y: parent.position.y + node.position.y } };
    });
    setNodes(withCallbacks(next));
    setSelectedIds(children.map((node) => node.id));
  };
  const uploadImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) { setNotice('حجم الصورة يجب ألا يتجاوز 2 ميغابايت حتى تُحفظ اللوحة محلياً.'); return; }
    const reader = new FileReader();
    reader.onload = () => addItem('image', String(reader.result));
    reader.readAsDataURL(file);
  };
  const exportBoard = () => {
    const blob = new Blob([JSON.stringify({ version: 1, kind: 'whiteboard', title, nodes: nodes.map(({ data, ...node }) => ({ ...node, data: { text: data.text, kind: data.kind, locked: data.locked, image: data.image } })), edges }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[\\/:*?"<>|]/g, '_')}.whiteboard.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <main className="editor-shell whiteboard-shell">
    <header className="editor-topbar"><button className="editor-brand" onClick={onHome}><span className="brand-mark"><ArrowRight size={18}/></span><span>IBRA <b>MIND</b></span></button><div className="editor-title"><small>اللوحة البيضاء</small><b>{title}</b></div><div className="editor-save"><Save size={15}/>{savedAt ? `حُفظ تلقائياً · ${savedAt}` : 'حفظ تلقائي مفعّل'}</div><button className="editor-button subtle" onClick={exportBoard}><Download size={15}/> تصدير JSON</button><button className="editor-button subtle" onClick={onHome}><Home size={15}/> الرئيسية</button></header>
    <div className="board-toolbar"><button className="editor-button" onClick={() => addItem('text')}><Type size={14}/> نص</button><button className="editor-button" onClick={() => addItem('sticky')}><StickyNote size={14}/> ملاحظة</button><button className="editor-button" onClick={() => addItem('rectangle')}><Square size={14}/> مستطيل</button><button className="editor-button" onClick={() => addItem('circle')}><Circle size={14}/> دائرة</button><button className="editor-button" onClick={() => addItem('diamond')}><Plus size={14}/> معين</button><button className="editor-button" onClick={() => imageInput.current?.click()}><FileImage size={14}/> صورة</button><input ref={imageInput} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="اختيار صورة للوحة" onChange={(event) => { uploadImage(event.target.files?.[0]); event.currentTarget.value = ''; }}/><span className="toolbar-divider"/><button className="editor-button" onClick={duplicate} disabled={!selectedIds.length}><Copy size={14}/> تكرار</button><button className="editor-button" onClick={groupSelected} disabled={selectedIds.filter((id) => nodes.some((node) => node.id === id && node.data.kind !== 'group')).length < 2}><Layers3 size={14}/> تجميع</button><button className="editor-button" onClick={ungroupSelected} disabled={!nodes.some((node) => selectedIds.includes(node.id) && node.data.kind === 'group')}><Ungroup size={14}/> فك التجميع</button><button className="editor-button" onClick={toggleLock} disabled={!selectedIds.length}>{nodes.some((node) => selectedIds.includes(node.id) && node.data.locked) ? <Unlock size={14}/> : <Lock size={14}/>} قفل / فتح</button><button className="editor-button" onClick={() => moveLayer(true)} disabled={!selectedIds.length}><Layers3 size={14}/> للأمام</button><button className="editor-button" onClick={() => moveLayer(false)} disabled={!selectedIds.length}><Layers3 size={14}/> للخلف</button><button className="editor-button" onClick={removeSelected} disabled={!selectedIds.length}><Trash2 size={14}/> حذف</button></div>
    <section className="canvas-wrap" aria-label="اللوحة البيضاء التفاعلية"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={connect} onSelectionChange={({ nodes: selected }) => setSelectedIds(selected.map((node) => node.id))} fitView minZoom={0.2} maxZoom={2.2} selectionOnDrag elementsSelectable multiSelectionKeyCode="Shift" proOptions={{ hideAttribution: true }}><Background color="#e1e5ee" gap={28} size={1}/><Controls position="bottom-left"/><MiniMap position="bottom-right" zoomable pannable nodeColor={(node) => ({ sticky: '#f6d978', text: '#7a6ae8', circle: '#73b9e4', diamond: '#eab35e', rectangle: '#9a8bea', image: '#74bd98' } as Record<string,string>)[String(node.data.kind)] ?? '#9a8bea'}/></ReactFlow></section>
    <footer className="editor-footer"><span>{nodes.length} عنصر · {edges.length} اتصال</span><span>اسحب العناصر، واربطها من نقاط الاتصال. اضغط Shift للتحديد المتعدد.</span></footer>
    {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice('')}>حسناً</button></div>}
  </main>;
}
