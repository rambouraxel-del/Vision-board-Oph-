import { useSyncExternalStore } from 'react';
import type { Category, Item } from '../types';
import { getMeta, setMeta, withDB, toStorageError, type StoredBlob } from './db';
import { DATA_VERSION, migrate, sanitizeCategory, sanitizeItem } from './migrations';
import { SEED_CATEGORIES, SEED_ITEMS } from './seed';
import { uid } from '../lib/util';

export interface State {
  ready: boolean;
  items: Item[];
  categories: Category[];
  loadError: string | null;
}

type Listener = () => void;
type ErrorListener = (message: string) => void;

let state: State = { ready: false, items: [], categories: [], loadError: null };
const listeners = new Set<Listener>();
const errorListeners = new Set<ErrorListener>();

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function onStorageError(l: ErrorListener) {
  errorListeners.add(l);
  return () => errorListeners.delete(l);
}

function reportError(e: unknown) {
  const err = toStorageError(e);
  console.error(err, err.cause);
  errorListeners.forEach((l) => l(err.message));
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => select(state));
}

export const getState = () => state;

// ---------------------------------------------------------------------------
// Chargement initial, contenus de départ et migrations
// ---------------------------------------------------------------------------

export async function loadStore(): Promise<void> {
  try {
    const [rawItems, rawCats, version, seeded] = await withDB(async (db) =>
      Promise.all([
        db.getAll('items'),
        db.getAll('categories'),
        db.get('meta', 'dataVersion') as Promise<number | undefined>,
        db.get('meta', 'seededIds') as Promise<string[] | undefined>,
      ]),
    );

    let items = rawItems.map(sanitizeItem).filter((x): x is Item => x !== null);
    let categories = rawCats.map(sanitizeCategory).filter((x): x is Category => x !== null);

    // Migrations des données existantes (jamais d'effacement)
    if (version !== undefined && version < DATA_VERSION) {
      ({ items, categories } = migrate({ items, categories }, version));
      await withDB(async (db) => {
        const tx = db.transaction(['items', 'categories', 'meta'], 'readwrite');
        await Promise.all([
          ...items.map((i) => tx.objectStore('items').put(i)),
          ...categories.map((c) => tx.objectStore('categories').put(c)),
          tx.objectStore('meta').put(DATA_VERSION, 'dataVersion'),
        ]);
        await tx.done;
      });
    }

    // Contenus de départ : seuls ceux qui n'ont JAMAIS été ajoutés sont insérés.
    // Un exemple supprimé par Ophélie n'est donc jamais réinjecté.
    const already = new Set(seeded ?? []);
    const newCats = SEED_CATEGORIES.filter((c) => !already.has(c.id));
    const newItems = SEED_ITEMS.filter((i) => !already.has(i.id));
    if (newCats.length || newItems.length || version === undefined) {
      const now = Date.now();
      const freshItems = newItems.map((i) => ({ ...i, createdAt: now, updatedAt: now }));
      await withDB(async (db) => {
        const tx = db.transaction(['items', 'categories', 'meta'], 'readwrite');
        await Promise.all([
          ...freshItems.map((i) => tx.objectStore('items').put(i)),
          ...newCats.map((c) => tx.objectStore('categories').put(c)),
          tx
            .objectStore('meta')
            .put([...already, ...newCats.map((c) => c.id), ...newItems.map((i) => i.id)], 'seededIds'),
          tx.objectStore('meta').put(DATA_VERSION, 'dataVersion'),
        ]);
        await tx.done;
      });
      items = [...items, ...freshItems];
      categories = [...categories, ...newCats];
    }

    emit({ ready: true, items, categories, loadError: null });
    void collectOrphanBlobs(items);
  } catch (e) {
    const err = toStorageError(e);
    console.error(err, err.cause);
    // Mode dégradé : on affiche les contenus de départ sans pouvoir enregistrer.
    emit({
      ready: true,
      items: SEED_ITEMS,
      categories: SEED_CATEGORIES,
      loadError: err.message,
    });
  }
}

