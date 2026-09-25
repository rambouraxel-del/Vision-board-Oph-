import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Category, Item } from '../types';

export interface StoredBlob {
  id: string;
  blob: Blob;
  type: string;
  createdAt: number;
}

interface UniversDB extends DBSchema {
  items: { key: string; value: Item };
  categories: { key: string; value: Category };
  blobs: { key: string; value: StoredBlob };
  meta: { key: string; value: unknown };
}

const DB_NAME = 'univers-ophelie';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<UniversDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<UniversDB>> {
  if (!dbPromise) {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new StorageError('unavailable'));
    }
    dbPromise = openDB<UniversDB>(DB_NAME, DB_VERSION, {
      // Les évolutions futures ajoutent des magasins ici sans jamais supprimer les données existantes.
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('items', { keyPath: 'id' });
          db.createObjectStore('categories', { keyPath: 'id' });
          db.createObjectStore('blobs', { keyPath: 'id' });
          db.createObjectStore('meta');
        }
      },
      blocked() {
        // Une autre fenêtre utilise une ancienne version : elle se fermera à la mise à jour.
      },
      blocking() {
        // Une nouvelle version de l'application s'ouvre ailleurs : on libère la base.
        dbPromise?.then((d) => d.close());
        dbPromise = null;
      },
    }).catch((e) => {
      dbPromise = null;
      throw toStorageError(e);
    });
  }
  return dbPromise;
}

export class StorageError extends Error {
  kind: 'quota' | 'unavailable' | 'unknown';
  constructor(kind: 'quota' | 'unavailable' | 'unknown', cause?: unknown) {
    super(storageMessage(kind));
    this.kind = kind;
    this.cause = cause;
  }
}

export function storageMessage(kind: StorageError['kind']): string {
  switch (kind) {
    case 'quota':
      return 'L’espace de stockage de ce navigateur est plein. Supprimez quelques photos ou exportez une sauvegarde, puis réessayez.';
    case 'unavailable':
      return 'Le stockage de ce navigateur est indisponible (navigation privée ou réglages restrictifs ?). Vos modifications ne pourront pas être conservées.';
    default:
      return 'L’enregistrement a échoué. Réessayez ; si le problème persiste, exportez une sauvegarde.';
  }
}

export function toStorageError(e: unknown): StorageError {
  if (e instanceof StorageError) return e;
  const name = (e as { name?: string })?.name ?? '';
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return new StorageError('quota', e);
  }
  if (name === 'InvalidStateError' || name === 'SecurityError' || name === 'UnknownError') {
    return new StorageError('unavailable', e);
  }
  return new StorageError('unknown', e);
}

/** Exécute une opération de base de données et convertit ses erreurs en messages compréhensibles. */
export async function withDB<T>(fn: (db: IDBPDatabase<UniversDB>) => Promise<T>): Promise<T> {
  try {
    const db = await getDB();
    return await fn(db);
  } catch (e) {
    throw toStorageError(e);
  }
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return withDB((db) => db.get('meta', key) as Promise<T | undefined>);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await withDB((db) => db.put('meta', value, key));
}
