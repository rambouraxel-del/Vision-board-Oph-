import type { Item, ItemType, Universe } from '../types';

export interface Zone {
  id: string;
  universe: Universe;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Nom de la variable de couleur CSS utilisée pour la zone */
  tone: string;
  /** Types proposés par le bouton « + » dans cette zone (le premier est le type principal) */
  adds: AddChoice[];
}

export interface AddChoice {
  type: ItemType;
  label: string;
  preset?: Partial<Item>;
}

const NOTE: AddChoice = { type: 'note', label: 'Une note (texte et photo)' };

export const BOARD_SIZE: Record<Universe, { w: number; h: number }> = {
  cocon: { w: 2720, h: 2180 },
  horizons: { w: 2860, h: 2280 },
};

export const ZONES: Zone[] = [
  {
    id: 'deco',
    universe: 'cocon',
    title: 'Décoration',
    subtitle: 'Maisons bohèmes, provençales et chaleureuses',
    x: 80,
    y: 140,
    w: 1560,
    h: 1180,
    tone: 'sage',
    adds: [{ type: 'deco', label: 'Une inspiration déco' }, NOTE],
  },
  {
    id: 'dressing',
    universe: 'cocon',
    title: 'Dressing',
    subtitle: 'Garde-robe capsule aux tons pastel',
    x: 1720,
    y: 140,
    w: 920,
    h: 1180,
    tone: 'rose',
    adds: [{ type: 'vetement', label: 'Un vêtement ou une envie' }, NOTE],
  },
  {
    id: 'tenues',
    universe: 'cocon',
    title: 'Tenues & capsules',
    subtitle: 'Associer, composer, alléger',
    x: 1720,
    y: 1400,
    w: 920,
    h: 700,
    tone: 'lilac',
    adds: [
      { type: 'tenue', label: 'Une tenue' },
      { type: 'capsule', label: 'Une capsule' },
      NOTE,
    ],
  },
  {
    id: 'notes-cocon',
    universe: 'cocon',
    title: 'Carnet du cocon',
    subtitle: 'Idées, envies, petites notes',
    x: 80,
    y: 1400,
    w: 1560,
    h: 700,
    tone: 'linen',
    adds: [NOTE, { type: 'deco', label: 'Une inspiration déco' }],
  },
  {
    id: 'classe',
    universe: 'horizons',
    title: 'Ma vie de maîtresse',
    subtitle: 'Classes, affichages, activités, écoles',
    x: 80,
    y: 140,
    w: 1640,
    h: 1120,
    tone: 'coral',
    adds: [
      { type: 'classe', label: 'Une inspiration de classe', preset: { format: 'fiche' } },
      { type: 'classe', label: 'Une idée d’activité', preset: { format: 'activite' } },
      NOTE,
    ],
  },
  {
    id: 'objectifs',
    universe: 'horizons',
    title: 'Objectifs & projets',
    subtitle: 'Pas à pas, vers la classe rêvée',
    x: 80,
    y: 1340,
    w: 800,
    h: 860,
    tone: 'turquoise',
    adds: [
      { type: 'classe', label: 'Un objectif ou projet', preset: { format: 'objectif' } },
      NOTE,
    ],
  },
  {
    id: 'future-classe',
    universe: 'horizons',
    title: 'Ma future classe',
    subtitle: 'La liste d’envies',
    x: 920,
    y: 1340,
    w: 800,
    h: 860,
    tone: 'yellow',
    adds: [
      { type: 'classe', label: 'Une envie pour ma classe', preset: { format: 'envie' } },
      NOTE,
    ],
  },
  {
    id: 'voyages',
    universe: 'horizons',
    title: 'Mes voyages',
    subtitle: 'Suggestions et projets d’ailleurs',
    x: 1800,
    y: 140,
    w: 980,
    h: 1400,
    tone: 'lilac',
    adds: [{ type: 'destination', label: 'Une destination' }, NOTE],
  },
  {
    id: 'notes-horizons',
    universe: 'horizons',
    title: 'Carnet des horizons',
    subtitle: 'Pensées et projets en vrac',
    x: 1800,
    y: 1620,
    w: 980,
    h: 580,
    tone: 'pink',
    adds: [NOTE],
  },
];

export const zonesOf = (u: Universe) => ZONES.filter((z) => z.universe === u);
export const zoneById = (id: string) => ZONES.find((z) => z.id === id);

/** Zone par défaut d'un nouvel élément selon son type. */
export function defaultZoneFor(type: ItemType, format?: string, universe?: Universe): string {
  switch (type) {
    case 'deco':
      return 'deco';
    case 'vetement':
      return 'dressing';
    case 'tenue':
    case 'capsule':
      return 'tenues';
    case 'destination':
      return 'voyages';
    case 'classe':
      if (format === 'objectif') return 'objectifs';
      if (format === 'envie') return 'future-classe';
      return 'classe';
    case 'note':
      return universe === 'horizons' ? 'notes-horizons' : 'notes-cocon';
  }
}

export function universeOfType(type: ItemType, zone?: string): Universe {
  if (zone) {
    const z = zoneById(zone);
    if (z) return z.universe;
  }
  return ['classe', 'destination'].includes(type) ? 'horizons' : 'cocon';
}

/** Dimensions approximatives d'une carte sur le tableau (pour le placement et le rendu limité). */
export function cardSize(item: Item): { w: number; h: number } {
  const hasPhoto = item.photos.length > 0;
  switch (item.type) {
    case 'note':
      return { w: 220, h: hasPhoto ? 290 : 190 };
    case 'tenue':
      return { w: 250, h: 300 };
    case 'capsule':
      return { w: 300, h: 210 };
    case 'vetement':
      return { w: 190, h: 250 };
    case 'classe':
      if (item.format === 'objectif') return { w: 250, h: 210 };
      if (item.format === 'envie') return { w: 230, h: hasPhoto ? 260 : 150 };
      return { w: 240, h: hasPhoto ? 280 : 170 };
    case 'destination':
      return { w: 260, h: 290 };
    default:
      return { w: 240, h: hasPhoto ? 290 : 170 };
  }
}

/** Carte spéciale (non déplaçable) qui ouvre la carte du monde. */
export const MAP_PORTAL = { x: 1840, y: 250, w: 900, h: 190 };
