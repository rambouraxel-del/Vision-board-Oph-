import type { Item, ItemType } from '../types';
import { cardSize, defaultZoneFor, universeOfType, zoneById } from '../data/boards';
import { uid } from './util';

export function newItem(type: ItemType, opts: { zoneId?: string; preset?: Partial<Item> } = {}): Item {
  const now = Date.now();
  const format = opts.preset?.format;
  const zoneAllows = opts.zoneId && zoneById(opts.zoneId)?.adds.some((a) => a.type === type && (!a.preset?.format || a.preset.format === format));
  const universe = universeOfType(type, opts.zoneId);
  const zone = zoneAllows ? opts.zoneId! : defaultZoneFor(type, format, universe);
  const base: Item = {
    id: uid(type),
    type,
    universe: universeOfType(type, zone),
    zone,
    x: 0,
    y: 0,
    title: '',
    description: '',
    notes: '',
    tags: [],
    favorite: false,
    photos: [],
    links: [],
    categoryId: null,
    price: null,
    createdAt: now,
    updatedAt: now,
  };
  switch (type) {
    case 'deco':
      base.decoStatus = 'inspiration';
      break;
    case 'vetement':
      base.vetementStatus = 'envie';
      base.color = '';
      base.season = '';
      break;
    case 'tenue':
    case 'capsule':
      base.itemIds = [];
      base.occasion = '';
      break;
    case 'classe':
      base.format = 'fiche';
      base.checklist = [];
      base.steps = [];
      base.projetStatus = 'idee';
      base.priority = 'moyenne';
      break;
    case 'note':
      base.noteColor = universeOfType(type, zone) === 'horizons' ? 'yellow' : 'cream';
      break;
    case 'destination':
      base.travelStatus = 'a-decouvrir';
      base.checklist = [];
      base.lat = null;
      base.lng = null;
      base.budget = [
        { id: uid('bud'), poste: 'Transport', montant: null },
        { id: uid('bud'), poste: 'Hébergement', montant: null },
        { id: uid('bud'), poste: 'Repas', montant: null },
        { id: uid('bud'), poste: 'Activités', montant: null },
      ];
      base.expenses = [];
      break;
  }
  return { ...base, ...opts.preset, zone, universe: universeOfType(type, zone) };
}

/** Cherche un emplacement libre dans la zone pour une nouvelle carte. */
export function placeInZone(item: Item, all: Item[]): { x: number; y: number } {
  const z = zoneById(item.zone);
  if (!z) return { x: 100, y: 100 };
  const { w, h } = cardSize(item);
  const others = all.filter((i) => i.zone === item.zone && i.id !== item.id);
  const top = z.y + 130;
  const step = 30;
  const free = (x: number, y: number) =>
    others.every((o) => {
      const s = cardSize(o);
      return x + w + 16 <= o.x || o.x + s.w + 16 <= x || y + h + 16 <= o.y || o.y + s.h + 16 <= y;
    });
  for (let y = top; y + h <= z.y + z.h - 10; y += step) {
    for (let x = z.x + 40; x + w <= z.x + z.w - 20; x += step) {
      if (free(x, y)) return { x, y };
    }
  }
  // Zone pleine : on superpose légèrement, en décalant
  const n = others.length;
  return { x: z.x + 40 + ((n * 37) % Math.max(40, z.w - w - 60)), y: top + ((n * 53) % Math.max(40, z.h - h - 150)) };
}
