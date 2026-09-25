import { useId, useRef, useState, type ReactNode } from 'react';
import type { BudgetLine, CheckItem, Expense, Item, LinkRef, Photo as PhotoT } from '../types';
import { amountToInput, formatPrice, hostOf, matches, parseAmount, safeUrl, uid } from '../lib/util';
import { importImageFile, importImageUrl, RemoteImageError } from '../lib/images';
import { Photo } from './Photo';

export function Field({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id?: string }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export function TextField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  hint?: string;
  autoFocus?: boolean;
  required?: boolean;
}) {
  const id = useId();
  return (
    <Field label={props.label} hint={props.hint} id={id}>
      <input
        id={id}
        className="input"
        type={props.type ?? 'text'}
        value={props.value}
        inputMode={props.inputMode}
        placeholder={props.placeholder}
        autoFocus={props.autoFocus}
        required={props.required}
        enterKeyHint="next"
        onChange={(e) => props.onChange(e.target.value)}
      />
    </Field>
  );
}

export function TextArea(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  const id = useId();
  return (
    <Field label={props.label} id={id}>
      <textarea
        id={id}
        className="input textarea"
        rows={props.rows ?? 3}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </Field>
  );
}

export function SelectField<T extends string>(props: {
  label: string;
  value: T | '';
  options: { value: T | ''; label: string }[];
  onChange: (v: T | '') => void;
  after?: ReactNode;
}) {
  const id = useId();
  return (
    <Field label={props.label} id={id}>
      <div className="select-row">
        <select id={id} className="input" value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {props.after}
      </div>
    </Field>
  );
}

export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="field">
      <legend className="field-label">{props.label}</legend>
      <div className="segmented" role="radiogroup">
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={props.value === o.value}
            className={`seg ${props.value === o.value ? 'is-on' : ''}`}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function AmountField(props: { label: string; value: number | null; onChange: (v: number | null) => void; hint?: string }) {
  const id = useId();
  const [text, setText] = useState(amountToInput(props.value));
  return (
    <Field label={props.label} hint={props.hint} id={id}>
      <div className="amount">
        <input
          id={id}
          className="input"
          inputMode="decimal"
          value={text}
          placeholder="Facultatif"
          onChange={(e) => {
            setText(e.target.value);
            props.onChange(parseAmount(e.target.value));
          }}
        />
        <span className="amount-unit">€</span>
      </div>
    </Field>
  );
}

