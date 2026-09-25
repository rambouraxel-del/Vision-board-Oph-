import type { Category, Item, ItemType } from '../types';

/**
 * Version du format des données. À chaque évolution du modèle :
 *  1. incrémenter DATA_VERSION ;
 *  2. ajouter une fonction dans MIGRATIONS qui transforme la version précédente.
 * Les migrations s'appliquent aux données locales comme aux sauvegardes importées.
 */
export const DATA_VERSION = 1;

export interface DataSet {
  items: Item[];
  categories: Category[];
}

type Migration = (d: DataSet) => DataSet;

const MIGRATIONS: Record<number, Migration> = {
  // Exemple pour une future version 2 :
  // 2: (d) => ({ ...d, items: d.items.map((i) => ({ ...i, nouveauChamp: '' })) }),
};

export function migrate(data: DataSet, from: number): DataSet {
  let d = data;
  for (let v = from + 1; v <= DATA_VERSION; v++) {
    const m = MIGRATIONS[v];
    if (m) d = m(d);
  }
  return d;
}

const TYPES: ItemType[] = ['deco', 'vetement', 'tenue', 'capsule', 'classe', 'note', 'destination'];

const str = (v: unknown, def = ''): string => (typeof v === 'string' ? v : def);
const num = (v: unknown, def = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const arr = <T>(v: unknown, map: (x: unknown) => T | null): T[] =>
  Array.isArray(v) ? v.map(map).filter((x): x is T => x !== null) : [];
const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** Vérifie et complète un élément (données locales anciennes ou sauvegarde importée). Retourne null s'il est inutilisable. */
export function sanitizeItem(raw: unknown): Item | null {
  const o = obj(raw);
  if (!o) return null;
  const id = str(o.id);
  const type = str(o.type) as ItemType;
  if (!id || !TYPES.includes(type)) return null;
  const now = Date.now();
  const item: Item = {
    id,
    type,
    universe: o.universe === 'horizons' ? 'horizons' : 'cocon',
    zone: str(o.zone),
    x: num(o.x),
    y: num(o.y),
    z: num(o.z),
    title: str(o.title),
    description: str(o.description),
    notes: str(o.notes),
    tags: arr(o.tags, (t) => (typeof t === 'string' ? t : null)),
    favorite: o.favorite === true,
    photos: arr(o.photos, (p) => {
      const po = obj(p);
      if (!po) return null;
      const kind = po.kind === 'seed' ? 'seed' : po.kind === 'blob' ? 'blob' : null;
      if (!kind || !str(po.ref)) return null;
      return { id: str(po.id) || str(po.ref), kind, ref: str(po.ref) };
    }),
    links: arr(o.links, (l) => {
      const lo = obj(l);
      if (!lo || !str(lo.url)) return null;
      return { id: str(lo.id) || str(lo.url), label: str(lo.label), url: str(lo.url) };
    }),
    categoryId: typeof o.categoryId === 'string' ? o.categoryId : null,
    price: numOrNull(o.price),
    seed: o.seed === true,
    createdAt: num(o.createdAt, now),
    updatedAt: num(o.updatedAt, now),
  };
  const copyStr = (k: keyof Item) => {
    if (typeof o[k] === 'string') (item as unknown as Record<string, unknown>)[k] = o[k];
  };
  [
    'decoStatus',
    'vetementStatus',
    'color',
    'season',
    'brand',
    'size',
    'occasion',
    'format',
    'level',
    'materials',
    'dueDate',
    'projetStatus',
    'priority',
    'noteColor',
    'country',
    'period',
    'travelStatus',
  ].forEach((k) => copyStr(k as keyof Item));
  if (Array.isArray(o.itemIds)) item.itemIds = arr(o.itemIds, (x) => (typeof x === 'string' ? x : null));
  if (Array.isArray(o.steps)) item.steps = arr(o.steps, (x) => (typeof x === 'string' ? x : null));
  if (Array.isArray(o.checklist))
    item.checklist = arr(o.checklist, (c) => {
      const co = obj(c);
      if (!co) return null;
      return { id: str(co.id) || String(Math.random()), text: str(co.text), done: co.done === true };
    });
  if (Array.isArray(o.budget))
    item.budget = arr(o.budget, (b) => {
      const bo = obj(b);
      if (!bo) return null;
      return { id: str(bo.id) || String(Math.random()), poste: str(bo.poste), montant: numOrNull(bo.montant) };
    });
  if (Array.isArray(o.expenses))
    item.expenses = arr(o.expenses, (b) => {
      const bo = obj(b);
      if (!bo) return null;
      return {
        id: str(bo.id) || String(Math.random()),
        label: str(bo.label),
        poste: str(bo.poste),
        montant: numOrNull(bo.montant),
        date: str(bo.date),
      };
    });
  if ('lat' in o) item.lat = numOrNull(o.lat);
  if ('lng' in o) item.lng = numOrNull(o.lng);
  if (o.suggestion === true) item.suggestion = true;
  return item;
}

export function sanitizeCategory(raw: unknown): Category | null {
  const o = obj(raw);
  if (!o) return null;
  const id = str(o.id);
  const section = str(o.section);
  if (!id || !['deco', 'dressing', 'classe'].includes(section)) return null;
  return { id, section: section as Category['section'], name: str(o.name, 'Sans nom'), order: num(o.order) };
}
