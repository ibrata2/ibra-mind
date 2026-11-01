import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  addEdge, Background, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState,
  MarkerType, type Connection, type Edge, type Node, type NodeProps, type ReactFlowInstance,
} from '@xyflow/react';
import { AlertCircle, ArrowRight, ChevronLeft, ChevronRight, CircleHelp, Copy, Download, Expand, FileText, FileUp, FileDown, FileImage, Home, LayoutGrid, ListTree, Plus, Printer, Redo2, Save, Scissors, Search, Shrink, Sparkles, LoaderCircle, Trash2, Undo2, X } from 'lucide-react';
import { touchProject } from '../projects/projectStore';
import { loadDocument, saveDocument } from '../storage/documentStore';
import { mapFromJson } from '../ai/AIGenerator';

type NodeAiAction = 'summarize' | 'rewrite' | 'translate' | 'explain' | 'brainstorm' | 'questions';

type MindKind = 'branch' | 'rectangle' | 'circle' | 'diamond' | 'sticky' | 'task';
type MindColor = 'violet' | 'blue' | 'mint' | 'amber';
type MindData = { label: string; kind?: MindKind; color?: MindColor; completed?: boolean; onLabelChange: (id: string, value: string) => void; onLabelCommit?: () => void; onMetaChange?: (id: string, patch: Partial<MindData>) => void };
type MindNodeType = Node<MindData, 'mind'>;
type Snapshot = { nodes: MindNodeType[]; edges: Edge[] };
const STORE_KEY = 'ibra-mind-map-v2';

