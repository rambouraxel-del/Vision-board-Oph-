import { useMemo, useState } from 'react';
import type { Item } from '../types';
import { useStore } from '../db/store';
import { useUI, type ListSection } from '../ui';
import { Sheet } from './Sheet';
import { Photo } from './Photo';
import { CLASSE_FORMAT, DECO_STATUS, TRAVEL_STATUS, displayTitle, typeLabel } from '../lib/labels';
import { formatPrice, matches } from '../lib/util';
import { newItem } from '../lib/factory';

const SECTIONS: { id: ListSection; label: string }[] = [
  { id: 'deco', label: 'Décoration' },
  { id: 'dressing', label: 'Dressing' },
  { id: 'classe', label: 'Maîtresse' },
  { id: 'voyages', label: 'Voyages' },
  { id: 'notes', label: 'Notes' },
  { id: 'favoris', label: '♥ Favoris' },
];

const inSection = (i: Item, s: ListSection) => {
  switch (s) {
    case 'deco':
      return i.type === 'deco';
    case 'dressing':
      return i.type === 'vetement' || i.type === 'tenue' || i.type === 'capsule';
    case 'classe':
      return i.type === 'classe';
    case 'voyages':
      return i.type === 'destination';
    case 'notes':
      return i.type === 'note';
    case 'favoris':
      return i.favorite;
  }
};

/** Vue liste : alternative accessible au tableau, pour tout retrouver rapidement. */
export function ListView({ initial, top }: { initial?: ListSection; top: boolean }) {
  const ui = useUI();
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const [section, setSection] = useState<ListSection>(initial ?? 'deco');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');

  const catSection = section === 'deco' ? 'deco' : section === 'dressing' ? 'dressing' : section === 'classe' ? 'classe' : null;
  const cats = useMemo(
    () => (catSection ? categories.filter((c) => c.section === catSection).sort((a, b) => a.order - b.order) : []),
    [categories, catSection],
  );
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const base = items.filter((i) => inSection(i, section));
  const tags = [...new Set(base.flatMap((i) => i.tags))].sort((a, b) => a.localeCompare(b, 'fr'));

  const statusOptions: [string, string][] =
    section === 'deco'
      ? Object.entries(DECO_STATUS)
      : section === 'voyages'
        ? Object.entries(TRAVEL_STATUS)
        : section === 'classe'
          ? Object.entries(CLASSE_FORMAT)
          : section === 'dressing'
            ? [
                ['possede', 'Dans mon dressing'],
                ['envie', 'Envies'],
                ['tenue', 'Tenues'],
                ['capsule', 'Capsules'],
              ]
            : [];

  const statusOf = (i: Item) =>
    section === 'deco'
      ? i.decoStatus
      : section === 'voyages'
        ? i.travelStatus
        : section === 'classe'
          ? i.format
          : section === 'dressing'
            ? i.type === 'vetement'
              ? i.vetementStatus
              : i.type
            : undefined;

  const list = base
    .filter(
      (i) =>
        matches(q, i.title, i.description, i.notes, i.tags.join(' '), i.country, i.color, i.brand) &&
        (!cat || (cat === 'none' ? !i.categoryId : i.categoryId === cat)) &&
        (!status || statusOf(i) === status) &&
        (!tag || i.tags.includes(tag)),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title, 'fr'));

  const changeSection = (s: ListSection) => {
    setSection(s);
    setCat('');
    setStatus('');
    setTag('');
  };

  const addType =
    section === 'deco' ? 'deco' : section === 'classe' ? 'classe' : section === 'voyages' ? 'destination' : section === 'notes' ? 'note' : section === 'dressing' ? 'vetement' : null;

  return (
    <Sheet title="Tous mes contenus" onClose={ui.close} top={top} size="full" className="listview">
      <div className="tabs scroll" role="tablist" aria-label="Rubriques">
        {SECTIONS.map((s) => (
          <button key={s.id} role="tab" aria-selected={section === s.id} className={`tab ${section === s.id ? 'is-on' : ''}`} onClick={() => changeSection(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <input className="input search" type="search" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        {addType && (
          <button className="btn primary" onClick={() => ui.open({ kind: 'edit', draft: newItem(addType) })}>
            + Ajouter
          </button>
        )}
      </div>
      <div className="filters">
        {cats.length > 0 && (
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Catégorie">
            <option value="">Toutes catégories</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="none">Sans catégorie</option>
          </select>
        )}
        {statusOptions.length > 0 && (
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Statut ou type">
            <option value="">{section === 'classe' || section === 'dressing' ? 'Tous les types' : 'Tous les statuts'}</option>
            {statusOptions.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        )}
        {tags.length > 0 && (
          <select className="input" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Étiquette">
            <option value="">Toutes étiquettes</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
        )}
        {catSection && (
          <button className="btn ghost small" onClick={() => ui.open({ kind: 'categories', section: catSection })}>
            Catégories…
          </button>
        )}
        {section === 'dressing' && (
          <button className="btn soft small" onClick={() => ui.open({ kind: 'dressing' })}>
            Ouvrir le dressing
          </button>
        )}
        {section === 'voyages' && (
          <button className="btn soft small" onClick={() => ui.open({ kind: 'map' })}>
            Carte du monde
          </button>
        )}
      </div>
      <p className="count">
        {list.length} élément{list.length > 1 ? 's' : ''}
      </p>
      {list.length === 0 && <p className="empty">Rien ici pour l’instant.</p>}
      <ul className="rows">
        {list.map((i) => (
          <li key={i.id}>
            <button className="row" onClick={() => ui.open({ kind: 'item', id: i.id })}>
              <Photo photo={i.photos[0]} alt="" className="row-photo" fallbackLabel={i.title} />
              <span className="row-text">
                <strong>
                  {displayTitle(i)} {i.favorite && <span aria-label="favori">♥</span>}
                </strong>
                <span className="muted">
                  {[
                    typeLabel(i),
                    i.categoryId ? catName.get(i.categoryId) : null,
                    i.decoStatus ? DECO_STATUS[i.decoStatus] : null,
                    i.travelStatus ? TRAVEL_STATUS[i.travelStatus] : null,
                    i.country,
                    i.price !== null ? formatPrice(i.price) : null,
                    i.suggestion ? 'suggestion' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
