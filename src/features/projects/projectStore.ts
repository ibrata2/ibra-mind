import { deleteDocument } from '../storage/documentStore';

export type ProjectKind = 'mindmap' | 'flowchart' | 'whiteboard';

export type ProjectRecord = {
  id: string;
  title: string;
  kind: ProjectKind;
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
};

const PROJECTS_KEY = 'ibra-mind-projects-v1';
const DOCUMENT_PREFIX = 'ibra-mind-document:';
const LEGACY_KEYS = ['ibra-mind-map-v2', 'ibra-mind-map-v1'];

export const documentKey = (projectId: string) => `${DOCUMENT_PREFIX}${projectId}`;

function readRecords(): ProjectRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]') as ProjectRecord[];
    return Array.isArray(value) ? value.filter((item) => item && typeof item.id === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecords(records: ProjectRecord[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(records));
}

export function listProjects(): ProjectRecord[] {
  let records = readRecords();
  if (!records.length) {
    const now = Date.now();
    const id = 'default-map';
    const legacy = LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    if (legacy && !localStorage.getItem(documentKey(id))) localStorage.setItem(documentKey(id), legacy);
    records = [{ id, title: 'فكرتي الجديدة', kind: 'mindmap', createdAt: now, updatedAt: now, favorite: false }];
    writeRecords(records);
  }
  return records;
}

export function createProject(title: string, kind: ProjectKind = 'mindmap'): ProjectRecord {
  const now = Date.now();
  const project: ProjectRecord = { id: crypto.randomUUID(), title: title.trim() || 'مساحة أفكار جديدة', kind, createdAt: now, updatedAt: now, favorite: false };
  writeRecords([project, ...listProjects()]);
  return project;
}

export function updateProject(id: string, changes: Partial<Pick<ProjectRecord, 'title' | 'favorite' | 'updatedAt'>>): ProjectRecord[] {
  const records = listProjects().map((project) => project.id === id ? { ...project, ...changes } : project);
  writeRecords(records);
  return records;
}

export function deleteProject(id: string): ProjectRecord[] {
  localStorage.removeItem(documentKey(id));
  void deleteDocument(id).catch(() => undefined);
  const records = listProjects().filter((project) => project.id !== id);
  writeRecords(records);
  return records;
}

export function touchProject(id: string) {
  updateProject(id, { updatedAt: Date.now() });
}

