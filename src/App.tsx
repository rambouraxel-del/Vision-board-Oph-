import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Item, Universe } from './types';
import { loadStore, onStorageError, useStore } from './db/store';
import { useUI, type SheetDesc } from './ui';
import { Board, type BoardApi } from './components/Board';
import { ItemDetail } from './components/ItemDetail';
import { ItemEditor } from './components/ItemEditor';
import { Dressing } from './components/Dressing';
import { ListView } from './components/ListView';
import { MapView } from './components/MapView';
import { AddChooser, CategoriesPanel, CreditsPanel, ImportConfirm, SettingsPanel } from './components/Panels';
import { zonesOf, type Zone } from './data/boards';
import { lsGet, lsSet } from './lib/util';
import { onUpdateReady, applyUpdate } from './sw-register';

const UNIVERSES: { id: Universe; label: string; hint: string }[] = [
  { id: 'cocon', label: 'Mon cocon', hint: 'Déco & dressing' },
  { id: 'horizons', label: 'Mes horizons', hint: 'Classe & voyages' },
];

export default function App() {
  const ui = useUI();
  const ready = useStore((s) => s.ready);
  const items = useStore((s) => s.items);
  const [universe, setUniverse] = useState<Universe>(() => (lsGet('uo-universe') === 'horizons' ? 'horizons' : 'cocon'));
  const [organize, setOrganize] = useState(false);
  const [zoneId, setZoneId] = useState<string>('');
  const board = useRef<BoardApi>(null);
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    void loadStore();
    const offErr = onStorageError((message) => ui.toast({ message, tone: 'error', duration: 9000 }));
    const offUpd = onUpdateReady(() =>
      ui.toast({
        message: 'Une nouvelle version de l’application est prête. Vos données sont conservées.',
        action: { label: 'Mettre à jour', run: applyUpdate },
        duration: 60000,
      }),
    );
    return () => {
      offErr();
      offUpd();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    lsSet('uo-universe', universe);
    document.documentElement.dataset.universe = universe;
    setOrganize(false);
  }, [universe]);

  const boardItems = useMemo(() => items.filter((i) => i.universe === universe), [items, universe]);
  const zones = zonesOf(universe);
  const sheetsOpen = ui.stack.length > 0;

  // Après changement d'univers, centrer sur l'élément demandé
  useEffect(() => {
    if (!ready || !pendingFocus.current) return;
    const id = pendingFocus.current;
    const t = window.setTimeout(() => {
      board.current?.focusItem(id);
      pendingFocus.current = null;
    }, 80);
    return () => clearTimeout(t);
  }, [universe, ready, sheetsOpen]);

  const showOnBoard = useCallback(
    (item: Item) => {
      pendingFocus.current = item.id;
      ui.closeAll();
      setUniverse(item.universe);
    },
    [ui],
  );

  const onOpen = useCallback((id: string) => ui.open({ kind: 'item', id }), [ui]);
  const onZoneList = useCallback(
    (z: Zone) => {
      const map: Record<string, SheetDesc> = {
        deco: { kind: 'list', section: 'deco' },
        dressing: { kind: 'dressing', tab: 'vetements' },
        tenues: { kind: 'dressing', tab: 'tenues' },
        'notes-cocon': { kind: 'list', section: 'notes' },
        classe: { kind: 'list', section: 'classe' },
        objectifs: { kind: 'list', section: 'classe' },
        'future-classe': { kind: 'list', section: 'classe' },
        voyages: { kind: 'list', section: 'voyages' },
        'notes-horizons': { kind: 'list', section: 'notes' },
      };
      ui.open(map[z.id] ?? { kind: 'list' });
    },
    [ui],
  );
  const onZoneAdd = useCallback((z: Zone) => ui.open({ kind: 'add', zoneId: z.id }), [ui]);
  const onOpenMap = useCallback(() => ui.open({ kind: 'map' }), [ui]);
  const onOpenDressing = useCallback(() => ui.open({ kind: 'dressing' }), [ui]);

  const addHere = () => {
    const z = board.current?.currentZone() ?? zones[0].id;
    ui.open({ kind: 'add', zoneId: z });
  };

  if (!ready) {
    return (
      <div className="splash" role="status">
        <span className="splash-title">L’univers d’Ophélie</span>
        <span className="splash-sub">Ouverture…</span>
      </div>
    );
  }

  return (
    <div className={`app u-${universe}`}>
      <header className="topbar">
        <h1 className="brand">
          L’univers <span>d’Ophélie</span>
        </h1>
        <nav className="zone-nav" aria-label="Aller à une zone">
          {zones.map((z) => (
            <button
              key={z.id}
              className={`zone-chip tone-${z.tone} ${zoneId === z.id ? 'is-on' : ''}`}
              onClick={() => board.current?.goToZone(z.id)}
            >
              {z.title}
            </button>
          ))}
        </nav>
      </header>

      <main className="stage" aria-hidden={sheetsOpen || undefined} inert={sheetsOpen || undefined}>
        <Board
          key={universe}
          apiRef={board}
          universe={universe}
          items={boardItems}
          active={!sheetsOpen}
          organize={organize}
          onOpen={onOpen}
          onZoneList={onZoneList}
          onZoneAdd={onZoneAdd}
          onOpenMap={onOpenMap}
          onOpenDressing={onOpenDressing}
          onZoneChange={setZoneId}
        />

        {organize && (
          <div className="organize-banner" role="status">
            <span>Mode Organiser : faites glisser les cartes pour les ranger.</span>
            <button className="btn primary small" onClick={() => setOrganize(false)}>
              Terminer
            </button>
          </div>
        )}

        <div className="controls" role="toolbar" aria-label="Navigation du tableau">
          <button className="ctrl" onClick={() => board.current?.zoomBy(1.3)} aria-label="Zoomer">
            +
          </button>
          <button className="ctrl" onClick={() => board.current?.zoomBy(1 / 1.3)} aria-label="Dézoomer">
            −
          </button>
          <button className="ctrl" onClick={() => board.current?.fitAll()} aria-label="Recentrer : voir tout le tableau" title="Voir tout">
            ⤢
          </button>
          <button
            className={`ctrl ctrl-text ${organize ? 'is-on' : ''}`}
            onClick={() => setOrganize((o) => !o)}
            aria-pressed={organize}
            title="Déplacer les cartes"
          >
            {organize ? 'Fini' : 'Organiser'}
          </button>
        </div>

        <button className="fab" onClick={addHere} aria-label="Ajouter un élément dans la zone affichée">
          <span aria-hidden="true">+</span>
        </button>
      </main>

      <nav className="bottombar" aria-label="Navigation principale">
        {UNIVERSES.map((u) => (
          <button
            key={u.id}
            className={`nav-btn nav-${u.id} ${universe === u.id ? 'is-on' : ''}`}
            aria-current={universe === u.id ? 'page' : undefined}
            onClick={() => {
              if (universe === u.id) board.current?.fitAll();
              setUniverse(u.id);
            }}
          >
            <span className="nav-icon" aria-hidden="true" />
            <span className="nav-label">{u.label}</span>
            <span className="nav-hint">{u.hint}</span>
          </button>
        ))}
        <button className="nav-btn nav-list" onClick={() => ui.open({ kind: 'list', section: universe === 'cocon' ? 'deco' : 'classe' })}>
          <span className="nav-icon" aria-hidden="true" />
          <span className="nav-label">Liste</span>
        </button>
        <button className="nav-btn nav-settings" onClick={() => ui.open({ kind: 'settings' })}>
          <span className="nav-icon" aria-hidden="true" />
          <span className="nav-label">Réglages</span>
        </button>
      </nav>

      <SheetHost onShowOnBoard={showOnBoard} />
      <Toasts />
    </div>
  );
}

