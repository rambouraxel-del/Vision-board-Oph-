import { useState } from 'react';
import type { CategorySection, ClasseFormat, DecoStatus, Item, Priority, ProjetStatus, TravelStatus, VetementStatus } from '../types';
import { saveItem, useStore } from '../db/store';
import { defaultZoneFor } from '../data/boards';
import { placeInZone } from '../lib/factory';
import {
  CLASSE_FORMAT,
  DECO_STATUS,
  NOTE_COLORS,
  PRIORITY,
  PROJET_STATUS,
  SEASONS,
  TRAVEL_STATUS,
  VETEMENT_STATUS,
} from '../lib/labels';
import {
  AmountField,
  BudgetEditor,
  ChecklistEditor,
  ItemPicker,
  LinksField,
  PhotosField,
  Segmented,
  SelectField,
  StepsEditor,
  TagsField,
  TextArea,
  TextField,
} from './fields';
import { Sheet } from './Sheet';
import { useUI } from '../ui';

const SECTION: Partial<Record<Item['type'], CategorySection>> = {
  deco: 'deco',
  vetement: 'dressing',
  classe: 'classe',
};

const TITLES: Record<Item['type'], [string, string]> = {
  deco: ['Nouvelle inspiration déco', 'Modifier l’inspiration'],
  vetement: ['Nouveau vêtement', 'Modifier le vêtement'],
  tenue: ['Nouvelle tenue', 'Modifier la tenue'],
  capsule: ['Nouvelle capsule', 'Modifier la capsule'],
  classe: ['Nouvelle fiche', 'Modifier la fiche'],
  note: ['Nouvelle note', 'Modifier la note'],
  destination: ['Nouvelle destination', 'Modifier la destination'],
};

