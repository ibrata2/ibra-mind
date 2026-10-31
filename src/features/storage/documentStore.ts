type StoredDocument = { id: string; value: string; updatedAt: number };
const DB_NAME = 'ibra-mind-local';
const DB_VERSION = 1;
let database: Promise<IDBDatabase> | null = null;
const memory = new Map<string, string>();

function openDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('متصفح التخزين المحلي غير متاح.')); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('documents')) db.createObjectStore('documents', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error || new Error('تعذر فتح مخزن الملفات.')); };
    request.onblocked = () => { database = null; reject(new Error('أغلق النسخة الأخرى من IBRA MIND حتى يكتمل تحديث مخزن الملفات.')); };
  });
  return database;
}

function getRecord(db: IDBDatabase, id: string): Promise<StoredDocument | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction('documents', 'readonly').objectStore('documents').get(id);
    request.onsuccess = () => resolve(request.result as StoredDocument | undefined);
    request.onerror = () => reject(request.error || new Error('تعذرت قراءة الملف المحفوظ.'));
  });
}

function putRecord(db: IDBDatabase, record: StoredDocument): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('documents', 'readwrite');
    transaction.objectStore('documents').put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('تعذر حفظ الملف.'));
    transaction.onabort = () => reject(transaction.error || new Error('أُلغي حفظ الملف.'));
  });
}

export async function loadDocument(id: string): Promise<string | null> {
  if (memory.has(id)) return memory.get(id)!;
  const db = await openDatabase();
  const saved = await getRecord(db, id);
  if (saved?.value) { memory.set(id, saved.value); return saved.value; }
  const migrated = localStorage.getItem(`ibra-mind-document:${id}`) ?? (id === 'default-map' ? localStorage.getItem('ibra-mind-map-v2') ?? localStorage.getItem('ibra-mind-map-v1') : null);
  if (migrated) {
    await putRecord(db, { id, value: migrated, updatedAt: Date.now() });
    memory.set(id, migrated);
    localStorage.removeItem(`ibra-mind-document:${id}`);
    if (id === 'default-map') { localStorage.removeItem('ibra-mind-map-v2'); localStorage.removeItem('ibra-mind-map-v1'); }
    return migrated;
  }
  return null;
}

export async function saveDocument(id: string, value: string): Promise<void> {
  const db = await openDatabase();
  await putRecord(db, { id, value, updatedAt: Date.now() });
  memory.set(id, value);
}

export async function deleteDocument(id: string): Promise<void> {
  memory.delete(id);
  localStorage.removeItem(`ibra-mind-document:${id}`);
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('documents', 'readwrite');
    transaction.objectStore('documents').delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('تعذر حذف بيانات الملف.'));
  });
}

export function peekDocument(id: string): string | null {
  return memory.get(id) ?? localStorage.getItem(`ibra-mind-document:${id}`);
}
