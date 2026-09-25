import { useMemo, useState } from 'react';
import type { Item } from '../types';
import { patchItem, useStore } from '../db/store';
import { useUI, type DressingTab } from '../ui';
import { Sheet } from './Sheet';
import { Photo } from './Photo';
import { newItem } from '../lib/factory';
import { SEASONS, swatchFor } from '../lib/labels';
import { formatPrice, matches } from '../lib/util';

const TABS: { id: DressingTab; label: string }[] = [
  { id: 'vetements', label: 'Vêtements' },
  { id: 'tenues', label: 'Tenues' },
  { id: 'capsules', label: 'Capsules' },
  { id: 'achats', label: 'Liste d’achats' },
];

export function Dressing({ initialTab, top }: { initialTab?: DressingTab; top: boolean }) {
  const ui = useUI();
  const [tab, setTab] = useState<DressingTab>(initialTab ?? 'vetements');
  return (
    <Sheet title="Mon dressing" onClose={ui.close} top={top} size="full" className="dressing">
      <div className="tabs" role="tablist" aria-label="Sections du dressing">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'is-on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'vetements' && <Clothes />}
      {tab === 'tenues' && <Groups type="tenue" />}
      {tab === 'capsules' && <Groups type="capsule" />}
      {tab === 'achats' && <Shopping />}
    </Sheet>
  );
}