export function TagsField({ value, onChange, suggestions = [] }: { value: string[]; onChange: (v: string[]) => void; suggestions?: string[] }) {
  const id = useId();
  const [text, setText] = useState('');
  const add = (t: string) => {
    const tag = t.trim().replace(/^#/, '');
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setText('');
  };
  const sugg = suggestions.filter((s) => !value.includes(s)).slice(0, 8);
  return (
    <Field label="Étiquettes" id={id}>
      <div className="tags-edit">
        {value.map((t) => (
          <button type="button" key={t} className="chip is-on" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Retirer l’étiquette ${t}`}>
            {t} ✕
          </button>
        ))}
        <input
          id={id}
          className="input tags-input"
          value={text}
          placeholder="Ajouter…"
          enterKeyHint="done"
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(',')) add(v.slice(0, -1));
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(text);
            }
          }}
          onBlur={() => text && add(text)}
        />
      </div>
      {sugg.length > 0 && (
        <div className="chips-row small">
          {sugg.map((s) => (
            <button type="button" key={s} className="chip" onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}

export function PhotosField({ value, onChange, single }: { value: PhotoT[]; onChange: (v: PhotoT[]) => void; single?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState('');
  const latest = useRef(value);
  latest.current = value;

  const addPhotos = (photos: PhotoT[]) => {
    const next = single ? photos.slice(-1) : [...latest.current, ...photos];
    onChange(next);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const added: PhotoT[] = [];
    try {
      for (const f of Array.from(files)) {
        added.push(await importImageFile(f));
      }
    } catch (e) {
      setError((e as Error).message || 'Impossible d’importer cette photo.');
    } finally {
      if (added.length) addPhotos(added);
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onUrl = async () => {
    const clean = safeUrl(url);
    if (!clean) {
      setError('Ce lien ne semble pas valide. Il doit commencer par https://');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      addPhotos([await importImageUrl(clean)]);
      setUrl('');
      setShowUrl(false);
    } catch (e) {
      setError(e instanceof RemoteImageError ? e.message : (e as Error).message || 'Récupération impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field">
      <span className="field-label">{single ? 'Photo' : 'Photos'}</span>
      {value.length > 0 && (
        <div className="photo-edit-grid">
          {value.map((p, i) => (
            <div key={p.id} className="photo-edit">
              <Photo photo={p} alt={`Photo ${i + 1}`} />
              <button type="button" className="photo-remove" onClick={() => onChange(value.filter((x) => x.id !== p.id))} aria-label={`Retirer la photo ${i + 1}`}>
                ✕
              </button>
              {i > 0 && !single && (
                <button
                  type="button"
                  className="photo-first"
                  onClick={() => onChange([p, ...value.filter((x) => x.id !== p.id)])}
                  aria-label="Mettre en photo principale"
                >
                  ★
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="photo-actions">
        <button type="button" className="btn soft" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Préparation…' : single && value.length ? 'Changer la photo' : 'Depuis mon appareil'}
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => setShowUrl((s) => !s)} aria-expanded={showUrl}>
          Depuis un lien
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple={!single} hidden onChange={(e) => void onFiles(e.target.files)} />
      </div>
      {showUrl && (
        <div className="url-row">
          <input
            className="input"
            type="url"
            inputMode="url"
            placeholder="https://… (adresse de l’image)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void onUrl();
              }
            }}
          />
          <button type="button" className="btn primary" disabled={busy || !url} onClick={() => void onUrl()}>
            Récupérer
          </button>
        </div>
      )}
      {showUrl && <p className="field-hint">Nécessite Internet. Certains sites bloquent la récupération : l’import depuis l’appareil fonctionne toujours.</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function LinksField({ value, onChange }: { value: LinkRef[]; onChange: (v: LinkRef[]) => void }) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [err, setErr] = useState('');
  const add = () => {
    const clean = safeUrl(url.includes('://') ? url : `https://${url}`);
    if (!clean) {
      setErr('Lien invalide.');
      return;
    }
    onChange([...value, { id: uid('lnk'), url: clean, label: label.trim() || hostOf(clean) }]);
    setUrl('');
    setLabel('');
    setErr('');
  };
  return (
    <div className="field">
      <span className="field-label">Liens (source, boutique, infos…)</span>
      {value.map((l) => (
        <div key={l.id} className="link-row">
          <a href={l.url} target="_blank" rel="noopener noreferrer">
            {l.label || hostOf(l.url)}
          </a>
          <button type="button" className="icon-btn small" onClick={() => onChange(value.filter((x) => x.id !== l.id))} aria-label={`Retirer le lien ${l.label}`}>
            ✕
          </button>
        </div>
      ))}
      <div className="link-add">
        <input className="input" type="url" inputMode="url" placeholder="Adresse du lien" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className="input" placeholder="Nom (facultatif)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button type="button" className="btn soft" onClick={add} disabled={!url.trim()}>
          Ajouter le lien
        </button>
      </div>
      {err && <p className="field-error">{err}</p>}
    </div>
  );
}

export function ChecklistEditor({ label, value, onChange, placeholder }: { label: string; value: CheckItem[]; onChange: (v: CheckItem[]) => void; placeholder?: string }) {
  const [text, setText] = useState('');
  const add = () => {
    if (!text.trim()) return;
    onChange([...value, { id: uid('chk'), text: text.trim(), done: false }]);
    setText('');
  };
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <ul className="check-edit">
        {value.map((c, i) => (
          <li key={c.id}>
            <input
              type="checkbox"
              checked={c.done}
              aria-label={`Fait : ${c.text}`}
              onChange={(e) => onChange(value.map((x) => (x.id === c.id ? { ...x, done: e.target.checked } : x)))}
            />
            <input
              className="input"
              value={c.text}
              aria-label={`Élément ${i + 1}`}
              onChange={(e) => onChange(value.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))}
            />
            <button type="button" className="icon-btn small" onClick={() => onChange(value.filter((x) => x.id !== c.id))} aria-label={`Supprimer ${c.text}`}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="inline-add">
        <input
          className="input"
          value={text}
          placeholder={placeholder ?? 'Nouvel élément'}
          enterKeyHint="done"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn soft" onClick={add} disabled={!text.trim()}>
          Ajouter
        </button>
      </div>
    </div>
  );
}

export function StepsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState('');
  const add = () => {
    if (!text.trim()) return;
    onChange([...value, text.trim()]);
    setText('');
  };
  return (
    <div className="field">
      <span className="field-label">Étapes (facultatif)</span>
      <ol className="steps-edit">
        {value.map((s, i) => (
          <li key={i}>
            <input className="input" value={s} aria-label={`Étape ${i + 1}`} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" className="icon-btn small" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Supprimer l’étape ${i + 1}`}>
              ✕
            </button>
          </li>
        ))}
      </ol>
      <div className="inline-add">
        <input
          className="input"
          value={text}
          placeholder="Nouvelle étape"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn soft" onClick={add} disabled={!text.trim()}>
          Ajouter
        </button>
      </div>
    </div>
  );
}

export function BudgetEditor({ value, onChange }: { value: BudgetLine[]; onChange: (v: BudgetLine[]) => void }) {
  return (
    <div className="field">
      <span className="field-label">Budget prévisionnel par poste</span>
      <ul className="budget-edit">
        {value.map((b) => (
          <li key={b.id}>
            <input className="input" value={b.poste} aria-label="Poste" onChange={(e) => onChange(value.map((x) => (x.id === b.id ? { ...x, poste: e.target.value } : x)))} />
            <MiniAmount value={b.montant} onChange={(m) => onChange(value.map((x) => (x.id === b.id ? { ...x, montant: m } : x)))} label={`Montant prévu pour ${b.poste}`} />
            <button type="button" className="icon-btn small" onClick={() => onChange(value.filter((x) => x.id !== b.id))} aria-label={`Supprimer le poste ${b.poste}`}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn soft" onClick={() => onChange([...value, { id: uid('bud'), poste: 'Nouveau poste', montant: null }])}>
        + Ajouter un poste
      </button>
    </div>
  );
}

export function MiniAmount({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  const [text, setText] = useState(amountToInput(value));
  return (
    <span className="amount mini">
      <input
        className="input"
        inputMode="decimal"
        value={text}
        placeholder="—"
        aria-label={label}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseAmount(e.target.value));
        }}
      />
      <span className="amount-unit">€</span>
    </span>
  );
}

export function ExpenseAdder({ postes, onAdd }: { postes: string[]; onAdd: (e: Expense) => void }) {
  const [label, setLabel] = useState('');
  const [poste, setPoste] = useState(postes[0] ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const m = parseAmount(amount);
  const submit = () => {
    if (m === null) return;
    onAdd({ id: uid('dep'), label: label.trim() || poste || 'Dépense', poste, montant: m, date });
    setLabel('');
    setAmount('');
  };
  return (
    <div className="expense-add">
      <input className="input" placeholder="Libellé (ex. billets de train)" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Libellé de la dépense" />
      <div className="expense-add-row">
        <select className="input" value={poste} onChange={(e) => setPoste(e.target.value)} aria-label="Poste">
          {postes.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value="Autre">Autre</option>
        </select>
        <span className="amount mini">
          <input className="input" inputMode="decimal" placeholder="Montant" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Montant" />
          <span className="amount-unit">€</span>
        </span>
      </div>
      <div className="expense-add-row">
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date (facultatif)" />
        <button type="button" className="btn primary" onClick={submit} disabled={m === null}>
          Ajouter la dépense
        </button>
      </div>
    </div>
  );
}

/** Sélection de vêtements pour une tenue ou une capsule. */
export function ItemPicker({ items, value, onChange }: { items: Item[]; value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const list = items.filter(
    (i) => matches(q, i.title, i.color, i.brand) && (!onlyMine || i.vetementStatus === 'possede'),
  );
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="field">
      <span className="field-label">
        Vêtements choisis : {value.length}
      </span>
      <div className="picker-tools">
        <input className="input" type="search" placeholder="Rechercher un vêtement" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un vêtement" />
        <label className="check-inline">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Seulement mon dressing
        </label>
      </div>
      {items.length === 0 && <p className="empty">Ajoutez d’abord des vêtements dans le dressing.</p>}
      <div className="picker-grid">
        {list.map((i) => {
          const on = value.includes(i.id);
          return (
            <button type="button" key={i.id} className={`picker-cell ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(i.id)}>
              <Photo photo={i.photos[0]} alt="" fallbackLabel={i.title} />
              <span className="picker-name">{i.title}</span>
              {on && (
                <span className="picker-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PriceLine({ value }: { value: number | null }) {
  return value !== null ? <span className="price">{formatPrice(value)}</span> : null;
}