export function ItemEditor({ initial, isNew, top }: { initial: Item; isNew: boolean; top: boolean }) {
  const ui = useUI();
  const [d, setD] = useState<Item>(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const allItems = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const set = <K extends keyof Item>(k: K, v: Item[K]) => setD((x) => ({ ...x, [k]: v }));

  const section = SECTION[d.type];
  const cats = section ? categories.filter((c) => c.section === section).sort((a, b) => a.order - b.order) : [];
  const allTags = [...new Set(allItems.filter((i) => i.type === d.type).flatMap((i) => i.tags))];
  const vetements = allItems.filter((i) => i.type === 'vetement');

  const dirty = JSON.stringify(d) !== JSON.stringify(initial);

  const requestClose = async () => {
    if (dirty) {
      const ok = await ui.confirm({
        title: 'Abandonner les modifications ?',
        message: 'Les changements non enregistrés seront perdus.',
        confirmLabel: 'Abandonner',
        cancelLabel: 'Continuer',
        danger: true,
      });
      if (!ok) return;
    }
    ui.close();
  };

  const submit = async () => {
    const needsTitle = d.type !== 'note';
    if (needsTitle && !d.title.trim()) {
      setError(d.type === 'destination' ? 'Indiquez au moins le nom de la destination.' : 'Donnez un titre ou un nom.');
      return;
    }
    if (d.type === 'note' && !d.title.trim() && !d.notes.trim() && d.photos.length === 0) {
      setError('La note est vide : ajoutez un texte ou une photo.');
      return;
    }
    let item: Item = { ...d, title: d.title.trim() };
    // Une fiche « maîtresse » change de zone si son format change (objectif, envie…)
    if (item.type === 'classe') {
      const expected = defaultZoneFor('classe', item.format, 'horizons');
      const classeZones = ['classe', 'objectifs', 'future-classe'];
      if (classeZones.includes(item.zone) && item.zone !== expected) {
        item = { ...item, zone: expected };
        item = { ...item, ...placeInZone(item, allItems) };
      }
    }
    if (isNew) item = { ...item, ...placeInZone(item, allItems) };
    setSaving(true);
    const ok = await saveItem(item);
    setSaving(false);
    if (!ok) {
      setError('L’enregistrement a échoué. Vos saisies sont toujours là : réessayez.');
      return;
    }
    ui.toast({ message: isNew ? 'Ajouté ✓' : 'Modifications enregistrées ✓' });
    if (isNew) ui.replace({ kind: 'item', id: item.id });
    else ui.close();
  };

  const title = TITLES[d.type][isNew ? 0 : 1];

  return (
    <Sheet
      title={title}
      onClose={() => void requestClose()}
      top={top}
      footer={
        <>
          <button className="btn ghost" onClick={() => void requestClose()}>
            Annuler
          </button>
          <button className="btn primary" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {d.type === 'classe' && (
          <Segmented<ClasseFormat>
            label="Type de fiche"
            value={d.format ?? 'fiche'}
            options={(Object.keys(CLASSE_FORMAT) as ClasseFormat[]).map((k) => ({ value: k, label: CLASSE_FORMAT[k] }))}
            onChange={(v) => set('format', v)}
          />
        )}

        <TextField
          label={d.type === 'vetement' ? 'Nom' : d.type === 'destination' ? 'Nom du lieu' : d.type === 'note' ? 'Titre (facultatif)' : 'Titre'}
          value={d.title}
          onChange={(v) => {
            set('title', v);
            setError('');
          }}
          autoFocus={isNew}
        />

        {d.type === 'destination' && (
          <>
            <TextField label="Pays" value={d.country ?? ''} onChange={(v) => set('country', v)} />
            <div className="two-col">
              <TextField
                label="Latitude"
                inputMode="decimal"
                value={d.lat === null || d.lat === undefined ? '' : String(d.lat)}
                onChange={(v) => set('lat', v.trim() === '' ? null : Number(v.replace(',', '.')))}
              />
              <TextField
                label="Longitude"
                inputMode="decimal"
                value={d.lng === null || d.lng === undefined ? '' : String(d.lng)}
                onChange={(v) => set('lng', v.trim() === '' ? null : Number(v.replace(',', '.')))}
              />
            </div>
            <p className="field-hint">Astuce : placez un repère depuis la carte du monde pour remplir les coordonnées automatiquement.</p>
            <Segmented<TravelStatus>
              label="Statut"
              value={d.travelStatus ?? 'a-decouvrir'}
              options={(Object.keys(TRAVEL_STATUS) as TravelStatus[]).map((k) => ({ value: k, label: TRAVEL_STATUS[k] }))}
              onChange={(v) => set('travelStatus', v)}
            />
            <TextField label="Période envisagée" placeholder="ex. printemps, vacances d’été…" value={d.period ?? ''} onChange={(v) => set('period', v)} />
          </>
        )}

        {d.type !== 'tenue' && d.type !== 'capsule' && (
          <PhotosField value={d.photos} onChange={(v) => set('photos', v)} single={d.type === 'vetement'} />
        )}

        {d.type === 'note' ? (
          <>
            <TextArea label="Texte" rows={5} value={d.notes} onChange={(v) => set('notes', v)} />
            <Segmented
              label="Couleur du papier"
              value={d.noteColor ?? 'cream'}
              options={NOTE_COLORS.map((c) => ({ value: c.id, label: c.label }))}
              onChange={(v) => set('noteColor', v)}
            />
          </>
        ) : (
          d.type !== 'vetement' && d.type !== 'tenue' && <TextArea label="Description" value={d.description} onChange={(v) => set('description', v)} />
        )}

        {section && (
          <SelectField
            label="Catégorie"
            value={d.categoryId ?? ''}
            options={[{ value: '', label: 'Sans catégorie' }, ...cats.map((c) => ({ value: c.id, label: c.name }))]}
            onChange={(v) => set('categoryId', v || null)}
            after={
              <button type="button" className="btn ghost small" onClick={() => ui.open({ kind: 'categories', section })}>
                Gérer
              </button>
            }
          />
        )}

        {d.type === 'deco' && (
          <>
            <Segmented<DecoStatus>
              label="Statut"
              value={d.decoStatus ?? 'inspiration'}
              options={(Object.keys(DECO_STATUS) as DecoStatus[]).map((k) => ({ value: k, label: DECO_STATUS[k] }))}
              onChange={(v) => set('decoStatus', v)}
            />
            <AmountField label="Prix indicatif" value={d.price} onChange={(v) => set('price', v)} />
          </>
        )}

        {d.type === 'vetement' && (
          <>
            <Segmented<VetementStatus>
              label="Statut"
              value={d.vetementStatus ?? 'envie'}
              options={(Object.keys(VETEMENT_STATUS) as VetementStatus[]).map((k) => ({ value: k, label: VETEMENT_STATUS[k] }))}
              onChange={(v) => set('vetementStatus', v)}
            />
            <div className="two-col">
              <TextField label="Couleur" placeholder="ex. rose poudré" value={d.color ?? ''} onChange={(v) => set('color', v)} />
              <SelectField
                label="Saison"
                value={d.season ?? ''}
                options={[{ value: '', label: '—' }, ...SEASONS.map((s) => ({ value: s, label: s }))]}
                onChange={(v) => set('season', v)}
              />
            </div>
            <div className="two-col">
              <TextField label="Marque" placeholder="Facultatif" value={d.brand ?? ''} onChange={(v) => set('brand', v)} />
              <TextField label="Taille" placeholder="Facultatif" value={d.size ?? ''} onChange={(v) => set('size', v)} />
            </div>
            <AmountField label="Prix" value={d.price} onChange={(v) => set('price', v)} />
          </>
        )}

        {d.type === 'tenue' && <TextField label="Occasion" placeholder="ex. rentrée, week-end, mariage…" value={d.occasion ?? ''} onChange={(v) => set('occasion', v)} />}

        {(d.type === 'tenue' || d.type === 'capsule') && (
          <ItemPicker items={vetements} value={d.itemIds ?? []} onChange={(v) => set('itemIds', v)} />
        )}

        {d.type === 'classe' && d.format === 'activite' && (
          <>
            <TextField label="Niveau scolaire" placeholder="ex. CP – CE1" value={d.level ?? ''} onChange={(v) => set('level', v)} />
            <TextArea label="Matériel nécessaire" value={d.materials ?? ''} onChange={(v) => set('materials', v)} />
            <StepsEditor value={d.steps ?? []} onChange={(v) => set('steps', v)} />
          </>
        )}

        {d.type === 'classe' && d.format === 'objectif' && (
          <>
            <Segmented<ProjetStatus>
              label="Statut"
              value={d.projetStatus ?? 'idee'}
              options={(Object.keys(PROJET_STATUS) as ProjetStatus[]).map((k) => ({ value: k, label: PROJET_STATUS[k] }))}
              onChange={(v) => set('projetStatus', v)}
            />
            <TextField label="Échéance (facultatif)" type="date" value={d.dueDate ?? ''} onChange={(v) => set('dueDate', v)} />
            <ChecklistEditor label="Checklist" value={d.checklist ?? []} onChange={(v) => set('checklist', v)} />
          </>
        )}

        {d.type === 'classe' && d.format === 'envie' && (
          <>
            <Segmented<Priority>
              label="Priorité"
              value={d.priority ?? 'moyenne'}
              options={(Object.keys(PRIORITY) as Priority[]).map((k) => ({ value: k, label: PRIORITY[k].replace('Priorité ', '') }))}
              onChange={(v) => set('priority', v)}
            />
            <AmountField label="Prix" value={d.price} onChange={(v) => set('price', v)} />
          </>
        )}

        {d.type === 'destination' && (
          <>
            <ChecklistEditor label="Activités et lieux à voir" value={d.checklist ?? []} onChange={(v) => set('checklist', v)} placeholder="ex. visiter le musée…" />
            <BudgetEditor value={d.budget ?? []} onChange={(v) => set('budget', v)} />
          </>
        )}

        {d.type !== 'note' && d.type !== 'tenue' && (
          <TextArea label="Notes" value={d.notes} onChange={(v) => set('notes', v)} />
        )}
        {d.type === 'tenue' && <TextArea label="Notes" value={d.notes} onChange={(v) => set('notes', v)} />}

        {['deco', 'vetement', 'classe', 'destination'].includes(d.type) && <LinksField value={d.links} onChange={(v) => set('links', v)} />}

        {d.type !== 'note' && <TagsField value={d.tags} onChange={(v) => set('tags', v)} suggestions={allTags} />}

        <label className="check-inline fav-toggle">
          <input type="checkbox" checked={d.favorite} onChange={(e) => set('favorite', e.target.checked)} /> Favori ♥
        </label>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
