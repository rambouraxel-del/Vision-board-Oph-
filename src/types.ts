export type Universe = 'cocon' | 'horizons';

/** Photo : soit une image de départ livrée avec l'application, soit une image importée (stockée dans IndexedDB). */
export interface Photo {
  id: string;
  kind: 'seed' | 'blob';
  /** seed : clé de l'image (public/images/<ref>.webp) ; blob : identifiant dans le magasin d'images */
  ref: string;
}

export interface LinkRef {
  id: string;
  label: string;
  url: string;
}

export interface CheckItem {
  id: string;
  text: string;
  done: boolean;
}

export interface BudgetLine {
  id: string;
  poste: string;
  montant: number | null;
}

export interface Expense {
  id: string;
  label: string;
  poste: string;
  montant: number | null;
  date: string;
}

export type ItemType =
  | 'deco'
  | 'vetement'
  | 'tenue'
  | 'capsule'
  | 'classe'
  | 'note'
  | 'destination';

export type DecoStatus = 'inspiration' | 'a-acheter' | 'achete';
export type VetementStatus = 'envie' | 'possede';
export type ClasseFormat = 'fiche' | 'activite' | 'objectif' | 'envie';
export type ProjetStatus = 'idee' | 'en-cours' | 'realise';
export type Priority = 'haute' | 'moyenne' | 'basse';
export type TravelStatus = 'a-decouvrir' | 'prevu' | 'visite';

export interface Item {
  id: string;
  type: ItemType;
  universe: Universe;
  zone: string;
  x: number;
  y: number;
  title: string;
  description: string;
  notes: string;
  tags: string[];
  favorite: boolean;
  photos: Photo[];
  links: LinkRef[];
  categoryId: string | null;
  price: number | null;
  /** Élément fourni comme inspiration de départ */
  seed?: boolean;
  createdAt: number;
  updatedAt: number;

  // Décoration
  decoStatus?: DecoStatus;
  // Dressing
  vetementStatus?: VetementStatus;
  color?: string;
  season?: string;
  brand?: string;
  size?: string;
  // Tenues et capsules
  occasion?: string;
  itemIds?: string[];
  // Maîtresse
  format?: ClasseFormat;
  level?: string;
  materials?: string;
  steps?: string[];
  checklist?: CheckItem[];
  dueDate?: string;
  projetStatus?: ProjetStatus;
  priority?: Priority;
  // Notes
  noteColor?: string;
  // Voyages
  country?: string;
  lat?: number | null;
  lng?: number | null;
  period?: string;
  travelStatus?: TravelStatus;
  budget?: BudgetLine[];
  expenses?: Expense[];
  suggestion?: boolean;
}

export type CategorySection = 'deco' | 'dressing' | 'classe';

export interface Category {
  id: string;
  section: CategorySection;
  name: string;
  order: number;
}

export interface Camera {
  x: number;
  y: number;
  s: number;
}
