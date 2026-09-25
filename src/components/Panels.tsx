import { useEffect, useMemo, useRef, useState } from 'react';
import type { CategorySection } from '../types';
import { deleteCategory, eraseEverything, getState, newCategory, restoreMissingSeeds, saveCategory, useStore } from '../db/store';
import { applyBackup, BackupError, exportBackup, readBackup, type BackupPreview } from '../db/backup';
import { CREDITS } from '../lib/images';
import { zoneById } from '../data/boards';
import { newItem } from '../lib/factory';
import { useUI } from '../ui';
import { Sheet } from './Sheet';
import { formatDate } from '../lib/util';

// ---------------------------------------------------------------- Ajouter
export function AddChooser({ zoneId, top }: { zoneId: string; top: boolean }) {
  const ui = useUI();
  const zone = zoneById(zoneId);
  if (!zone) return null;
  return (
    <Sheet title={`Ajouter dans « ${zone.title} »`} onClose={ui.close} top={top}>
      <div className="add-list">
        {zone.adds.map((a, i) => (
          <button
            key={i}
            className={`add-choice tone-${zone.tone}`}
            onClick={() => {
              if (a.type === 'destination') {
                ui.replace({ kind: 'edit', draft: newItem('destination', { zoneId }) });
                return;
              }
              ui.replace({ kind: 'edit', draft: newItem(a.type, { zoneId, preset: a.preset }) });
            }}
          >
            <span className="add-plus" aria-hidden="true">
              +
            </span>
            {a.label}
          </button>
        ))}
        {zone.id === 'voyages' && (
          <button className="add-choice ghost" onClick={() => ui.replace({ kind: 'map', placing: true })}>
            <span className="add-plus" aria-hidden="true">
              ⌖
            </span>
            Placer un repère sur la carte du monde
          </button>
        )}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Catégories
const SECTION_LABEL: Record<CategorySection, string> = {
  deco: 'Décoration',
  dressing: 'Dressing',
  classe: 'Maîtresse',
};

export function CategoriesPanel({ section, top }: { section: CategorySection; top: boolean }) {
  const ui = useUI();
  const all = useStore((s) => s.categories);
  const items = useStore((s) => s.items);
  const cats = useMemo(() => all.filter((c) => c.section === section).sort((a, b) => a.order - b.order), [all, section]);
  const [name, setName] = useState('');

  const add = () => {
    if (!name.trim()) return;
    void saveCategory(newCategory(section, name.trim()));
    setName('');
  };

  const move = (idx: number, dir: -1 | 1) => {
    const a = cats[idx];
    const b = cats[idx + dir];
    if (!a || !b) return;
    void saveCategory({ ...a, order: b.order });
    void saveCategory({ ...b, order: a.order });
  };

  return (
    <Sheet title={`Catégories · ${SECTION_LABEL[section]}`} onClose={ui.close} top={top}>
      <ul className="cat-list">
        {cats.map((c, i) => {
          const count = items.filter((it) => it.categoryId === c.id).length;
          return (
            <li key={c.id}>
              <input className="input" value={c.name} aria-label="Nom de la catégorie" onChange={(e) => void saveCategory({ ...c, name: e.target.value })} />
              <span className="muted count-badge">{count}</span>
              <button className="icon-btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter ${c.name}`}>
                ↑
              </button>
              <button className="icon-btn small" onClick={() => move(i, 1)} disabled={i === cats.length - 1} aria-label={`Descendre ${c.name}`}>
                ↓
              </button>
              <button
                className="icon-btn small danger-text"
                aria-label={`Supprimer ${c.name}`}
                onClick={async () => {
                  const ok = await ui.confirm({
                    title: `Supprimer « ${c.name} » ?`,
                    message: count ? `${count} élément(s) passeront « Sans catégorie ». Ils ne seront pas supprimés.` : 'Cette catégorie est vide.',
                    confirmLabel: 'Supprimer',
                    danger: true,
                  });
                  if (ok) void deleteCategory(c.id);
                }}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
      <div className="inline-add">
        <input
          className="input"
          placeholder="Nouvelle catégorie"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          aria-label="Nom de la nouvelle catégorie"
        />
        <button className="btn primary" onClick={add} disabled={!name.trim()}>
          Ajouter
        </button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Paramètres
export function SettingsPanel({ top }: { top: boolean }) {
  const ui = useUI();
  const items = useStore((s) => s.items);
  const loadError = useStore((s) => s.loadError);
  const fileRef = useRef<HTMLInputElement>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => {
        if (e.usage !== undefined) setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} Mo utilisés`);
      })
      .catch(() => undefined);
    navigator.storage?.persisted?.().then(setPersisted).catch(() => undefined);
  }, [items.length]);

  const doExport = async () => {
    setBusy(true);
    try {
      const r = await exportBackup();
      ui.toast({ message: `Sauvegarde téléchargée : ${r.count} éléments, ${r.images} photo(s) importée(s).` });
    } catch {
      ui.toast({ message: 'L’export a échoué. Réessayez.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const preview = await readBackup(f);
      ui.open({ kind: 'import', preview });
    } catch (e) {
      ui.toast({ message: e instanceof BackupError ? e.message : 'Ce fichier n’a pas pu être lu.', tone: 'error', duration: 8000 });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Sheet title="Réglages" onClose={ui.close} top={top}>
      {loadError && (
        <p className="field-error" role="alert">
          {loadError}
        </p>
      )}
      <section className="settings-block">
        <h3>Mes données</h3>
        <p className="muted small-text">
          Tout est conservé uniquement dans ce navigateur, sur cet appareil ({items.length} éléments{usage ? `, ${usage}` : ''}). Aucune synchronisation
          automatique n’a lieu entre appareils : pour sauvegarder ou transférer vos contenus, exportez une sauvegarde puis restaurez-la ailleurs.
        </p>
        <div className="btn-col">
          <button className="btn primary" onClick={() => void doExport()} disabled={busy}>
            Exporter une sauvegarde
          </button>
          <button className="btn soft" onClick={() => fileRef.current?.click()} disabled={busy}>
            Restaurer une sauvegarde…
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void doImport(e.target.files?.[0])} />
          {persisted === false && navigator.storage?.persist && (
            <button
              className="btn ghost"
              onClick={async () => {
                const ok = await navigator.storage.persist();
                setPersisted(ok);
                ui.toast({ message: ok ? 'Stockage protégé ✓' : 'Le navigateur n’a pas accordé la protection. Pensez aux exports réguliers.' });
              }}
            >
              Protéger le stockage contre l’effacement automatique
            </button>
          )}
          {persisted && <p className="muted small-text">✓ Stockage protégé par le navigateur.</p>}
        </div>
      </section>

      <section className="settings-block">
        <h3>Inspirations de départ</h3>
        <p className="muted small-text">
          Les exemples supprimés ne reviennent jamais tout seuls. Vous pouvez remettre ceux qui manquent, sans toucher à vos contenus.
        </p>
        <button
          className="btn ghost"
          onClick={async () => {
            const n = await restoreMissingSeeds();
            ui.toast({ message: n ? `${n} inspiration(s) de départ remise(s).` : 'Toutes les inspirations de départ sont déjà là.' });
          }}
        >
          Remettre les inspirations de départ manquantes
        </button>
      </section>

      <section className="settings-block">
        <h3>À propos</h3>
        <p className="muted small-text">
          La carte et la recherche de lieux nécessitent Internet (fonds © contributeurs OpenStreetMap). Le reste de l’application fonctionne hors ligne
          une fois installée.
        </p>
        <button className="btn ghost" onClick={() => ui.open({ kind: 'credits' })}>
          Crédits des photographies
        </button>
        <p className="muted small-text">Version {__APP_VERSION__}</p>
      </section>

      <section className="settings-block danger-zone">
        <h3>Zone sensible</h3>
        <button
          className="btn ghost danger-text"
          onClick={async () => {
            const ok = await ui.confirm({
              title: 'Tout effacer ?',
              message: 'Toutes les données et photos de ce navigateur seront supprimées définitivement. Exportez une sauvegarde avant si besoin.',
              confirmLabel: 'Tout effacer',
              danger: true,
            });
            if (!ok) return;
            const sure = await ui.confirm({
              title: 'Vraiment ?',
              message: 'Cette action est irréversible.',
              confirmLabel: 'Oui, effacer',
              danger: true,
            });
            if (sure) {
              try {
                await eraseEverything();
                ui.toast({ message: 'Toutes les données ont été effacées.' });
              } catch (e) {
                ui.toast({ message: (e as Error).message, tone: 'error' });
              }
            }
          }}
        >
          Effacer toutes mes données
        </button>
      </section>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Restauration
export function ImportConfirm({ preview, top }: { preview: BackupPreview; top: boolean }) {
  const ui = useUI();
  const [busy, setBusy] = useState(false);
  const current = getState().items.length;

  const restore = async () => {
    const ok = await ui.confirm({
      title: 'Remplacer toutes mes données ?',
      message: `Les ${current} éléments actuels de ce navigateur seront remplacés par ceux de la sauvegarde.`,
      confirmLabel: 'Remplacer',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await applyBackup(preview);
      ui.toast({ message: 'Sauvegarde restaurée ✓' });
      ui.closeAll();
    } catch (e) {
      ui.toast({ message: `La restauration a échoué, vos données n’ont pas été modifiées. ${(e as Error).message}`, tone: 'error', duration: 9000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Restaurer une sauvegarde"
      onClose={ui.close}
      top={top}
      footer={
        <>
          <button className="btn ghost" onClick={ui.close}>
            Annuler
          </button>
          <button className="btn danger" onClick={() => void restore()} disabled={busy}>
            {busy ? 'Restauration…' : 'Remplacer mes données'}
          </button>
        </>
      }
    >
      <p>
        Fichier <strong>{preview.fileName}</strong>
        {preview.exportedAt && <> du {formatDate(preview.exportedAt)}</>} : sauvegarde valide.
      </p>
      <ul className="facts-list">
        <li>{preview.items.length} éléments</li>
        <li>{preview.categories.length} catégories</li>
        <li>{preview.blobs.length} photo(s) importée(s)</li>
        {preview.skipped > 0 && <li className="warn">{preview.skipped} élément(s) illisible(s) seront ignorés</li>}
        {preview.missingImages > 0 && <li className="warn">{preview.missingImages} photo(s) manquante(s) dans le fichier</li>}
      </ul>
      <p className="muted small-text">Rien n’a encore été modifié. La restauration remplacera les {current} éléments actuels de ce navigateur.</p>
      <button className="btn soft" onClick={() => void exportBackup()}>
        Exporter d’abord mes données actuelles
      </button>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Crédits
export function CreditsPanel({ top }: { top: boolean }) {
  const ui = useUI();
  return (
    <Sheet title="Crédits des photographies" onClose={ui.close} top={top}>
      <p className="muted small-text">
        Les photographies de départ proviennent de Wikimedia Commons et sont utilisées selon leur licence libre. Merci à leurs auteurs.
      </p>
      {CREDITS.length === 0 && <p className="empty">Aucune photographie de départ n’est encore installée.</p>}
      <ul className="credits">
        {CREDITS.map((c) => (
          <li key={c.key}>
            <strong>{c.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '')}</strong>
            <span>
              {c.author} ·{' '}
              {c.licenseUrl ? (
                <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer">
                  {c.license}
                </a>
              ) : (
                c.license
              )}{' '}
              ·{' '}
              <a href={c.source} target="_blank" rel="noopener noreferrer">
                source
              </a>
            </span>
          </li>
        ))}
      </ul>
      <p className="muted small-text">Fond de carte : © contributeurs OpenStreetMap (licence ODbL). Recherche de lieux : Nominatim.</p>
    </Sheet>
  );
}
