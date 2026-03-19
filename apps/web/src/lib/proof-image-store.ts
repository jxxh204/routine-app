const DB_NAME = 'routine-challenge-db';
const DB_VERSION = 1;
const STORE_NAME = 'proof-images';

type ProofImageRow = {
  key: string;
  dataUrl: string;
  updatedAt: number;
};

function buildKey(dateKey: string, routineId: string) {
  return `${dateKey}:${routineId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('indexedDB unavailable'));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => reject(req.error ?? new Error('failed to open indexedDB'));

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    req.onsuccess = () => resolve(req.result);
  });
}

export async function saveProofImage(dateKey: string, routineId: string, dataUrl: string) {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const row: ProofImageRow = {
      key: buildKey(dateKey, routineId),
      dataUrl,
      updatedAt: Date.now(),
    };

    store.put(row);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('failed to save image'));
    tx.onabort = () => reject(tx.error ?? new Error('failed to save image'));
  });

  db.close();
}

export async function readProofImage(dateKey: string, routineId: string): Promise<string | null> {
  const db = await openDb();

  const result = await new Promise<ProofImageRow | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(buildKey(dateKey, routineId));

    req.onsuccess = () => resolve(req.result as ProofImageRow | undefined);
    req.onerror = () => reject(req.error ?? new Error('failed to read image'));
  });

  db.close();
  return result?.dataUrl ?? null;
}