/** Supprime les images importées qui ne sont plus utilisées par aucun élément. */
async function collectOrphanBlobs(items: Item[]) {
  try {
    const used = new Set(items.flatMap((i) => i.photos.filter((p) => p.kind === 'blob').map((p) => p.ref)));
    const keys = await withDB((db) => db.getAllKeys('blobs'));
    const orphans = keys.filter((k) => !used.has(k));
    if (orphans.length) {
      await withDB(async (db) => {
        const tx = db.transaction('blobs', 'readwrite');
        await Promise.all(orphans.map((k) => tx.store.delete(k)));
        await tx.done;
      });
    }
  } catch {
    /* nettoyage facultatif */
  }
}

// ---------------------------------------------------------------------------
// Éléments
// ---------------------------------------------------------------------------

export async function saveItem(item: Item): Promise<boolean> {
  const next = { ...item, updatedAt: Date.now() };
  const exists = state.items.some((i) => i.id === item.id);
  emit({ items: exists ? state.items.map((i) => (i.id === item.id ? next : i)) : [...state.items, next] });
  try {
    await withDB((db) => db.put('items', next));
    return true;
  } catch (e) {
    reportError(e);
    return false;
  }
}

export function patchItem(id: string, patch: Partial<Item>) {
  const cur = state.items.find((i) => i.id === id);
  if (!cur) return Promise.resolve(false);
  return saveItem({ ...cur, ...patch });
}

/** Déplacement d'une carte : enregistré sans modifier la date de mise à jour. */
export async function moveItem(id: string, x: number, y: number) {
  const cur = state.items.find((i) => i.id === id);
  if (!cur) return;
  const next = { ...cur, x: Math.round(x), y: Math.round(y) };
  emit({ items: state.items.map((i) => (i.id === id ? next : i)) });
  try {
    await withDB((db) => db.put('items', next));
  } catch (e) {
    reportError(e);
  }
}

/**
 * Supprime un élément. Les images importées sont conservées jusqu'à la fin du délai d'annulation.
 * Retourne une fonction d'annulation.
 */
export async function deleteItem(id: string): Promise<{ undo: () => Promise<void>; commit: () => void } | null> {
  const cur = state.items.find((i) => i.id === id);
  if (!cur) return null;
  // Retirer aussi l'élément des tenues et capsules qui le contiennent
  const affected = state.items
    .filter((i) => i.itemIds?.includes(id))
    .map((i) => ({ before: i, after: { ...i, itemIds: i.itemIds!.filter((x) => x !== id) } }));
  emit({
    items: state.items
      .filter((i) => i.id !== id)
      .map((i) => affected.find((a) => a.before.id === i.id)?.after ?? i),
  });
  try {
    await withDB(async (db) => {
      const tx = db.transaction('items', 'readwrite');
      await Promise.all([tx.store.delete(id), ...affected.map((a) => tx.store.put(a.after))]);
      await tx.done;
    });
  } catch (e) {
    reportError(e);
  }
  let done = false;
  return {
    undo: async () => {
      if (done) return;
      done = true;
      emit({
        items: [
          ...state.items.map((i) => affected.find((a) => a.before.id === i.id)?.before ?? i),
          cur,
        ],
      });
      try {
        await withDB(async (db) => {
          const tx = db.transaction('items', 'readwrite');
          await Promise.all([tx.store.put(cur), ...affected.map((a) => tx.store.put(a.before))]);
          await tx.done;
        });
      } catch (e) {
        reportError(e);
      }
    },
    commit: () => {
      if (done) return;
      done = true;
      const blobIds = cur.photos.filter((p) => p.kind === 'blob').map((p) => p.ref);
      const stillUsed = new Set(
        state.items.flatMap((i) => i.photos.filter((p) => p.kind === 'blob').map((p) => p.ref)),
      );
      blobIds.filter((b) => !stillUsed.has(b)).forEach((b) => void deleteBlob(b));
    },
  };
}

// ---------------------------------------------------------------------------
// Catégories
// ---------------------------------------------------------------------------

export async function saveCategory(cat: Category) {
  const exists = state.categories.some((c) => c.id === cat.id);
  emit({
    categories: exists ? state.categories.map((c) => (c.id === cat.id ? cat : c)) : [...state.categories, cat],
  });
  try {
    await withDB((db) => db.put('categories', cat));
  } catch (e) {
    reportError(e);
  }
}

export function newCategory(section: Category['section'], name: string): Category {
  const order = Math.max(0, ...state.categories.filter((c) => c.section === section).map((c) => c.order)) + 1;
  return { id: uid('cat'), section, name, order };
}

