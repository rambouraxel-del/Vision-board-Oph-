import type { ClasseFormat, DecoStatus, Item, ItemType, Priority, ProjetStatus, TravelStatus, VetementStatus } from '../types';

export const DECO_STATUS: Record<DecoStatus, string> = {
  inspiration: 'Inspiration',
  'a-acheter': 'À acheter',
  achete: 'Acheté',
};

export const VETEMENT_STATUS: Record<VetementStatus, string> = {
  envie: 'Envie',
  possede: 'Dans mon dressing',
};

export const PROJET_STATUS: Record<ProjetStatus, string> = {
  idee: 'Idée',
  'en-cours': 'En cours',
  realise: 'Réalisé',
};

export const PRIORITY: Record<Priority, string> = {
  haute: 'Priorité haute',
  moyenne: 'Priorité moyenne',
  basse: 'Priorité basse',
};

export const TRAVEL_STATUS: Record<TravelStatus, string> = {
  'a-decouvrir': 'À découvrir',
  prevu: 'Prévu',
  visite: 'Visité',
};

export const CLASSE_FORMAT: Record<ClasseFormat, string> = {
  fiche: 'Inspiration',
  activite: 'Activité',
  objectif: 'Objectif / projet',
  envie: 'Envie pour ma classe',
};

export const TYPE_LABEL: Record<ItemType, string> = {
  deco: 'Inspiration déco',
  vetement: 'Vêtement',
  tenue: 'Tenue',
  capsule: 'Capsule',
  classe: 'Maîtresse',
  note: 'Note',
  destination: 'Destination',
};

export function typeLabel(i: Item): string {
  if (i.type === 'classe' && i.format) return CLASSE_FORMAT[i.format];
  return TYPE_LABEL[i.type];
}

export const SEASONS = ['Printemps-été', 'Automne-hiver', 'Mi-saison', 'Toutes saisons'];

export const NOTE_COLORS: { id: string; label: string }[] = [
  { id: 'cream', label: 'Crème' },
  { id: 'sage', label: 'Sauge' },
  { id: 'pink', label: 'Rose' },
  { id: 'yellow', label: 'Jaune doux' },
  { id: 'turquoise', label: 'Turquoise' },
  { id: 'lilac', label: 'Lilas' },
];

export const PASTEL_SWATCHES: Record<string, string> = {
  blanc: '#fbfaf6',
  'blanc cassé': '#f4efe3',
  crème: '#f1e8d4',
  beige: '#e2d3b8',
  nude: '#e8cbb4',
  naturel: '#d9c29a',
  sauge: '#b9c7ae',
  'rose poudré': '#f0cfd2',
  rose: '#f3c3cf',
  lilas: '#d8c8e8',
  'bleu ciel': '#c7dff0',
  'bleu clair': '#a9c3dd',
  bleu: '#7c9cc4',
  jaune: '#f6e3a1',
  vert: '#9cbf9a',
  gris: '#c9c6c1',
  noir: '#3a3633',
  marine: '#39456b',
  camel: '#c49a6c',
  kaki: '#8c8a5e',
  terracotta: '#c9785a',
  corail: '#f19a84',
  taupe: '#b8a898',
  rouge: '#d9534f',
};

export function swatchFor(color?: string): string | null {
  if (!color) return null;
  const key = color.trim().toLowerCase();
  if (PASTEL_SWATCHES[key]) return PASTEL_SWATCHES[key];
  const found = Object.keys(PASTEL_SWATCHES).find((k) => key.includes(k));
  return found ? PASTEL_SWATCHES[found] : null;
}

/** Titre à afficher (une note sans titre utilise le début de son texte). */
export function displayTitle(i: Item): string {
  if (i.title) return i.title;
  if (i.type === 'note' && i.notes) return i.notes.length > 48 ? `${i.notes.slice(0, 46).trim()}…` : i.notes;
  return 'Sans titre';
}
