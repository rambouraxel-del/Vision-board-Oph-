import type { Category, Item } from '../types';
import type { StoredBlob } from './db';
import { DATA_VERSION, migrate, sanitizeCategory, sanitizeItem } from './migrations';
import { allBlobs, getState, replaceAll } from './store';

const FORMAT = 'univers-ophelie-sauvegarde';

interface BackupFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  items: unknown[];
  categories: unknown[];
  images: { id: string; type: string; data: string }[];
}

export interface BackupPreview {
  fileName: string;
  exportedAt: string;
  items: Item[];
  categories: Category[];
  blobs: StoredBlob[];
  skipped: number;
  missingImages: number;
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

function base64ToBlob(data: string, type: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Crée le fichier de sauvegarde complet (données + photos importées) et le télécharge. */
export async function exportBackup(): Promise<{ fileName: string; count: number; images: number }> {
  const { items, categories } = getState();
  const blobs = await allBlobs();
  const used = new Set(items.flatMap((i) => i.photos.filter((p) => p.kind === 'blob').map((p) => p.ref)));
  const images = [];
  for (const b of blobs) {
    if (!used.has(b.id)) continue;
    images.push({ id: b.id, type: b.type || b.blob.type || 'image/jpeg', data: await blobToBase64(b.blob) });
  }
  const file: BackupFile = {
    format: FORMAT,
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    items,
    categories,
    images,
  };
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `univers-ophelie-sauvegarde-${date}.json`;
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { fileName, count: items.length, images: images.length };
}

export class BackupError extends Error {}

/** Lit et valide une sauvegarde SANS rien modifier. */
export async function readBackup(file: File): Promise<BackupPreview> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new BackupError('Ce fichier n’est pas une sauvegarde lisible (format JSON attendu).');
  }
  const o = parsed as Partial<BackupFile>;
  if (!o || typeof o !== 'object' || o.format !== FORMAT) {
    throw new BackupError('Ce fichier n’est pas une sauvegarde de « L’univers d’Ophélie ».');
  }
  if (typeof o.version !== 'number' || o.version < 1) {
    throw new BackupError('La version de cette sauvegarde est inconnue.');
  }
  if (o.version > DATA_VERSION) {
    throw new BackupError(
      'Cette sauvegarde provient d’une version plus récente de l’application. Actualisez l’application puis réessayez.',
    );
  }
  if (!Array.isArray(o.items) || !Array.isArray(o.categories) || !Array.isArray(o.images)) {
    throw new BackupError('La sauvegarde est incomplète ou endommagée.');
  }

  const rawItems = o.items.map(sanitizeItem);
  const cleanItems = rawItems.filter((x): x is Item => x !== null);
  const cleanCats = o.categories.map(sanitizeCategory).filter((x): x is Category => x !== null);
  const { items, categories } = migrate({ items: cleanItems, categories: cleanCats }, o.version);

  const blobs: StoredBlob[] = [];
  for (const im of o.images) {
    if (!im || typeof im.id !== 'string' || typeof im.data !== 'string') continue;
    try {
      const type = typeof im.type === 'string' ? im.type : 'image/jpeg';
      blobs.push({ id: im.id, blob: base64ToBlob(im.data, type), type, createdAt: Date.now() });
    } catch {
      /* image illisible : signalée plus bas */
    }
  }
  const blobIds = new Set(blobs.map((b) => b.id));
  const needed = new Set(items.flatMap((i) => i.photos.filter((p) => p.kind === 'blob').map((p) => p.ref)));
  const missingImages = [...needed].filter((id) => !blobIds.has(id)).length;

  return {
    fileName: file.name,
    exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : '',
    items,
    categories,
    blobs,
    skipped: rawItems.length - cleanItems.length,
    missingImages,
  };
}

export async function applyBackup(p: BackupPreview) {
  await replaceAll(p.items, p.categories, p.blobs);
}