/** Supprime une catégorie ; ses éléments passent « Sans catégorie ». */
export async function deleteCategory(id: string) {
  const affected = state.items.filter((i) => i.categoryId === id).map((i) => ({ ...i, categoryId: null }));
  emit({
    categories: state.categories.filter((c) => c.id !== id),
    items: state.items.map((i) => affected.find((a) => a.id === i.id) ?? i),
  });
  try {
    await withDB(async (db) => {
      const tx = db.transaction(['categories', 'items'], 'readwrite');
      await Promise.all([
        tx.objectStore('categories').delete(id),
        ...affected.map((a) => tx.objectStore('items').put(a)),
      ]);
      await tx.done;
    });
  } catch (e) {
    reportError(e);
  }
}

// ---------------------------------------------------------------------------
// Images importées
// ---------------------------------------------------------------------------

export async function putBlob(blob: Blob): Promise<string> {
  const id = uid('img');
  const rec: StoredBlob = { id, blob, type: blob.type, createdAt: Date.now() };
  await withDB((db) => db.put('blobs', rec));
  return id;
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  const rec = await withDB((db) => db.get('blobs', id));
  return rec?.blob;
}

export async function deleteBlob(id: string) {
  try {
    await withDB((db) => db.delete('blobs', id));
  } catch {
    /* sans gravité */
  }
}

// ---------------------------------------------------------------------------
// Remplacement complet (restauration d'une sauvegarde)
// ---------------------------------------------------------------------------

export async function replaceAll(items: Item[], categories: Category[], blobs: StoredBlob[]) {
  await withDB(async (db) => {
    const tx = db.transaction(['items', 'categories', 'blobs', 'meta'], 'readwrite');
    await Promise.all([
      tx.objectStore('items').clear(),
      tx.objectStore('categories').clear(),
      tx.objectStore('blobs').clear(),
    ]);
    const seededIds = ((await tx.objectStore('meta').get('seededIds')) as string[] | undefined) ?? [];
    await Promise.all([
      ...items.map((i) => tx.objectStore('items').put(i)),
      ...categories.map((c) => tx.objectStore('categories').put(c)),
      ...blobs.map((b) => tx.objectStore('blobs').put(b)),
      // Tous les exemples actuels sont considérés comme déjà proposés : aucune réinjection après restauration.
      tx
        .objectStore('meta')
        .put(
          [...new Set([...seededIds, ...SEED_ITEMS.map((i) => i.id), ...SEED_CATEGORIES.map((c) => c.id)])],
          'seededIds',
        ),
      tx.objectStore('meta').put(DATA_VERSION, 'dataVersion'),
    ]);
    await tx.done;
  });
  emit({ items, categories, loadError: null });
}

export async function allBlobs(): Promise<StoredBlob[]> {
  return withDB((db) => db.getAll('blobs'));
}

/** Remet les inspirations de départ manquantes (à la demande explicite d'Ophélie). */
export async function restoreMissingSeeds(): Promise<number> {
  const have = new Set(state.items.map((i) => i.id));
  const haveCats = new Set(state.categories.map((c) => c.id));
  const missing = SEED_ITEMS.filter((i) => !have.has(i.id));
  const missingCats = SEED_CATEGORIES.filter((c) => !haveCats.has(c.id));
  const now = Date.now();
  const fresh = missing.map((i) => ({ ...i, createdAt: now, updatedAt: now }));
  try {
    await withDB(async (db) => {
      const tx = db.transaction(['items', 'categories'], 'readwrite');
      await Promise.all([
        ...fresh.map((i) => tx.objectStore('items').put(i)),
        ...missingCats.map((c) => tx.objectStore('categories').put(c)),
      ]);
      await tx.done;
    });
    emit({ items: [...state.items, ...fresh], categories: [...state.categories, ...missingCats] });
  } catch (e) {
    reportError(e);
  }
  return fresh.length;
}

export async function eraseEverything() {
  await withDB(async (db) => {
    const tx = db.transaction(['items', 'categories', 'blobs'], 'readwrite');
    await Promise.all([
      tx.objectStore('items').clear(),
      tx.objectStore('categories').clear(),
      tx.objectStore('blobs').clear(),
    ]);
    await tx.done;
  });
  emit({ items: [], categories: [] });
}

export { getMeta, setMeta };
