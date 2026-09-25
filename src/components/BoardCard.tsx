import { memo } from 'react';
import type { Item } from '../types';
import { cardSize } from '../data/boards';
import { hashNum, formatDate } from '../lib/util';
import { DECO_STATUS, PRIORITY, PROJET_STATUS, TRAVEL_STATUS, VETEMENT_STATUS, typeLabel } from '../lib/labels';
import { Photo } from './Photo';

interface Props {
  item: Item;
  byId: Map<string, Item>;
  organize: boolean;
  onOpen: (id: string) => void;
}

export const BoardCard = memo(function BoardCard({ item, byId, organize, onOpen }: Props) {
  const { w } = cardSize(item);
  const tilt = (hashNum(item.id) - 0.5) * 4;
  const cls = `card card-${item.type} ${item.format ? `fmt-${item.format}` : ''} ${
    item.type === 'note' ? `note-${item.noteColor ?? 'cream'}` : ''
  }`;

  return (
    <button
      type="button"
      className={cls}
      data-card={item.id}
      style={{ left: item.x, top: item.y, width: w, ['--tilt' as string]: `${tilt}deg` }}
      onClick={() => {
        if (!organize) onOpen(item.id);
      }}
      aria-label={`${typeLabel(item)} : ${item.title || 'sans titre'}${organize ? ' (mode Organiser : flèches pour déplacer)' : ''}`}
    >
      <CardBody item={item} byId={byId} />
      {item.favorite && (
        <span className="card-fav" aria-hidden="true">
          ♥
        </span>
      )}
    </button>
  );
});

function CardBody({ item, byId }: { item: Item; byId: Map<string, Item> }) {
  const first = item.photos[0];
  switch (item.type) {
    case 'note':
      return (
        <>
          <span className="tape" aria-hidden="true" />
          {first && <Photo photo={first} alt="" className="card-photo" />}
          {item.title && <span className="note-title">{item.title}</span>}
          {item.notes && <span className="note-text">{item.notes}</span>}
        </>
      );
    case 'tenue': {
      const parts = (item.itemIds ?? []).map((id) => byId.get(id)).filter(Boolean).slice(0, 4) as Item[];
      return (
        <>
          <span className={`collage n${Math.max(1, parts.length)}`}>
            {parts.length === 0 && <span className="collage-empty">Choisir des vêtements</span>}
            {parts.map((p) => (
              <Photo key={p.id} photo={p.photos[0]} alt="" className="collage-cell" fallbackLabel={p.title} />
            ))}
          </span>
          <span className="card-title">{item.title || 'Tenue'}</span>
          {item.occasion && <span className="card-meta">{item.occasion}</span>}
        </>
      );
    }
    case 'capsule': {
      const parts = (item.itemIds ?? []).map((id) => byId.get(id)).filter(Boolean) as Item[];
      return (
        <>
          <span className="card-kicker">Capsule · {parts.length} pièce{parts.length > 1 ? 's' : ''}</span>
          <span className="card-title">{item.title || 'Capsule'}</span>
          <span className="capsule-strip">
            {parts.slice(0, 6).map((p) => (
              <Photo key={p.id} photo={p.photos[0]} alt="" className="capsule-cell" fallbackLabel={p.title} />
            ))}
          </span>
        </>
      );
    }
    case 'classe':
      if (item.format === 'objectif') {
        const list = item.checklist ?? [];
        const done = list.filter((c) => c.done).length;
        const pct = list.length ? Math.round((done / list.length) * 100) : item.projetStatus === 'realise' ? 100 : 0;
        return (
          <>
            <span className="card-kicker">{PROJET_STATUS[item.projetStatus ?? 'idee']}</span>
            <span className="card-title">{item.title || 'Objectif'}</span>
            <span className="progress" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </span>
            <span className="card-meta">
              {list.length ? `${done} / ${list.length} étapes` : 'Aucune étape'}
              {item.dueDate ? ` · pour le ${formatDate(item.dueDate)}` : ''}
            </span>
          </>
        );
      }
      if (item.format === 'envie') {
        return (
          <>
            {first && <Photo photo={first} alt="" className="card-photo" />}
            <span className={`card-kicker prio-${item.priority ?? 'moyenne'}`}>{PRIORITY[item.priority ?? 'moyenne']}</span>
            <span className="card-title">{item.title || 'Envie'}</span>
          </>
        );
      }
      return (
        <>
          {first ? (
            <Photo photo={first} alt="" className="card-photo" fallbackLabel={item.title} />
          ) : (
            <span className="card-kicker">{typeLabel(item)}</span>
          )}
          {first && item.format === 'activite' && <span className="card-badge">Activité</span>}
          <span className="card-title">{item.title || 'Sans titre'}</span>
          {item.level && <span className="card-meta">{item.level}</span>}
        </>
      );
    case 'destination':
      return (
        <>
          <Photo photo={first} alt="" className="card-photo" fallbackLabel={item.title} />
          <span className={`card-badge travel-${item.travelStatus ?? 'a-decouvrir'}`}>
            {TRAVEL_STATUS[item.travelStatus ?? 'a-decouvrir']}
          </span>
          <span className="card-title">{item.title}</span>
          <span className="card-meta">
            {item.country}
            {item.suggestion ? ' · suggestion' : ''}
          </span>
        </>
      );
    case 'vetement':
      return (
        <>
          <Photo photo={first} alt="" className="card-photo tall" fallbackLabel={item.title} />
          <span className={`card-badge vet-${item.vetementStatus ?? 'envie'}`}>
            {VETEMENT_STATUS[item.vetementStatus ?? 'envie']}
          </span>
          <span className="card-title">{item.title}</span>
        </>
      );
    default:
      return (
        <>
          {first ? (
            <Photo photo={first} alt="" className="card-photo" fallbackLabel={item.title} />
          ) : (
            <span className="card-kicker">Inspiration</span>
          )}
          {item.decoStatus && item.decoStatus !== 'inspiration' && (
            <span className={`card-badge deco-${item.decoStatus}`}>{DECO_STATUS[item.decoStatus]}</span>
          )}
          <span className="card-title">{item.title || 'Sans titre'}</span>
        </>
      );
  }
}
