export function uid(prefix = 'id'): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  return `${prefix}_${rnd}`;
}

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export function formatPrice(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '';
  return euro.format(v);
}

/** Convertit une saisie libre (« 12,50 », « 12.5 € ») en nombre, ou null si vide / invalide. */
export function parseAmount(s: string): number | null {
  const cleaned = s.replace(/\s/g, '').replace('€', '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function amountToInput(v: number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v).replace('.', ',');
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function matches(query: string, ...fields: (string | undefined | null)[]): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  const hay = normalize(fields.filter(Boolean).join(' '));
  return q.split(/\s+/).every((w) => hay.includes(w));
}

/** Petite valeur pseudo-aléatoire stable dérivée d'un texte (inclinaison des cartes). */
export function hashNum(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000) / 1000;
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function safeUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function vibrate(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* non disponible */
  }
}

export const lsGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
export const lsSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible : simple confort, on ignore */
  }
};
