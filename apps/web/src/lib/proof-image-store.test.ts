import { describe, it, expect, beforeEach, vi } from 'vitest';

// Minimal fake IndexedDB implementation for testing
function createFakeIndexedDB() {
  const stores = new Map<string, Map<string, unknown>>();

  const fakeDB: Partial<IDBDatabase> = {
    objectStoreNames: {
      contains: (name: string) => stores.has(name),
      length: stores.size,
    } as DOMStringList,
    createObjectStore: (name: string) => {
      stores.set(name, new Map());
      return {} as IDBObjectStore;
    },
    transaction: (storeNames: string | string[], mode?: IDBTransactionMode) => {
      const _mode = mode;
      const storeName = Array.isArray(storeNames) ? storeNames[0] : storeNames;
      const store = stores.get(storeName) ?? new Map();
      if (!stores.has(storeName)) stores.set(storeName, store);

      let oncomplete: (() => void) | null = null;
      let onerror: (() => void) | null = null;

      const txObj: Partial<IDBTransaction> = {
        objectStore: () => ({
          put: (row: { key: string }) => {
            store.set(row.key, row);
            queueMicrotask(() => oncomplete?.());
            return { onsuccess: null, onerror: null } as unknown as IDBRequest<IDBValidKey>;
          },
          get: (key: string) => {
            const result = store.get(key);
            const req: Record<string, unknown> = { result };
            queueMicrotask(() => (req.onsuccess as (() => void) | null)?.());
            return req as unknown as IDBRequest;
          },
        }) as unknown as IDBObjectStore,
        get oncomplete() { return oncomplete; },
        set oncomplete(fn: (() => void) | null) { oncomplete = fn; },
        get onerror() { return onerror; },
        set onerror(fn: (() => void) | null) { onerror = fn; },
        onabort: null,
        error: null,
      };

      void _mode;
      return txObj as IDBTransaction;
    },
    close: vi.fn(),
  };

  return {
    open: (_name: string, _version?: number) => {
      const req: Record<string, unknown> = { result: fakeDB };
      queueMicrotask(() => {
        (req.onupgradeneeded as (() => void) | null)?.();
        (req.onsuccess as (() => void) | null)?.();
      });
      return req;
    },
    stores,
    db: fakeDB,
  };
}

let fakeIDB: ReturnType<typeof createFakeIndexedDB>;

beforeEach(() => {
  fakeIDB = createFakeIndexedDB();
  vi.stubGlobal('indexedDB', fakeIDB);
});

describe('proof-image-store', () => {
  it('saves and reads a proof image', async () => {
    const { saveProofImage, readProofImage } = await import('./proof-image-store');

    await saveProofImage('2025-01-15', 'wake', 'data:image/png;base64,abc');
    const result = await readProofImage('2025-01-15', 'wake');
    expect(result).toBe('data:image/png;base64,abc');
  });

  it('returns null for non-existent image', async () => {
    const { readProofImage } = await import('./proof-image-store');

    const result = await readProofImage('2025-01-15', 'nonexistent');
    expect(result).toBeNull();
  });

  it('overwrites existing image on save', async () => {
    const { saveProofImage, readProofImage } = await import('./proof-image-store');

    await saveProofImage('2025-01-15', 'wake', 'data:old');
    await saveProofImage('2025-01-15', 'wake', 'data:new');
    const result = await readProofImage('2025-01-15', 'wake');
    expect(result).toBe('data:new');
  });

  it('stores different routines independently', async () => {
    const { saveProofImage, readProofImage } = await import('./proof-image-store');

    await saveProofImage('2025-01-15', 'wake', 'data:wake');
    await saveProofImage('2025-01-15', 'lunch', 'data:lunch');

    expect(await readProofImage('2025-01-15', 'wake')).toBe('data:wake');
    expect(await readProofImage('2025-01-15', 'lunch')).toBe('data:lunch');
  });
});
