import { useEffect, useState } from 'react';
import type { Photo } from '../types';
import { getBlob, putBlob } from '../db/store';
import credits from '../data/credits.json';

export interface Credit {
  key: string;
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
}

export const CREDITS: Credit[] = credits as Credit[];
const creditByKey = new Map(CREDITS.map((c) => [c.key, c]));

export const creditFor = (key: string) => creditByKey.get(key);

const BASE = import.meta.env.BASE_URL;

/** URL d'une image de départ, ou null si elle n'a pas encore été récupérée. */
export function seedUrl(key: string, size: 'small' | 'large'): string | null {
  if (!creditByKey.has(key)) return null;
  return `${BASE}images/${key}${size === 'small' ? '-s' : ''}.webp`;
}

// Cache des URL d'objets pour les images importées
const objectUrls = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

async function blobUrl(id: string): Promise<string | null> {
  const known = objectUrls.get(id);
  if (known) return known;
  let p = pending.get(id);
  if (!p) {
    p = getBlob(id)
      .then((b) => {
        if (!b) return null;
        const url = URL.createObjectURL(b);
        objectUrls.set(id, url);
        return url;
      })
      .catch(() => null)
      .finally(() => pending.delete(id));
    pending.set(id, p);
  }
  return p;
}

export function usePhotoUrl(photo: Photo | undefined, size: 'small' | 'large' = 'small'): {
  url: string | null;
  loading: boolean;
} {
  const sync =
    !photo ? null : photo.kind === 'seed' ? seedUrl(photo.ref, size) : (objectUrls.get(photo.ref) ?? undefined);
  const [state, setState] = useState<{ ref?: string; url: string | null }>({ url: null });

  useEffect(() => {
    if (!photo || photo.kind !== 'blob' || objectUrls.has(photo.ref)) return;
    let alive = true;
    void blobUrl(photo.ref).then((url) => alive && setState({ ref: photo.ref, url }));
    return () => {
      alive = false;
    };
  }, [photo]);

  if (sync !== undefined) return { url: sync, loading: false };
  if (photo && state.ref === photo.ref) return { url: state.url, loading: false };
  return { url: null, loading: true };
}

// ---------------------------------------------------------------------------
// Compression des photos importées
// ---------------------------------------------------------------------------

const MAX_SIDE = 1600;
const QUALITY = 0.82;

async function decode(file: Blob): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; close: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return {
        width: bmp.width,
        height: bmp.height,
        draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h),
        close: () => bmp.close(),
      };
    } catch {
      /* repli sur <img> ci-dessous */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      close: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/** Redimensionne et compresse une photo (JPEG, 1600 px maximum). */
export async function compressImage(file: Blob): Promise<Blob> {
  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new Error('Ce fichier ne semble pas être une image lisible par le navigateur.');
  }
  try {
    const ratio = Math.min(1, MAX_SIDE / Math.max(decoded.width, decoded.height));
    const w = Math.max(1, Math.round(decoded.width * ratio));
    const h = Math.max(1, Math.round(decoded.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Compression impossible');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    decoded.draw(ctx, w, h);
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', QUALITY));
    // Si la compression n'apporte rien (petite image), on garde l'original
    if (!out) return file;
    return out.size < file.size || ratio < 1 ? out : file;
  } finally {
    decoded.close();
  }
}

/** Importe un fichier image : compression puis stockage dans IndexedDB. */
export async function importImageFile(file: Blob): Promise<Photo> {
  const compressed = await compressImage(file);
  const id = await putBlob(compressed);
  return { id, kind: 'blob', ref: id };
}

export class RemoteImageError extends Error {}

/** Tente de récupérer une image distante. Beaucoup de sites l'interdisent (CORS) : on l'explique simplement. */
export async function importImageUrl(url: string): Promise<Photo> {
  let res: Response;
  try {
    res = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch {
    throw new RemoteImageError(
      'Ce site ne permet pas de récupérer son image depuis une autre application. Enregistrez la photo sur votre téléphone (appui long sur l’image → « Enregistrer »), puis ajoutez-la avec « Depuis mon appareil ».',
    );
  }
  if (!res.ok) {
    throw new RemoteImageError(`L’image n’a pas pu être téléchargée (erreur ${res.status}). Vérifiez le lien ou importez la photo depuis votre appareil.`);
  }
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) {
    throw new RemoteImageError(
      'Ce lien mène à une page web et non directement à une image. Ouvrez l’image seule et copiez son adresse, ou importez la photo depuis votre appareil.',
    );
  }
  return importImageFile(blob);
}