function TopicNode({ id, data, selected }: NodeProps<MindNodeType>) {
  return <div className={`mind-node mind-node-${data.kind || 'branch'} mind-color-${data.color || 'violet'} ${id === 'root' ? 'mind-node-root' : ''} ${selected ? 'is-selected' : ''}`}>
    {data.kind === 'task' && <input className="mind-task-check" aria-label="اكتمال المهمة" type="checkbox" checked={Boolean(data.completed)} onChange={(event)=>data.onMetaChange?.(id,{completed:event.target.checked})}/>}
    <input aria-label={`عنوان العقدة: ${data.label}`} value={data.label} onChange={(event) => data.onLabelChange(id, event.target.value)} onBlur={data.onLabelCommit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
  </div>;
}

const initialNodes: MindNodeType[] = [
  { id: 'root', type: 'mind', position: { x: 0, y: 0 }, data: { label: 'IBRA MIND', onLabelChange: () => undefined } },
  { id: 'vision', type: 'mind', position: { x: -315, y: -170 }, data: { label: 'الرؤية والهدف', onLabelChange: () => undefined } },
  { id: 'features', type: 'mind', position: { x: 315, y: -170 }, data: { label: 'الميزات الأساسية', onLabelChange: () => undefined } },
  { id: 'experience', type: 'mind', position: { x: -315, y: 170 }, data: { label: 'تجربة الاستخدام', onLabelChange: () => undefined } },
  { id: 'roadmap', type: 'mind', position: { x: 315, y: 170 }, data: { label: 'خطة التطوير', onLabelChange: () => undefined } },
  { id: 'vision-1', type: 'mind', position: { x: -585, y: -235 }, data: { label: 'تنظيم الأفكار', onLabelChange: () => undefined } },
  { id: 'vision-2', type: 'mind', position: { x: -585, y: -105 }, data: { label: 'تحويل المعرفة', onLabelChange: () => undefined } },
  { id: 'features-1', type: 'mind', position: { x: 585, y: -235 }, data: { label: 'خرائط ذهنية', onLabelChange: () => undefined } },
  { id: 'features-2', type: 'mind', position: { x: 585, y: -105 }, data: { label: 'لوحة ومخططات', onLabelChange: () => undefined } },
  { id: 'experience-1', type: 'mind', position: { x: -585, y: 105 }, data: { label: 'العربية و RTL', onLabelChange: () => undefined } },
  { id: 'experience-2', type: 'mind', position: { x: -585, y: 235 }, data: { label: 'عمل محلي', onLabelChange: () => undefined } },
  { id: 'roadmap-1', type: 'mind', position: { x: 585, y: 105 }, data: { label: 'الحفظ والتصدير', onLabelChange: () => undefined } },
  { id: 'roadmap-2', type: 'mind', position: { x: 585, y: 235 }, data: { label: 'الذكاء الاصطناعي', onLabelChange: () => undefined } },
];
const initialEdges: Edge[] = [
  { id: 'root-vision', source: 'root', target: 'vision', type: 'smoothstep' },
  { id: 'root-features', source: 'root', target: 'features', type: 'smoothstep' },
  { id: 'root-experience', source: 'root', target: 'experience', type: 'smoothstep' },
  { id: 'root-roadmap', source: 'root', target: 'roadmap', type: 'smoothstep' },
  { id: 'vision-1', source: 'vision', target: 'vision-1', type: 'smoothstep' },
  { id: 'vision-2', source: 'vision', target: 'vision-2', type: 'smoothstep' },
  { id: 'features-1', source: 'features', target: 'features-1', type: 'smoothstep' },
  { id: 'features-2', source: 'features', target: 'features-2', type: 'smoothstep' },
  { id: 'experience-1', source: 'experience', target: 'experience-1', type: 'smoothstep' },
  { id: 'experience-2', source: 'experience', target: 'experience-2', type: 'smoothstep' },
  { id: 'roadmap-1', source: 'roadmap', target: 'roadmap-1', type: 'smoothstep' },
  { id: 'roadmap-2', source: 'roadmap', target: 'roadmap-2', type: 'smoothstep' },
];

function escapeXml(value: string) { return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
function wrapLabel(value: string, maxChars: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of value.split(/\s+/)) {
    if (line && (line.length + word.length + 1) > maxChars) { lines.push(line); line = ''; }
    line += `${line ? ' ' : ''}${word}`;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}
function buildMapSvg(nodes: MindNodeType[], edges: Edge[]) {
  const visibleNodes = nodes.filter((node) => !node.hidden);
  if (!visibleNodes.length) throw new Error('لا توجد عقد مرئية للتصدير.');
  const dimensions = new Map(visibleNodes.map((node) => {
    const lines = wrapLabel(node.data.label || '', 22);
    const longest = Math.max(0, ...lines.map((line) => line.length));
    const width = Math.max(160, Math.min(300, longest * 8.4 + 32));
    const height = Math.max(58, lines.length * 20 + 24);
    return [node.id, { width, height, lines }] as const;
  }));
  const padding = 64;
  const bounds = visibleNodes.reduce((value, node) => ({
    minX: Math.min(value.minX, node.position.x), minY: Math.min(value.minY, node.position.y),
    maxX: Math.max(value.maxX, node.position.x + dimensions.get(node.id)!.width),
    maxY: Math.max(value.maxY, node.position.y + dimensions.get(node.id)!.height),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  const { minX, minY, maxX, maxY } = bounds;
  const width = Math.max(500, Math.ceil(maxX - minX + padding * 2));
  const height = Math.max(300, Math.ceil(maxY - minY + padding * 2));
  const locations = new Map(visibleNodes.map((node) => [node.id, { x: node.position.x - minX + padding, y: node.position.y - minY + padding }]));
  const paths = edges.filter((edge) => !edge.hidden && locations.has(edge.source) && locations.has(edge.target)).map((edge) => {
    const source = locations.get(edge.source)!; const target = locations.get(edge.target)!;
    const sourceSize = dimensions.get(edge.source)!; const targetSize = dimensions.get(edge.target)!;
    const sx = source.x + sourceSize.width / 2; const sy = source.y + sourceSize.height / 2;
    const tx = target.x + targetSize.width / 2; const ty = target.y + targetSize.height / 2;
    let startX=sx,startY=sy,endX=tx,endY=ty,curve='';
    if (Math.abs(tx-sx) >= Math.abs(ty-sy)) {
      const direction=tx>=sx?1:-1; startX+=direction*sourceSize.width/2;endX-=direction*targetSize.width/2;
      const mid=(startX+endX)/2;curve=`M ${startX} ${startY} C ${mid} ${startY}, ${mid} ${endY}, ${endX} ${endY}`;
    } else {
      const direction=ty>=sy?1:-1; startY+=direction*sourceSize.height/2;endY-=direction*targetSize.height/2;
      const mid=(startY+endY)/2;curve=`M ${startX} ${startY} C ${startX} ${mid}, ${endX} ${mid}, ${endX} ${endY}`;
    }
    return `<path d="${curve}" fill="none" stroke="#8a7be0" stroke-width="2.5" marker-end="url(#arrow)"/>`;
  }).join('');
  const colors: Record<string,{fill:string;stroke:string;text:string}> = { violet:{fill:'#f1edff',stroke:'#8975df',text:'#30285a'}, blue:{fill:'#e9f4ff',stroke:'#5799cc',text:'#1c3d59'}, mint:{fill:'#e9f8f1',stroke:'#55a184',text:'#24483a'}, amber:{fill:'#fff5df',stroke:'#ca9c3e',text:'#4f3c17'} };
  const shapes=visibleNodes.map((node)=>{
    const position=locations.get(node.id)!;const size=dimensions.get(node.id)!;
    const color=colors[node.data.color||'violet']||colors.violet;
    const selectedColor=node.id==='root'?{...color,fill:'#e9e4ff',stroke:'#725ad0'}:color;
    let shape='';
    if(node.data.kind==='circle')shape=`<ellipse cx="${position.x+size.width/2}" cy="${position.y+size.height/2}" rx="${size.width/2}" ry="${size.height/2}" fill="${selectedColor.fill}" stroke="${selectedColor.stroke}" stroke-width="2"/>`;
    else if(node.data.kind==='diamond'){const cx=position.x+size.width/2,cy=position.y+size.height/2;shape=`<polygon points="${cx},${position.y} ${position.x+size.width},${cy} ${cx},${position.y+size.height} ${position.x},${cy}" fill="${selectedColor.fill}" stroke="${selectedColor.stroke}" stroke-width="2"/>`;}
    else {const radius=node.data.kind==='sticky'?3:node.data.kind==='rectangle'?4:14;shape=`<rect x="${position.x}" y="${position.y}" width="${size.width}" height="${size.height}" rx="${radius}" fill="${node.data.kind==='sticky'?'#fff0c4':selectedColor.fill}" stroke="${node.data.kind==='sticky'?'#d1a642':selectedColor.stroke}" stroke-width="2"/>`;}
    const extra=node.data.kind==='task'?18:0;const startY=position.y+size.height/2-(size.lines.length-1)*10;
    const text=size.lines.map((line,index)=>`<tspan x="${position.x+size.width/2+extra/2}" y="${startY+index*20}">${escapeXml(line)}</tspan>`).join('');
    const check=node.data.kind==='task'?`<rect x="${position.x+12}" y="${position.y+size.height/2-7}" width="14" height="14" rx="3" fill="${node.data.completed?'#44a77c':'#fff'}" stroke="#5d9b80"/>${node.data.completed?`<path d="M ${position.x+15} ${position.y+size.height/2} l 3 3 l 6 -7" fill="none" stroke="#fff" stroke-width="2"/>`:''}`:'';
    return `${shape}${check}<text fill="${selectedColor.text}" font-family="Tahoma, Arial, sans-serif" font-size="14" font-weight="500" text-anchor="middle" direction="rtl" unicode-bidi="plaintext">${text}</text>`;
  }).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#8a7be0"/></marker></defs><rect width="100%" height="100%" fill="#ffffff"/>${paths}${shapes}</svg>`;
  return { svg, width, height };
}

function decodeSaved(raw: string | null): Snapshot {
  try {
    if (!raw) return { nodes: initialNodes, edges: initialEdges };
    const saved = JSON.parse(raw) as Snapshot;
    return saved.nodes?.length ? saved : { nodes: initialNodes, edges: initialEdges };
  } catch {
    return { nodes: initialNodes, edges: initialEdges };
  }
}

export default function MindMapEditor({ projectId, title, onHome }: { projectId: string; title: string; onHome: () => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<MindNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [nodeSearch, setNodeSearch] = useState('');
  const [searchIndex, setSearchIndex] = useState(-1);
  const [savedAt, setSavedAt] = useState('');
  const [clipboardReady, setClipboardReady] = useState(false);
  const [outlineMode, setOutlineMode] = useState(false);
  const [notice, setNotice] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantAction, setAssistantAction] = useState<NodeAiAction>('summarize');
  const [assistantLanguage, setAssistantLanguage] = useState('العربية');
  const [assistantResult, setAssistantResult] = useState('');
  const [assistantError, setAssistantError] = useState('');
  const history = useRef<Snapshot[]>([]);
  const historyIndex = useRef(-1);
  const ready = useRef(false);
  const flowRef = useRef<HTMLDivElement>(null);
  const flowInstance = useRef<ReactFlowInstance<MindNodeType, Edge> | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const clipboard = useRef<Snapshot | null>(null);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const checkpoint = useCallback((nextNodes: MindNodeType[], nextEdges: Edge[]) => {
    const clean = { nodes: nextNodes.map((node) => ({ ...node, data: { label: node.data.label, kind: node.data.kind, color: node.data.color, completed: node.data.completed, onLabelChange: () => undefined } })), edges: nextEdges };
    history.current = history.current.slice(0, historyIndex.current + 1);
    history.current.push(clean);
    if (history.current.length > 80) history.current.shift();
    historyIndex.current = history.current.length - 1;
  }, []);

  const updateLabel = useCallback((id: string, label: string) => {
    setNodes((items) => items.map((node) => node.id === id ? { ...node, data: { ...node.data, label } } : node));
  }, [setNodes]);
  const updateMeta = useCallback((id: string, patch: Partial<MindData>) => {
    const nextNodes = nodesRef.current.map((node) => node.id === id ? { ...node, data: { ...node.data, ...patch } } : node);
    checkpoint(nextNodes, edgesRef.current);
    setNodes(nextNodes);
  }, [checkpoint, setNodes]);
  const withCallbacks = useCallback((items: MindNodeType[]) => items.map((node) => ({ ...node, data: { ...node.data, onLabelChange: updateLabel, onMetaChange: updateMeta, onLabelCommit: () => checkpoint(nodesRef.current, edgesRef.current) } })), [updateLabel, updateMeta, checkpoint]);
  const nodeTypes = useMemo(() => ({ mind: TopicNode }), []);
  const searchMatches = useMemo(() => {
    const query = nodeSearch.trim().toLocaleLowerCase();
    return query ? nodes.filter((node) => node.data.label.toLocaleLowerCase().includes(query)) : [];
  }, [nodeSearch, nodes]);

  const searchNode = useCallback((direction: -1 | 1) => {
    if (!searchMatches.length) {
      if (nodeSearch.trim()) setNotice('ما لكيت عقدة تطابق البحث.');
      return;
    }
    const nextIndex = (searchIndex + direction + searchMatches.length) % searchMatches.length;
    const target = searchMatches[nextIndex];
    setSearchIndex(nextIndex);
    setSelectedId(target.id);
    setSelectedEdgeId(null);

    const pathIds = new Set([target.id]);
    let currentId = target.id;
    while (true) {
      const parentId = edges.find((edge) => edge.target === currentId)?.source;
      if (!parentId || pathIds.has(parentId)) break;
      pathIds.add(parentId);
      currentId = parentId;
    }
    const nextNodes = nodes.map((node) => pathIds.has(node.id) && node.hidden ? { ...node, hidden: false } : node);
    const nextEdges = edges.map((edge) => pathIds.has(edge.target) && pathIds.has(edge.source) && edge.hidden ? { ...edge, hidden: false } : edge);
    if (nextNodes.some((node, index) => node !== nodes[index]) || nextEdges.some((edge, index) => edge !== edges[index])) {
      checkpoint(nextNodes, nextEdges);
      setNodes(withCallbacks(nextNodes));
      setEdges(nextEdges);
    }

    if (outlineMode) {
      requestAnimationFrame(() => {
        const row = Array.from(document.querySelectorAll<HTMLElement>('[data-outline-node]')).find((element) => element.dataset.outlineNode === target.id);
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } else {
      void flowInstance.current?.fitView({ nodes: [{ id: target.id }], duration: 450, padding: 0.55 });
    }
  }, [searchMatches, searchIndex, nodeSearch, edges, nodes, outlineMode, checkpoint, setNodes, setEdges, withCallbacks]);

  useEffect(() => {
    let active = true;
    ready.current = false;
    setNodes([]);
    setEdges([]);
    void loadDocument(projectId).then((raw) => {
      if (!active) return;
      const snapshot = decodeSaved(raw);
      setNodes(withCallbacks(snapshot.nodes));
      setEdges(snapshot.edges);
      history.current = [snapshot];
      historyIndex.current = 0;
      ready.current = true;
    }).catch(() => {
      if (!active) return;
      const legacy = projectId === 'default-map' ? localStorage.getItem(STORE_KEY) ?? localStorage.getItem('ibra-mind-map-v1') : null;
      const snapshot = decodeSaved(legacy);
      setNodes(withCallbacks(snapshot.nodes));
      setEdges(snapshot.edges);
      history.current = [snapshot];
      historyIndex.current = 0;
      ready.current = true;
    });
    return () => { active = false; ready.current = false; };
  }, [projectId, setEdges, setNodes, withCallbacks]);

  useEffect(() => {
    if (!ready.current || !nodes.length) return;
    const timer = window.setTimeout(() => {
      const serializable = { nodes: nodes.map(({ data, ...node }) => ({ ...node, data: { label: data.label, kind: data.kind, color: data.color, completed: data.completed } })), edges };
      void saveDocument(projectId, JSON.stringify(serializable)).then(() => {
        touchProject(projectId);
        setSavedAt(new Intl.DateTimeFormat('ar-IQ', { hour: '2-digit', minute: '2-digit' }).format(new Date()));
      }).catch(() => setNotice('تعذر حفظ الملف المحلي. صدّر نسخة JSON قبل إغلاق التطبيق.'));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [nodes, edges, projectId]);

  const addTopic = useCallback((placement: 'child' | 'sibling' = 'child', anchorId: string | null = selectedId) => {
    const selected = nodes.find((node) => node.id === anchorId);
    const selectedParentId = selected && edges.find((edge) => edge.target === selected.id)?.source;
    const parent = placement === 'sibling' && selectedParentId
      ? nodes.find((node) => node.id === selectedParentId)
      : selected ?? nodes.find((node) => node.id === 'root') ?? nodes[0];
    if (!parent) return;
    const id = `topic-${crypto.randomUUID()}`;
    const siblingCount = edges.filter((edge) => edge.source === parent.id).length;
    const sign = siblingCount % 2 ? -1 : 1;
    const child: MindNodeType = { id, type: 'mind', position: { x: parent.position.x + sign * 250, y: parent.position.y + Math.floor(siblingCount / 2) * 125 + 115 }, data: { label: 'موضوع جديد', onLabelChange: updateLabel } };
    const nextNodes = withCallbacks([...nodes, child]);
    const nextEdges = [...edges, { id: `edge-${id}`, source: parent.id, target: id, type: 'smoothstep' }];
    checkpoint(nextNodes, nextEdges);
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedId(id);
  }, [nodes, selectedId, edges, updateLabel, withCallbacks, checkpoint, setNodes, setEdges]);

  const branchSnapshot = useCallback((rootId: string): Snapshot => {
    const included = new Set([rootId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of edges) if (included.has(edge.source) && !included.has(edge.target)) { included.add(edge.target); changed = true; }
    }
    return {
      nodes: nodes.filter((node) => included.has(node.id)),
      edges: edges.filter((edge) => included.has(edge.source) && included.has(edge.target)),
    };
  }, [nodes, edges]);

  const copySelected = useCallback(() => {
    if (!selectedId || selectedId === 'root') return;
    clipboard.current = branchSnapshot(selectedId);
    setClipboardReady(true);
  }, [selectedId, branchSnapshot]);

  const pasteBranch = useCallback(() => {
    if (!clipboard.current?.nodes.length) return;
    const parent = nodes.find((node) => node.id === selectedId) ?? nodes.find((node) => node.id === 'root');
    if (!parent) return;
    const idMap = new Map(clipboard.current.nodes.map((node) => [node.id, `topic-${crypto.randomUUID()}`]));
    const rootId = clipboard.current.nodes[0].id;
    const copiedNodes = clipboard.current.nodes.map((node, index) => ({
      ...node,
      id: idMap.get(node.id)!,
      position: index === 0
        ? { x: parent.position.x + 250, y: parent.position.y + 90 }
        : { x: parent.position.x + 250 + (node.position.x - clipboard.current!.nodes[0].position.x), y: parent.position.y + 90 + (node.position.y - clipboard.current!.nodes[0].position.y) },
    }));
    const copiedEdges = clipboard.current.edges.map((edge) => ({
      ...edge,
      id: `edge-${crypto.randomUUID()}`,
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
    }));
    const newRootId = idMap.get(rootId)!;
    const nextNodes = withCallbacks([...nodes, ...copiedNodes]);
    const nextEdges = [...edges, ...copiedEdges, { id: `edge-${crypto.randomUUID()}`, source: parent.id, target: newRootId, type: 'smoothstep' }];
    checkpoint(nextNodes, nextEdges);
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedId(newRootId);
  }, [nodes, edges, selectedId, withCallbacks, checkpoint, setNodes, setEdges]);

  const duplicateSelected = useCallback(() => {
    copySelected();
    pasteBranch();
  }, [copySelected, pasteBranch]);

  const autoLayout = useCallback(() => {
    const root = nodes.find((node) => node.id === 'root') ?? nodes[0];
    if (!root) return;
    const children = new Map<string, string[]>();
    for (const edge of edges) children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target]);
    const countLeaves = (id: string, path = new Set<string>()): number => {
      if (path.has(id)) return 1;
      const nextPath = new Set(path).add(id);
      const childIds = children.get(id) ?? [];
      return childIds.length ? childIds.reduce((sum, child) => sum + countLeaves(child, nextPath), 0) : 1;
    };
    const totalRows = countLeaves(root.id);
    const rowGap = 132;
    const center = (totalRows - 1) * rowGap / 2;
    const positions = new Map<string, { x: number; y: number }>([[root.id, { x: 0, y: 0 }]]);
    const place = (id: string, depth: number, top: number, side: number, path = new Set<string>()) => {
      if (path.has(id)) return;
      const nextPath = new Set(path).add(id);
      const span = countLeaves(id);
      positions.set(id, { x: side * depth * 290, y: top * rowGap + (span - 1) * rowGap / 2 - center });
      let cursor = top;
      for (const child of children.get(id) ?? []) {
        place(child, depth + 1, cursor, side, nextPath);
        cursor += countLeaves(child);
      }
    };
    let cursor = 0;
    (children.get(root.id) ?? []).forEach((child, index) => {
      place(child, 1, cursor, index % 2 === 0 ? 1 : -1);
      cursor += countLeaves(child);
    });
    const nextNodes = withCallbacks(nodes.map((node) => positions.has(node.id) ? { ...node, position: positions.get(node.id)! } : node));
    checkpoint(nextNodes, edges);
    setNodes(nextNodes);
  }, [nodes, edges, withCallbacks, checkpoint, setNodes]);

  const exportMarkdown = useCallback(() => {
    const children = new Map<string, string[]>();
    for (const edge of edges) children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target]);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const root = nodes.find((node) => node.id === 'root') ?? nodes[0];
    const lines: string[] = [`# ${title}`, ''];
    const write = (id: string, depth: number, seen: Set<string>) => {
      if (seen.has(id)) return;
      const node = byId.get(id);
      if (!node) return;
      lines.push(`${'  '.repeat(Math.min(depth, 12))}- ${node.data.label.replace(/[\r\n]+/g, ' ')}`);
      const next = new Set(seen).add(id);
      for (const child of children.get(id) ?? []) write(child, depth + 1, next);
    };
    if (root) write(root.id, 0, new Set());
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, title]);

  const exportVisual = useCallback(async (format: 'png' | 'svg' | 'pdf', selectedOnly = false, nodeOnly = false) => {
    try {
      let exportNodes = nodes;
      let exportEdges = edges;
      if (selectedOnly && selectedId && nodeOnly) {
        exportNodes = nodes.filter((node) => node.id === selectedId);
        exportEdges = [];
      } else if (selectedOnly && selectedId) {
        const included = new Set([selectedId]);
        const queue = [selectedId];
        while (queue.length) {
          const current = queue.shift()!;
          for (const edge of edges) if (edge.source === current && !included.has(edge.target)) { included.add(edge.target); queue.push(edge.target); }
        }
        exportNodes = nodes.filter((node) => included.has(node.id));
        exportEdges = edges.filter((edge) => included.has(edge.source) && included.has(edge.target));
      }
      const { svg, width, height } = buildMapSvg(exportNodes, exportEdges);
      const safeTitle = `${title}${nodeOnly ? '-node' : selectedOnly ? '-selected' : ''}`.replace(/[\\/:*?"<>|]/g, '_');
      if (format === 'svg') {
        const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })); link.download = `${safeTitle}.svg`; link.click(); URL.revokeObjectURL(link.href);
      } else {
        const ratio = Math.min(3, Math.sqrt(80_000_000 / (width * height)), 16_000 / width, 16_000 / height);
        if (ratio < 0.5) throw new Error('الخريطة كبيرة جداً للتصدير كصورة. صدّرها بصيغة SVG.');
        const imageUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
        const image = new Image(); image.src = imageUrl; await image.decode(); URL.revokeObjectURL(imageUrl);
        const canvas = document.createElement('canvas'); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
        const context = canvas.getContext('2d'); if (!context) throw new Error('تعذر تجهيز لوحة التصدير.');
        context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const png = canvas.toDataURL('image/png');
        if (format === 'png') {
          const link = document.createElement('a'); link.href = png; link.download = `${safeTitle}.png`; link.click();
        } else {
          const { jsPDF } = await import('jspdf');
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const margin = 24;
          const contentWidth = pageWidth - margin * 2;
          const contentHeight = pageHeight - margin * 2 - 22;
          const scale = 0.75;
          const imageWidth = width * scale;
          const imageHeight = height * scale;
          const stepX = contentWidth - 20;
          const stepY = contentHeight - 24;
          const columns = Math.max(1, Math.ceil((imageWidth - 20) / stepX));
          const rows = Math.max(1, Math.ceil((imageHeight - 24) / stepY));
          const pageCount = columns * rows;
          if (pageCount > 200) throw new Error('الخريطة تحتاج أكثر من 200 صفحة. صدّرها بصيغة SVG أو PNG.');
          for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
            if (row || column) pdf.addPage('a4', 'portrait');
            pdf.addImage(png, 'PNG', margin - column * stepX, margin - row * stepY, imageWidth, imageHeight, undefined, 'FAST');
            pdf.setFontSize(8);
            pdf.setTextColor(110);
            pdf.text(`${title} · ${row * columns + column + 1}/${pageCount}`, margin, pageHeight - 10);
          }
          pdf.save(`${safeTitle}.pdf`);
        }
      }
      setNotice(`اكتمل تصدير الخريطة بصيغة ${format.toUpperCase()}.`);
    } catch (failure) {
      setNotice(failure instanceof Error ? `تعذر التصدير: ${failure.message}` : 'تعذر تصدير الخريطة.');
    }
  }, [title, nodes, edges, selectedId]);

  const importMap = (file?: File) => {
    if (!file) return;
    void file.text().then((text) => {
      const parsed = JSON.parse(text) as { nodes?: unknown; edges?: unknown };
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) throw new Error('الملف لا يحتوي خريطة متوافقة.');
      const nextNodes = parsed.nodes as MindNodeType[];
      const nextEdges = parsed.edges as Edge[];
      const ids = new Set(nextNodes.map((node) => node.id));
      const validNodes = nextNodes.length > 0 && nextNodes.every((node) => typeof node.id === 'string' && typeof node.data?.label === 'string' && Number.isFinite(node.position?.x) && Number.isFinite(node.position?.y));
      const validEdges = nextEdges.every((edge) => ids.has(edge.source) && ids.has(edge.target));
      if (!validNodes || !validEdges) throw new Error('تأكد من وجود عقد صحيحة وروابط تشير إلى عقد موجودة.');
      const withHandlers = withCallbacks(nextNodes);
      checkpoint(withHandlers, nextEdges);
      setNodes(withHandlers);
      setEdges(nextEdges);
      setSelectedId(null);
      setNotice('تم استيراد الخريطة وحفظها محلياً.');
    }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'تعذر قراءة الملف.'));
  };

  const removeSelected = useCallback((targetId: string | null = selectedId) => {
    if (!targetId || targetId === 'root') return;
    const removed = new Set([targetId]);
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

  const setSelectedStyle = useCallback((patch: Partial<MindData>) => {
    if (!selectedId) return;
    const nextNodes = withCallbacks(nodes.map((node) => node.id === selectedId ? { ...node, data: { ...node.data, ...patch } } : node));
    checkpoint(nextNodes, edges);
    setNodes(nextNodes);
  }, [selectedId, nodes, edges, withCallbacks, checkpoint, setNodes]);

  const updateSelectedEdge = useCallback((patch: Partial<Edge>) => {
    if (!selectedEdgeId) return;
    const nextEdges = edges.map((edge) => edge.id === selectedEdgeId ? { ...edge, ...patch } : edge);
    checkpoint(nodes, nextEdges); setEdges(nextEdges);
  }, [selectedEdgeId, nodes, edges, checkpoint, setEdges]);

  const removeSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    const nextEdges = edges.filter((edge) => edge.id !== selectedEdgeId);
    checkpoint(nodes, nextEdges); setEdges(nextEdges); setSelectedEdgeId(null);
  }, [selectedEdgeId, nodes, edges, checkpoint, setEdges]);

  const toggleBranch = useCallback((expand: boolean) => {
    if (!selectedId) return;
    const descendants = new Set<string>();
    const queue = [selectedId];
    while (queue.length) {
      const id = queue.shift()!;
      for (const edge of edges) if (edge.source === id && !descendants.has(edge.target)) { descendants.add(edge.target); queue.push(edge.target); }
    }
    const nextEdges = edges.map((edge) => descendants.has(edge.target) ? { ...edge, hidden: !expand } : edge);
    const nextNodes = withCallbacks(nodes.map((node) => descendants.has(node.id) ? { ...node, hidden: !expand } : node));
    checkpoint(nextNodes, nextEdges);
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [selectedId, nodes, edges, withCallbacks, checkpoint, setNodes, setEdges]);

  const expandWithAi = useCallback(async () => {
    const selected = nodes.find((node) => node.id === selectedId);
    if (!selected || !window.ibraMind?.providers || aiBusy) return;
    setAiBusy(true); setNotice('');
    try {
      const result = await window.ibraMind.providers.list();
      const enabled = (result.providers || []).filter((provider) => provider.enabled);
      let route = '';
      try { route = JSON.parse(localStorage.getItem('ibra-mind-ai-routing-v1') || '{}').expansion || ''; } catch { route = ''; }
      const provider = enabled.find((item) => item.id === route) || enabled.find((item) => item.isDefault) || enabled[0];
      if (!provider) throw new Error('أضف مزوداً مفعّلاً من إعدادات الذكاء الاصطناعي أولاً.');
      const completion = await window.ibraMind.providers.complete({
        providerId: provider.id, maxTokens: Math.min(provider.maxTokens, 3500), temperature: provider.temperature,
        messages: [
          { role: 'system', content: 'وسّع الفكرة المحددة إلى خريطة فرعية نافعة باللغة نفسها. أجب بكائن JSON فقط بالشكل {"title":"عنوان الفكرة","children":[{"title":"فرع","children":[{"title":"تفصيل","children":[]}]}]}. أنشئ 3 إلى 6 فروع مباشرة، وتفاصيل عند الحاجة. لا تكرر العنوان كفرع ولا تضف Markdown.' },
          { role: 'user', content: `وسّع هذه الفكرة إلى فروع فرعية مستقلة وواضحة:\n${selected.data.label.slice(0, 1800)}` },
        ],
      });
      if (!completion.ok || !completion.text) throw new Error(completion.error || 'تعذر توسيع الفكرة.');
      const generated = mapFromJson(JSON.parse(completion.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')));
      const latestNodes = nodesRef.current;
      const latestEdges = edgesRef.current;
      const currentSelected = latestNodes.find((node) => node.id === selectedId);
      if (!currentSelected) throw new Error('العقدة المحددة لم تعد موجودة؛ لم تُغيّر الخريطة.');
      const idMap = new Map(generated.nodes.map((node) => [node.id, node.id === 'root' ? selected.id : `ai-${crypto.randomUUID()}`]));
      const addedNodes = generated.nodes.filter((node) => node.id !== 'root').map((node) => ({
        ...node, id: idMap.get(node.id)!, position: { x: currentSelected.position.x + node.position.x, y: currentSelected.position.y + node.position.y },
      })) as MindNodeType[];
      const addedEdges = generated.edges.map((edge) => ({ ...edge, id: `edge-${crypto.randomUUID()}`, source: idMap.get(edge.source)!, target: idMap.get(edge.target)! }));
      const nextNodes = withCallbacks([...latestNodes, ...addedNodes]);
      const nextEdges = [...latestEdges, ...addedEdges];
      checkpoint(nextNodes, nextEdges);
      setNodes(nextNodes); setEdges(nextEdges);
      setNotice(`أُضيفت ${addedNodes.length} عقدة إلى «${selected.data.label}» باستخدام ${provider.name}.`);
    } catch (failure) {
      setNotice(failure instanceof Error ? `تعذر التوسيع بالذكاء الاصطناعي: ${failure.message}` : 'تعذر التوسيع بالذكاء الاصطناعي.');
    } finally { setAiBusy(false); }
  }, [nodes, selectedId, aiBusy, withCallbacks, checkpoint, setNodes, setEdges]);

  const runNodeAssistant = useCallback(async () => {
    const selected = nodes.find((node) => node.id === selectedId);
    if (!selected || !window.ibraMind?.providers || aiBusy) return;
    setAiBusy(true); setAssistantError(''); setAssistantResult('');
    try {
      const listed = await window.ibraMind.providers.list();
      const enabled = (listed.providers || []).filter((provider) => provider.enabled);
      const routeKey = assistantAction === 'translate' ? 'translation'
        : assistantAction === 'explain' ? 'explanation'
          : assistantAction === 'brainstorm' ? 'expansion'
            : assistantAction === 'questions' ? 'mindMapGeneration' : 'summarization';
      let route = '';
      try { route = JSON.parse(localStorage.getItem('ibra-mind-ai-routing-v1') || '{}')[routeKey] || ''; } catch { route = ''; }
      const provider = enabled.find((item) => item.id === route) || enabled.find((item) => item.isDefault) || enabled[0];
      if (!provider) throw new Error('أضف مزوداً مفعّلاً من إعدادات الذكاء الاصطناعي أولاً.');
      const branchLabels: string[] = [];
      const seen = new Set([selected.id]);
      const queue = [selected.id];
      while (queue.length && branchLabels.length < 30) {
        const parent = queue.shift()!;
        for (const edge of edgesRef.current) if (edge.source === parent && !seen.has(edge.target)) {
          seen.add(edge.target); queue.push(edge.target);
          const child = nodesRef.current.find((node) => node.id === edge.target);
          if (child) branchLabels.push(child.data.label.slice(0, 180));
          if (branchLabels.length >= 30) break;
        }
      }
      const context = [`الفكرة المحددة: ${selected.data.label}`, ...branchLabels.map((label) => `- ${label}`)].join('\n').slice(0, 5000);
      const instructions: Record<NodeAiAction, string> = {
        summarize: 'لخص الفكرة وفرعها في فقرة عربية قصيرة دقيقة لا تتجاوز 3 جمل. احفظ المصطلحات والأرقام المهمة.',
        rewrite: 'أعد صياغة الفكرة المحددة بلغة واضحة وسليمة، مع الحفاظ على معناها ومعلوماتها. أرجع النص المعاد صياغته فقط وباختصار مناسب لعنوان عقدة.',
        translate: `ترجم الفكرة ومحتواها إلى ${assistantLanguage.trim() || 'English'} ترجمة طبيعية دقيقة، وحافظ على الأسماء والأرقام. أرجع النص المترجم فقط.`,
        explain: 'اشرح الفكرة المحددة بلغة مبسطة في نقاط قصيرة، مع توضيح المصطلحات دون إضافة معلومات غير مؤكدة.',
        brainstorm: 'اقترح 5 إلى 8 أفكار فرعية عملية لهذه الفكرة. أجب بقائمة نصية، فكرة واحدة في كل سطر، بلا مقدمة أو خاتمة.',
        questions: 'ولّد 5 إلى 8 أسئلة واضحة تساعد على دراسة الفكرة وفهمها. أجب بقائمة نصية، سؤال واحد في كل سطر، بلا مقدمة أو خاتمة.',
      };
      const response = await window.ibraMind.providers.complete({
        providerId: provider.id, maxTokens: Math.min(provider.maxTokens, 2200), temperature: assistantAction === 'rewrite' || assistantAction === 'translate' ? 0.2 : 0.4,
        messages: [
          { role: 'system', content: `${instructions[assistantAction]} لا تذكر أنك ذكاء اصطناعي ولا تضف Markdown غير ضروري.` },
          { role: 'user', content: context },
        ],
      });
      if (!response.ok || !response.text?.trim()) throw new Error(response.error || 'لم يرجع المزود نتيجة قابلة للاستخدام.');
      setAssistantResult(response.text.trim().slice(0, 4000));
    } catch (failure) { setAssistantError(failure instanceof Error ? failure.message : 'تعذر تنفيذ إجراء المساعد.'); }
    finally { setAiBusy(false); }
  }, [nodes, selectedId, aiBusy, assistantAction, assistantLanguage]);

  const applyAssistantResult = useCallback((mode: 'replace' | 'children') => {
    const result = assistantResult.trim();
    if (!result || !selectedId) return;
    const latestNodes = nodesRef.current;
    const latestEdges = edgesRef.current;
    const selected = latestNodes.find((node) => node.id === selectedId);
    if (!selected) { setAssistantError('العقدة المحددة لم تعد موجودة؛ لم تتغير الخريطة.'); return; }
    if (mode === 'replace') {
      const nextNodes = withCallbacks(latestNodes.map((node) => node.id === selectedId ? { ...node, data: { ...node.data, label: result.slice(0, 240) } } : node));
      checkpoint(nextNodes, latestEdges); setNodes(nextNodes);
      setNotice(`تم تحديث عنوان العقدة باستخدام نتيجة ${assistantAction === 'translate' ? 'الترجمة' : 'المساعد'}.`);
    } else {
      const ideas = result.split(/\r?\n/).map((line) => line.replace(/^\s*(?:[-*•]+|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, 10);
      if (!ideas.length) { setAssistantError('لا توجد أفكار نصية لإضافتها.'); return; }
      const addedNodes: MindNodeType[] = ideas.map((label, index) => ({
        id: `ai-note-${crypto.randomUUID()}`, type: 'mind', position: { x: selected.position.x + 300, y: selected.position.y + (index - (ideas.length - 1) / 2) * 105 },
        data: { label: label.slice(0, 240), onLabelChange: () => undefined },
      }));
      const addedEdges = addedNodes.map((node) => ({ id: `edge-${crypto.randomUUID()}`, source: selectedId, target: node.id, type: 'smoothstep' }));
      const nextNodes = withCallbacks([...latestNodes, ...addedNodes]); const nextEdges = [...latestEdges, ...addedEdges];
      checkpoint(nextNodes, nextEdges); setNodes(nextNodes); setEdges(nextEdges);
      setNotice(`أُضيفت ${addedNodes.length} فكرة كفروع تابعة.`);
    }
    setAssistantOpen(false); setAssistantResult('');
  }, [assistantResult, selectedId, assistantAction, withCallbacks, checkpoint, setNodes, setEdges]);

  const childrenOf = useCallback((id: string) => edges.filter((edge) => edge.source === id).map((edge) => edge.target), [edges]);
  const renderOutline = (id: string, depth: number, path: Set<string>): ReactNode => {
    const node = nodes.find((item) => item.id === id);
    if (!node || path.has(id)) return null;
    const nextPath = new Set(path).add(id);
    return <li key={id} data-outline-node={id} style={{ '--outline-depth': depth } as CSSProperties}>
      <div className={`outline-row ${selectedId === id ? 'selected' : ''}`}>
        <button aria-label={`اختيار ${node.data.label}`} onClick={() => setSelectedId(id)} className="outline-select">{node.data.label}</button>
        <button aria-label="إضافة فرع تابع" onClick={() => addTopic('child', id)}><Plus size={14}/></button>
        {id !== 'root' && <button aria-label="حذف الفرع" onClick={() => removeSelected(id)}><Trash2 size={14}/></button>}
      </div>
      {(childrenOf(id).length > 0) && <ul>{childrenOf(id).map((childId) => renderOutline(childId, depth + 1, nextPath))}</ul>}
    </li>;
  };

  const restoreHistory = useCallback((step: -1 | 1) => {
    const nextIndex = historyIndex.current + step;
    const snapshot = history.current[nextIndex];
    if (!snapshot) return;
    historyIndex.current = nextIndex;
    setNodes(withCallbacks(snapshot.nodes));
    setEdges(snapshot.edges);
  }, [setNodes, setEdges, withCallbacks]);

  const connect = useCallback((connection: Connection) => {
    const nextEdges = addEdge({ ...connection, type: 'smoothstep', style: { stroke: '#8a7be0', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#8a7be0' } }, edges);
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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && selectedId) { event.preventDefault(); copySelected(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x' && selectedId && selectedId !== 'root') { event.preventDefault(); copySelected(); removeSelected(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') { event.preventDefault(); pasteBranch(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateSelected(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addTopic, removeSelected, restoreHistory, selectedId, copySelected, pasteBranch, duplicateSelected]);

  const exportMap = () => {
    const blob = new Blob([JSON.stringify({ version: 2, title, nodes: nodes.map(({ data, ...node }) => ({ ...node, data: { label: data.label, kind: data.kind, color: data.color, completed: data.completed } })), edges }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ibra-mind-map.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return <main className="editor-shell" ref={flowRef}>
    <header className="editor-topbar"><button className="editor-brand" onClick={onHome}><span className="brand-mark"><ArrowRight size={18}/></span><span>IBRA <b>MIND</b></span></button><div className="editor-title"><small>خريطتي الذهنية</small><b>{title}</b></div><div className="editor-save"><Save size={15}/>{savedAt ? `حُفظ تلقائياً · ${savedAt}` : 'حفظ تلقائي مفعّل'}</div><button className="editor-button subtle" onClick={exportMap}><Download size={15}/> تصدير JSON</button><button className="editor-button subtle" onClick={onHome}><Home size={15}/> الرئيسية</button></header>
    <div className="node-search-toolbar" role="search" aria-label="البحث داخل الخريطة"><label><Search size={15}/><input aria-label="ابحث في عناوين العقد" value={nodeSearch} onChange={(event)=>{setNodeSearch(event.target.value);setSearchIndex(-1)}} onKeyDown={(event)=>{if(event.key==='Enter'){event.preventDefault();searchNode(event.shiftKey?-1:1)}}} placeholder="ابحث داخل العقد..."/></label><span className="node-search-count" aria-live="polite">{searchMatches.length ? `${searchIndex >= 0 ? searchIndex + 1 : '—'} / ${searchMatches.length}` : nodeSearch.trim() ? 'لا توجد نتائج' : 'بحث في الخريطة'}</span><button className="editor-icon-button" aria-label="النتيجة السابقة" title="النتيجة السابقة" disabled={!searchMatches.length} onClick={()=>searchNode(-1)}><ChevronRight size={16}/></button><button className="editor-icon-button" aria-label="النتيجة التالية" title="النتيجة التالية" disabled={!searchMatches.length} onClick={()=>searchNode(1)}><ChevronLeft size={16}/></button></div>
    <div className="editor-toolbar"><button className="editor-button primary" onClick={() => addTopic('child')}><Plus size={16}/> فرع تابع <kbd>Tab</kbd></button><button className="editor-button" onClick={() => addTopic('sibling')} disabled={!selectedId || selectedId === 'root'}><Plus size={15}/> فرع بجانبه</button><button className="editor-button" onClick={duplicateSelected} disabled={!selectedId || selectedId === 'root'}><Copy size={14}/> تكرار</button><button className="editor-button" onClick={() => { copySelected(); removeSelected(); }} disabled={!selectedId || selectedId === 'root'}><Scissors size={14}/> قص</button><button className="editor-button" onClick={pasteBranch} disabled={!clipboardReady}><Copy size={14}/> لصق</button><button className="editor-button" onClick={() => removeSelected()} disabled={!selectedId || selectedId === 'root'}><Trash2 size={15}/> حذف</button><span className="toolbar-divider"/><button className="editor-icon-button" aria-label="تراجع" onClick={() => restoreHistory(-1)}><Undo2 size={17}/></button><button className="editor-icon-button" aria-label="إعادة" onClick={() => restoreHistory(1)}><Redo2 size={17}/></button><button className="editor-button" onClick={autoLayout}><LayoutGrid size={14}/> توزيع تلقائي</button><button className="editor-button" onClick={()=>setOutlineMode(!outlineMode)}>{outlineMode?<LayoutGrid size={14}/>:<ListTree size={14}/>} {outlineMode?'عرض الخريطة':'عرض القائمة'}</button><button className="editor-button" onClick={exportMarkdown}><FileText size={14}/> Markdown</button><button className="editor-button" onClick={()=>importInputRef.current?.click()}><FileUp size={14}/> استيراد JSON</button><input ref={importInputRef} hidden type="file" accept="application/json,.json" aria-label="ملف خريطة JSON" onChange={(event)=>{importMap(event.target.files?.[0]);event.currentTarget.value=''}}/><button className="editor-button" onClick={()=>window.print()}><Printer size={14}/> طباعة</button><span className="editor-help"><CircleHelp size={15}/> حدّد عقدة ثم اختر الإجراء. اسحب العقد لترتيبها.</span></div>
    {!outlineMode && <div className="editor-toolbar export-toolbar" aria-label="تصدير الخريطة"><span>تصدير كامل الخريطة:</span><button className="editor-button" title="تصدير PNG عالي الدقة" onClick={()=>void exportVisual('png')}><FileImage size={14}/> PNG</button><button className="editor-button" title="تصدير SVG" onClick={()=>void exportVisual('svg')}><FileImage size={14}/> SVG</button><button className="editor-button" title="تصدير PDF متعدد الصفحات" onClick={()=>void exportVisual('pdf')}><FileDown size={14}/> PDF</button><span className="export-selected-label">العقدة المحددة وفروعها:</span><span className="export-selected-label">العقدة وحدها:</span><button className="editor-button" disabled={!selectedId} title="تصدير العقدة PNG" onClick={()=>void exportVisual("png",true,true)}><FileImage size={14}/> PNG</button><button className="editor-button" disabled={!selectedId} title="تصدير العقدة SVG" onClick={()=>void exportVisual("svg",true,true)}><FileImage size={14}/> SVG</button><button className="editor-button" disabled={!selectedId} title="تصدير العقدة PDF" onClick={()=>void exportVisual("pdf",true,true)}><FileDown size={14}/> PDF</button><button className="editor-button" disabled={!selectedId} title="تصدير التحديد PNG" onClick={()=>void exportVisual('png',true)}><FileImage size={14}/> PNG</button><button className="editor-button" disabled={!selectedId} title="تصدير التحديد SVG" onClick={()=>void exportVisual('svg',true)}><FileImage size={14}/> SVG</button><button className="editor-button" disabled={!selectedId} title="تصدير التحديد PDF" onClick={()=>void exportVisual('pdf',true)}><FileDown size={14}/> PDF</button></div>}
    {selectedId && <div className="editor-toolbar node-style-toolbar" aria-label="تنسيق العقدة المحددة"><span>تنسيق العقدة</span><select aria-label="شكل العقدة" value={nodes.find((node)=>node.id===selectedId)?.data.kind||'branch'} onChange={(event)=>setSelectedStyle({kind:event.target.value as MindKind})}><option value="branch">متفرعة</option><option value="rectangle">مستطيل</option><option value="circle">دائرية</option><option value="diamond">معيّن</option><option value="sticky">ملاحظة</option><option value="task">مهمة</option></select><select aria-label="لون العقدة" value={nodes.find((node)=>node.id===selectedId)?.data.color||'violet'} onChange={(event)=>setSelectedStyle({color:event.target.value as MindColor})}><option value="violet">بنفسجي</option><option value="blue">أزرق</option><option value="mint">أخضر</option><option value="amber">ذهبي</option></select><button className="editor-button" onClick={()=>{setAssistantError('');setAssistantResult('');setAssistantOpen(true)}} disabled={aiBusy}><Sparkles size={14}/> مساعد الذكاء</button><button className="editor-button" onClick={()=>void expandWithAi()} disabled={aiBusy}>{aiBusy?<LoaderCircle size={14} className="spin"/>:<Sparkles size={14}/>} توسيع بالذكاء</button><button className="editor-button" onClick={()=>toggleBranch(false)}><Shrink size={14}/> طي الفروع</button><button className="editor-button" onClick={()=>toggleBranch(true)}><Expand size={14}/> توسيع الفروع</button></div>}
    {selectedEdgeId && edges.find((edge)=>edge.id===selectedEdgeId) && (()=>{const edge=edges.find((item)=>item.id===selectedEdgeId)!;const color=String(edge.style?.stroke||'#8a7be0');const marker=edge.markerEnd&&typeof edge.markerEnd==='object'?edge.markerEnd.type:'none';return <div className="editor-toolbar node-style-toolbar edge-style-toolbar" aria-label="تنسيق الاتصال المحدد"><b>تنسيق الاتصال</b><select aria-label="نوع الخط" value={edge.type||'default'} onChange={(event)=>updateSelectedEdge({type:event.target.value})}><option value="default">منحني</option><option value="smoothstep">ناعم متدرج</option><option value="step">زاوية قائمة</option><option value="straight">مستقيم</option></select><label>اللون<input aria-label="لون الاتصال" type="color" value={color} onChange={(event)=>updateSelectedEdge({style:{...edge.style,stroke:event.target.value},markerEnd:marker==='none'?undefined:{type:marker as MarkerType,color:event.target.value}})}/></label><label>السمك<input aria-label="سمك الاتصال" type="range" min="1" max="6" step="0.5" value={Number(edge.style?.strokeWidth||2)} onChange={(event)=>updateSelectedEdge({style:{...edge.style,strokeWidth:Number(event.target.value)}})}/></label><label>السهم<select aria-label="نوع رأس السهم" value={marker} onChange={(event)=>updateSelectedEdge({markerEnd:event.target.value==='none'?undefined:{type:event.target.value as MarkerType,color}})}><option value="none">بلا سهم</option><option value="arrow">سهم</option><option value="arrowclosed">سهم ممتلئ</option></select></label><label>التسمية<input aria-label="تسمية الاتصال" value={String(edge.label||'')} maxLength={80} onChange={(event)=>updateSelectedEdge({label:event.target.value})} placeholder="تسمية اختيارية"/></label><label><input type="checkbox" checked={Boolean(edge.style?.strokeDasharray)} onChange={(event)=>updateSelectedEdge({style:{...edge.style,strokeDasharray:event.target.checked?'6 4':undefined}})}/> متقطع</label><button className="editor-button" onClick={removeSelectedEdge}><Trash2 size={14}/> حذف الاتصال</button></div>})()}    {outlineMode ? <section className="outline-canvas" aria-label="مخطط الخريطة الهيكلي"><ul>{(nodes.find((node)=>node.id==='root')??nodes[0])&&renderOutline((nodes.find((node)=>node.id==='root')??nodes[0]).id,0,new Set())}</ul></section> : <section className="canvas-wrap" aria-label="لوحة الخريطة الذهنية"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onInit={(instance)=>{flowInstance.current=instance}} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={connect} onNodeClick={(_, node) => {setSelectedId(node.id);setSelectedEdgeId(null)}} onEdgeClick={(_, edge) => {setSelectedId(null);setSelectedEdgeId(edge.id)}} onPaneClick={() => {setSelectedId(null);setSelectedEdgeId(null)}} onNodeDragStop={() => checkpoint(nodesRef.current, edgesRef.current)} fitView fitViewOptions={{ padding: 0.3 }} minZoom={0.2} maxZoom={2.2} proOptions={{ hideAttribution: true }}><Background color="#dbe0ec" gap={24} size={1}/><Controls position="bottom-left"/><MiniMap position="bottom-right" zoomable pannable nodeColor="#8d79ee"/></ReactFlow></section>}
    <footer className="editor-footer"><span>{nodes.length} عقدة · {edges.length} اتصال</span><span>Tab فرع تابع · Ctrl+D تكرار · Ctrl+C / X / V نسخ · Delete حذف · Ctrl+Z تراجع</span></footer>
    {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice('')}>حسناً</button></div>}
    {assistantOpen&&<div className="dialog-backdrop ai-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!aiBusy)setAssistantOpen(false)}}><section className="dialog-card ai-dialog" role="dialog" aria-modal="true" aria-labelledby="node-ai-title"><button className="dialog-close" aria-label="إغلاق" disabled={aiBusy} onClick={()=>setAssistantOpen(false)}><X size={18}/></button><div className="dialog-symbol ai-symbol"><Sparkles size={22}/></div><h2 id="node-ai-title">مساعد العقدة المحددة</h2><p>يُرسل نص العقدة وفروعها إلى المزود المحدد لمسار المهمة. عاين النتيجة واختر كيف تضيفها للخريطة.</p><label className="ai-provider-label">الإجراء<select value={assistantAction} disabled={aiBusy} onChange={(event)=>{setAssistantAction(event.target.value as NodeAiAction);setAssistantResult('');setAssistantError('')}}><option value="summarize">تلخيص الفرع</option><option value="rewrite">إعادة صياغة العنوان</option><option value="translate">ترجمة الفرع</option><option value="explain">شرح مبسّط</option><option value="brainstorm">اقتراح أفكار فرعية</option><option value="questions">توليد أسئلة دراسة</option></select></label>{assistantAction==='translate'&&<label className="ai-provider-label">لغة الترجمة<input value={assistantLanguage} maxLength={50} onChange={(event)=>setAssistantLanguage(event.target.value)} placeholder="مثال: العربية أو English"/></label>}<div className="document-preview"><b>العقدة: {nodes.find((node)=>node.id===selectedId)?.data.label}</b></div><div className="dialog-actions"><button className="editor-button primary" onClick={()=>void runNodeAssistant()} disabled={aiBusy}>{aiBusy?<LoaderCircle size={15} className="spin"/>:<Sparkles size={15}/>} {aiBusy?'جارٍ العمل':'إنشاء نتيجة'}</button></div>{assistantError&&<div className="provider-error" role="alert"><AlertCircle size={16}/>{assistantError}</div>}{assistantResult&&<><label className="ai-topic-label">معاينة النتيجة<textarea dir="auto" rows={7} maxLength={4000} value={assistantResult} onChange={(event)=>setAssistantResult(event.target.value)}/></label><div className="dialog-actions"><button className="editor-button" onClick={()=>void (navigator.clipboard?.writeText(assistantResult)??Promise.reject()).then(()=>setAssistantError('نُسخت النتيجة إلى الحافظة.')).catch(()=>setAssistantError('تعذر النسخ؛ حدد النص وانسخه يدوياً.'))}><Copy size={14}/> نسخ</button><button className="editor-button" onClick={()=>applyAssistantResult('replace')}>استبدال عنوان العقدة</button><button className="editor-button primary" onClick={()=>applyAssistantResult('children')}>إضافة كفروع</button></div></>}</section></div>}
  </main>;
}