function SheetHost({ onShowOnBoard }: { onShowOnBoard: (i: Item) => void }) {
  const ui = useUI();
  const items = useStore((s) => s.items);
  return (
    <>
      {ui.stack.map((s, idx) => {
        const top = idx === ui.stack.length - 1;
        const key = `${idx}-${s.kind}-${'id' in s ? s.id : ''}`;
        switch (s.kind) {
          case 'item':
            return <ItemDetail key={key} id={s.id} top={top} onShowOnBoard={onShowOnBoard} />;
          case 'edit': {
            const existing = s.id ? items.find((i) => i.id === s.id) : undefined;
            const initial = existing ?? s.draft;
            if (!initial) return null;
            return <ItemEditor key={key + (s.draft?.id ?? '')} initial={initial} isNew={!existing} top={top} />;
          }
          case 'add':
            return <AddChooser key={key} zoneId={s.zoneId} top={top} />;
          case 'dressing':
            return <Dressing key={key} initialTab={s.tab} top={top} />;
          case 'list':
            return <ListView key={key} initial={s.section} top={top} />;
          case 'settings':
            return <SettingsPanel key={key} top={top} />;
          case 'credits':
            return <CreditsPanel key={key} top={top} />;
          case 'categories':
            return <CategoriesPanel key={key} section={s.section} top={top} />;
          case 'import':
            return <ImportConfirm key={key} preview={s.preview} top={top} />;
          case 'map':
            return <MapView key={key} focusId={s.focusId} initialPlacing={s.placing} top={top} />;
        }
      })}
    </>
  );
}

function Toasts() {
  const ui = useUI();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {ui.toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone === 'error' ? 'is-error' : ''}`}>
          <span>{t.message}</span>
          {t.action && (
            <button
              className="toast-action"
              onClick={() => {
                t.action!.run();
                ui.dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button className="toast-close" onClick={() => ui.dismissToast(t.id)} aria-label="Fermer le message">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
