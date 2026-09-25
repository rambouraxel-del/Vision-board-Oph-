import type { Item } from '../types';
import { deleteItem, patchItem, useStore } from '../db/store';
import { useUI } from '../ui';
import { Sheet } from './Sheet';
import { Photo } from './Photo';
import { ExpenseAdder } from './fields';
import {
  DECO_STATUS,
  PRIORITY,
  PROJET_STATUS,
  TRAVEL_STATUS,
  VETEMENT_STATUS,
  swatchFor,
  typeLabel,
} from '../lib/labels';
import { formatDate, formatPrice, hostOf } from '../lib/util';

interface Props {
  id: string;
  top: boolean;
  onShowOnBoard: (item: Item) => void;
}

export function ItemDetail({ id, top, onShowOnBoard }: Props) {
  const ui = useUI();
  const item = useStore((s) => s.items.find((i) => i.id === id));
  const all = useStore((s) => s.items);
  const cat = useStore((s) => s.categories.find((c) => c.id === item?.categoryId));

  if (!item) {
    return (
      <Sheet title="Élément introuvable" onClose={ui.close} top={top}>
        <p className="empty">Cet élément a été supprimé.</p>
      </Sheet>
    );
  }

  const remove = async () => {
    const res = await deleteItem(item.id);
    ui.close();
    if (res) {
      ui.toast({
        message: `« ${item.title || 'Élément'} » supprimé`,
        action: { label: 'Annuler', run: () => void res.undo() },
        onExpire: res.commit,
      });
    }
  };

  const parts = (item.itemIds ?? []).map((pid) => all.find((i) => i.id === pid)).filter(Boolean) as Item[];
  const usedIn = item.type === 'vetement' ? all.filter((i) => i.itemIds?.includes(item.id)) : [];

  return (
    <Sheet
      title={typeLabel(item)}
      onClose={ui.close}
      top={top}
      className={`detail detail-${item.type}`}
      headerExtra={
        <button
          className={`icon-btn fav-btn ${item.favorite ? 'is-on' : ''}`}
          aria-pressed={item.favorite}
          aria-label={item.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onClick={() => void patchItem(item.id, { favorite: !item.favorite })}
        >
          ♥
        </button>
      }
      footer={
        <>
          <button className="btn ghost danger-text" onClick={() => void remove()}>
            Supprimer
          </button>
          <button className="btn ghost" onClick={() => onShowOnBoard(item)}>
            Voir sur le tableau
          </button>
          <button className="btn primary" onClick={() => ui.open({ kind: 'edit', id: item.id })}>
            Modifier
          </button>
        </>
      }
    >
      {item.photos.length > 0 && (
        <div className={`gallery ${item.photos.length > 1 ? 'multi' : ''}`}>
          {item.photos.map((p, i) => (
            <Photo key={p.id} photo={p} size="large" alt={`${item.title} – photo ${i + 1}`} credit className="gallery-photo" fallbackLabel={item.title} />
          ))}
        </div>
      )}

      {(item.type === 'tenue' || item.type === 'capsule') && (
        <div className={`outfit-grid n${Math.min(parts.length, 6)}`}>
          {parts.length === 0 && <p className="empty">Aucun vêtement pour l’instant. Touchez « Modifier » pour en choisir.</p>}
          {parts.map((p) => (
            <button key={p.id} className="outfit-cell" onClick={() => ui.open({ kind: 'item', id: p.id })}>
              <Photo photo={p.photos[0]} alt={p.title} fallbackLabel={p.title} />
              <span>{p.title}</span>
            </button>
          ))}
        </div>
      )}

      <div className="detail-head">
        <h3 className="detail-title">{item.title || (item.type === 'note' ? 'Note' : 'Sans titre')}</h3>
        {item.seed && (
          <p className="seed-badge">{item.suggestion ? 'Suggestion de départ — à modifier ou supprimer' : 'Inspiration de départ — modifiable'}</p>
        )}
        <div className="chips-row">
          {cat && <span className="chip static">{cat.name}</span>}
          {item.decoStatus && <span className={`chip static deco-${item.decoStatus}`}>{DECO_STATUS[item.decoStatus]}</span>}
          {item.vetementStatus && <span className={`chip static vet-${item.vetementStatus}`}>{VETEMENT_STATUS[item.vetementStatus]}</span>}
          {item.type === 'classe' && item.format === 'objectif' && <span className="chip static">{PROJET_STATUS[item.projetStatus ?? 'idee']}</span>}
          {item.type === 'classe' && item.format === 'envie' && <span className={`chip static prio-${item.priority}`}>{PRIORITY[item.priority ?? 'moyenne']}</span>}
          {item.travelStatus && <span className={`chip static travel-${item.travelStatus}`}>{TRAVEL_STATUS[item.travelStatus]}</span>}
          {item.tags.map((t) => (
            <span key={t} className="chip static tag">
              #{t}
            </span>
          ))}
        </div>
      </div>

      {item.type === 'destination' && (
        <dl className="facts">
          {item.country && <Fact label="Pays" value={item.country} />}
          {item.period && <Fact label="Période envisagée" value={item.period} />}
          {item.lat != null && item.lng != null && (
            <Fact label="Coordonnées" value={`${item.lat.toFixed(3)}, ${item.lng.toFixed(3)}`} />
          )}
        </dl>
      )}

      {item.description && <p className="detail-text">{item.description}</p>}

      {item.type === 'vetement' && (
        <dl className="facts">
          {item.color && (
            <Fact
              label="Couleur"
              value={
                <>
                  {swatchFor(item.color) && <span className="swatch" style={{ background: swatchFor(item.color)! }} aria-hidden="true" />}
                  {item.color}
                </>
              }
            />
          )}
          {item.season && <Fact label="Saison" value={item.season} />}
          {item.brand && <Fact label="Marque" value={item.brand} />}
          {item.size && <Fact label="Taille" value={item.size} />}
          {item.price !== null && <Fact label="Prix" value={formatPrice(item.price)} />}
        </dl>
      )}

      {item.type === 'deco' && item.price !== null && (
        <dl className="facts">
          <Fact label="Prix indicatif" value={formatPrice(item.price)} />
        </dl>
      )}

      {item.type === 'tenue' && item.occasion && (
        <dl className="facts">
          <Fact label="Occasion" value={item.occasion} />
        </dl>
      )}

      {item.type === 'classe' && item.format === 'activite' && (
        <>
          <dl className="facts">
            {item.level && <Fact label="Niveau" value={item.level} />}
            {item.materials && <Fact label="Matériel" value={item.materials} />}
          </dl>
          {item.steps && item.steps.length > 0 && (
            <section className="detail-section">
              <h4>Étapes</h4>
              <ol className="steps">
                {item.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      {item.type === 'classe' && item.format === 'envie' && item.price !== null && (
        <dl className="facts">
          <Fact label="Prix" value={formatPrice(item.price)} />
        </dl>
      )}

      {item.type === 'classe' && item.format === 'objectif' && (
        <>
          {item.dueDate && (
            <dl className="facts">
              <Fact label="Échéance" value={formatDate(item.dueDate)} />
            </dl>
          )}
          <StatusSwitch item={item} />
          <Checklist item={item} title="Checklist" />
        </>
      )}

      {item.type === 'destination' && (
        <>
          <Checklist item={item} title="Activités et lieux à voir" />
          <Budget item={item} />
          <button className="btn soft block" onClick={() => ui.open({ kind: 'map', focusId: item.id })}>
            Voir sur la carte du monde
          </button>
        </>
      )}

      {item.notes && item.type !== 'note' && (
        <section className="detail-section">
          <h4>Notes</h4>
          <p className="detail-text pre">{item.notes}</p>
        </section>
      )}
      {item.type === 'note' && item.notes && <p className="detail-text pre note-hand">{item.notes}</p>}

      {item.links.length > 0 && (
        <section className="detail-section">
          <h4>Liens</h4>
          <ul className="links">
            {item.links.map((l) => (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.label || hostOf(l.url)} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {usedIn.length > 0 && (
        <section className="detail-section">
          <h4>Utilisé dans</h4>
          <div className="chips-row">
            {usedIn.map((u) => (
              <button key={u.id} className="chip" onClick={() => ui.open({ kind: 'item', id: u.id })}>
                {u.type === 'tenue' ? 'Tenue' : 'Capsule'} : {u.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {item.type === 'vetement' && (
        <button
          className="btn soft block"
          onClick={() => void patchItem(item.id, { vetementStatus: item.vetementStatus === 'possede' ? 'envie' : 'possede' })}
        >
          {item.vetementStatus === 'possede' ? 'Remettre dans mes envies' : 'Je l’ai ! Ranger dans mon dressing'}
        </button>
      )}
    </Sheet>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function StatusSwitch({ item }: { item: Item }) {
  const opts = Object.entries(PROJET_STATUS) as [NonNullable<Item['projetStatus']>, string][];
  return (
    <div className="segmented" role="radiogroup" aria-label="Statut du projet">
      {opts.map(([k, label]) => (
        <button
          key={k}
          role="radio"
          aria-checked={item.projetStatus === k}
          className={`seg ${item.projetStatus === k ? 'is-on' : ''}`}
          onClick={() => void patchItem(item.id, { projetStatus: k })}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Checklist({ item, title }: { item: Item; title: string }) {
  const list = item.checklist ?? [];
  const done = list.filter((c) => c.done).length;
  return (
    <section className="detail-section">
      <h4>
        {title} {list.length > 0 && <span className="muted">· {done}/{list.length}</span>}
      </h4>
      {list.length === 0 && <p className="empty">Rien pour l’instant — ajoutez des éléments avec « Modifier ».</p>}
      <ul className="checklist">
        {list.map((c) => (
          <li key={c.id}>
            <label className={c.done ? 'is-done' : ''}>
              <input
                type="checkbox"
                checked={c.done}
                onChange={(e) => {
                  const next = list.map((x) => (x.id === c.id ? { ...x, done: e.target.checked } : x));
                  const patch: Partial<Item> = { checklist: next };
                  // Un objectif dont toutes les étapes sont cochées passe à « Réalisé »
                  if (item.type === 'classe' && next.length && next.every((x) => x.done)) patch.projetStatus = 'realise';
                  else if (item.type === 'classe' && next.some((x) => x.done) && item.projetStatus === 'idee') patch.projetStatus = 'en-cours';
                  void patchItem(item.id, patch);
                }}
              />
              <span>{c.text}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Budget({ item }: { item: Item }) {
  const budget = item.budget ?? [];
  const expenses = item.expenses ?? [];
  const postes = [...new Set([...budget.map((b) => b.poste), ...expenses.map((e) => e.poste)])].filter(Boolean);
  const rows = postes.map((p) => {
    const planned = budget.filter((b) => b.poste === p && b.montant !== null).map((b) => b.montant!);
    const real = expenses.filter((e) => e.poste === p && e.montant !== null).map((e) => e.montant!);
    return {
      poste: p,
      planned: planned.length ? planned.reduce((a, b) => a + b, 0) : null,
      real: real.length ? real.reduce((a, b) => a + b, 0) : null,
    };
  });
  const plannedTotal = rows.filter((r) => r.planned !== null).reduce((a, r) => a + r.planned!, 0);
  const realTotal = rows.filter((r) => r.real !== null).reduce((a, r) => a + r.real!, 0);
  const anyPlanned = rows.some((r) => r.planned !== null);
  const anyReal = rows.some((r) => r.real !== null);

  return (
    <section className="detail-section">
      <h4>Budget</h4>
      {!anyPlanned && !anyReal && <p className="empty">Aucun montant renseigné. Indiquez un budget prévisionnel avec « Modifier », et ajoutez vos dépenses ci-dessous.</p>}
      {(anyPlanned || anyReal) && (
        <table className="budget-table">
          <thead>
            <tr>
              <th scope="col">Poste</th>
              <th scope="col">Prévu</th>
              <th scope="col">Réel</th>
              <th scope="col">Écart</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const diff = r.planned !== null && r.real !== null ? r.real - r.planned : null;
              return (
                <tr key={r.poste}>
                  <th scope="row">{r.poste}</th>
                  <td>{r.planned !== null ? formatPrice(r.planned) : '—'}</td>
                  <td>{r.real !== null ? formatPrice(r.real) : '—'}</td>
                  <td className={diff === null ? '' : diff > 0 ? 'over' : 'under'}>
                    {diff === null ? '—' : `${diff > 0 ? '+' : ''}${formatPrice(diff)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>{anyPlanned ? formatPrice(plannedTotal) : '—'}</td>
              <td>{anyReal ? formatPrice(realTotal) : '—'}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
      <p className="field-hint">Comparaison calculée uniquement à partir des montants renseignés.</p>

      <h4 className="sub">Dépenses</h4>
      {expenses.length > 0 && (
        <ul className="expenses">
          {expenses.map((e) => (
            <li key={e.id}>
              <span>
                <strong>{e.label}</strong>
                <span className="muted">
                  {' '}
                  · {e.poste}
                  {e.date ? ` · ${formatDate(e.date)}` : ''}
                </span>
              </span>
              <span className="expense-amount">{formatPrice(e.montant)}</span>
              <button
                className="icon-btn small"
                aria-label={`Supprimer la dépense ${e.label}`}
                onClick={() => void patchItem(item.id, { expenses: expenses.filter((x) => x.id !== e.id) })}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <ExpenseAdder
        postes={budget.map((b) => b.poste).filter(Boolean)}
        onAdd={(e) => void patchItem(item.id, { expenses: [...expenses, e] })}
      />
    </section>
  );
}