function Clothes() {
  const ui = useUI();
  const items = useStore((s) => s.items);
  const allCats = useStore((s) => s.categories);
  const cats = useMemo(() => allCats.filter((c) => c.section === 'dressing').sort((a, b) => a.order - b.order), [allCats]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'possede' | 'envie'>('all');
  const [cat, setCat] = useState('');
  const [season, setSeason] = useState('');
  const [color, setColor] = useState('');
  const [fav, setFav] = useState(false);

  const clothes = items.filter((i) => i.type === 'vetement');
  const colors = [...new Set(clothes.map((c) => c.color?.trim()).filter(Boolean))] as string[];
  const list = clothes
    .filter(
      (i) =>
        matches(q, i.title, i.color, i.brand, i.notes, i.tags.join(' ')) &&
        (status === 'all' || i.vetementStatus === status) &&
        (!cat || (cat === 'none' ? !i.categoryId : i.categoryId === cat)) &&
        (!season || i.season === season) &&
        (!color || i.color?.trim() === color) &&
        (!fav || i.favorite),
    )
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'));

  return (
    <div className="panel-section">
      <div className="toolbar">
        <input className="input search" type="search" placeholder="Rechercher (nom, couleur, marque…)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un vêtement" />
        <button className="btn primary" onClick={() => ui.open({ kind: 'edit', draft: newItem('vetement', { zoneId: 'dressing' }) })}>
          + Vêtement
        </button>
      </div>
      <div className="chips-row" role="group" aria-label="Statut">
        {(
          [
            ['all', 'Tout'],
            ['possede', 'Dans mon dressing'],
            ['envie', 'Envies'],
          ] as const
        ).map(([v, l]) => (
          <button key={v} className={`chip ${status === v ? 'is-on' : ''}`} aria-pressed={status === v} onClick={() => setStatus(v)}>
            {l}
          </button>
        ))}
        <button className={`chip ${fav ? 'is-on' : ''}`} aria-pressed={fav} onClick={() => setFav(!fav)}>
          ♥ Favoris
        </button>
      </div>
      <div className="filters">
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Catégorie">
          <option value="">Toutes catégories</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Sans catégorie</option>
        </select>
        <select className="input" value={season} onChange={(e) => setSeason(e.target.value)} aria-label="Saison">
          <option value="">Toutes saisons</option>
          {SEASONS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="input" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Couleur">
          <option value="">Toutes couleurs</option>
          {colors.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button className="btn ghost small" onClick={() => ui.open({ kind: 'categories', section: 'dressing' })}>
          Catégories…
        </button>
      </div>
      <p className="count">{list.length} vêtement{list.length > 1 ? 's' : ''}</p>
      {list.length === 0 && <p className="empty">Aucun vêtement ne correspond. Modifiez les filtres ou ajoutez-en un.</p>}
      <div className="thumb-grid">
        {list.map((i) => (
          <button key={i.id} className="thumb" onClick={() => ui.open({ kind: 'item', id: i.id })}>
            <Photo photo={i.photos[0]} alt="" fallbackLabel={i.title} />
            <span className="thumb-name">
              {swatchFor(i.color) && <span className="swatch" style={{ background: swatchFor(i.color)! }} aria-hidden="true" />}
              {i.title}
            </span>
            <span className={`thumb-status vet-${i.vetementStatus}`}>{i.vetementStatus === 'possede' ? 'À moi' : 'Envie'}</span>
            {i.favorite && <span className="card-fav" aria-label="favori">♥</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Groups({ type }: { type: 'tenue' | 'capsule' }) {
  const ui = useUI();
  const items = useStore((s) => s.items);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const groups = items.filter((i) => i.type === type).sort((a, b) => b.updatedAt - a.updatedAt);
  const label = type === 'tenue' ? 'tenue' : 'capsule';
  return (
    <div className="panel-section">
      <div className="toolbar">
        <p className="lead">
          {type === 'tenue'
            ? 'Associez plusieurs vêtements pour composer une tenue, avec son occasion.'
            : 'Regroupez des pièces qui vont bien ensemble pour construire une garde-robe capsule.'}
        </p>
        <button className="btn primary" onClick={() => ui.open({ kind: 'edit', draft: newItem(type, { zoneId: 'tenues' }) })}>
          + Créer une {label}
        </button>
      </div>
      {groups.length === 0 && <p className="empty">Aucune {label} pour l’instant.</p>}
      <div className="group-list">
        {groups.map((g) => {
          const parts = (g.itemIds ?? []).map((id) => byId.get(id)).filter(Boolean) as Item[];
          return (
            <button key={g.id} className="group-card" onClick={() => ui.open({ kind: 'item', id: g.id })}>
              <span className="group-thumbs">
                {parts.slice(0, 5).map((p) => (
                  <Photo key={p.id} photo={p.photos[0]} alt="" fallbackLabel={p.title} />
                ))}
                {parts.length === 0 && <span className="empty">Vide</span>}
              </span>
              <span className="group-text">
                <strong>{g.title || (type === 'tenue' ? 'Tenue' : 'Capsule')}</strong>
                <span className="muted">
                  {parts.length} pièce{parts.length > 1 ? 's' : ''}
                  {g.occasion ? ` · ${g.occasion}` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Shopping() {
  const ui = useUI();
  const items = useStore((s) => s.items);
  const wishes = items.filter((i) => i.type === 'vetement' && i.vetementStatus === 'envie').sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  const priced = wishes.filter((w) => w.price !== null);
  const total = priced.reduce((a, w) => a + (w.price ?? 0), 0);
  const unpriced = wishes.length - priced.length;

  return (
    <div className="panel-section">
      <div className="total-box" aria-live="polite">
        <span className="total-label">Total des prix renseignés</span>
        <strong className="total-value">{formatPrice(total)}</strong>
        <span className="muted">
          {priced.length} article{priced.length > 1 ? 's' : ''} avec prix
          {unpriced > 0 ? ` · ${unpriced} sans prix (non comptés)` : ''}
        </span>
      </div>
      {wishes.length === 0 && <p className="empty">Votre liste d’achats est vide. Les vêtements au statut « Envie » apparaissent ici.</p>}
      <ul className="shop-list">
        {wishes.map((w) => (
          <li key={w.id}>
            <button className="shop-main" onClick={() => ui.open({ kind: 'item', id: w.id })}>
              <Photo photo={w.photos[0]} alt="" fallbackLabel={w.title} />
              <span>
                <strong>{w.title}</strong>
                <span className={w.price === null ? 'muted' : 'price'}>{w.price === null ? 'Prix non renseigné' : formatPrice(w.price)}</span>
              </span>
            </button>
            <div className="shop-actions">
              {w.links[0] && (
                <a className="btn ghost small" href={w.links[0].url} target="_blank" rel="noopener noreferrer">
                  Boutique ↗
                </a>
              )}
              <button
                className="btn soft small"
                onClick={() => {
                  void patchItem(w.id, { vetementStatus: 'possede' });
                  ui.toast({
                    message: `« ${w.title} » rangé dans le dressing`,
                    action: { label: 'Annuler', run: () => void patchItem(w.id, { vetementStatus: 'envie' }) },
                  });
                }}
              >
                Acheté ✓
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
