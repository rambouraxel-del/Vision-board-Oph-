import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import type { Camera, Item, Universe } from '../types';
import { BOARD_SIZE, MAP_PORTAL, cardSize, zonesOf, type Zone } from '../data/boards';
import { lsGet, lsSet, prefersReducedMotion, vibrate } from '../lib/util';
import { BoardCard } from './BoardCard';
import { moveItem } from '../db/store';

export interface BoardApi {
  zoomBy: (factor: number) => void;
  fitAll: () => void;
  goToZone: (id: string) => void;
  currentZone: () => string;
  focusItem: (id: string) => void;
}

interface Props {
  universe: Universe;
  items: Item[];
  active: boolean;
  organize: boolean;
  onOpen: (id: string) => void;
  onZoneList: (zone: Zone) => void;
  onZoneAdd: (zone: Zone) => void;
  onOpenMap: () => void;
  onOpenDressing: () => void;
  onZoneChange?: (zoneId: string) => void;
  apiRef: Ref<BoardApi>;
}

const MIN_S = 0.12;
const MAX_S = 2.5;
const LONG_PRESS_MS = 420;
const TAP_SLOP = 8;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Mode = 'idle' | 'pending' | 'card-pending' | 'pan' | 'pinch' | 'drag';

const camKey = (u: Universe) => `uo-camera-${u}`;

function loadCam(u: Universe): Camera | null {
  const raw = lsGet(camKey(u));
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Camera;
    if ([c.x, c.y, c.s].every((n) => typeof n === 'number' && Number.isFinite(n))) return c;
  } catch {
    /* ignoré */
  }
  return null;
}

const clampS = (s: number) => Math.min(MAX_S, Math.max(MIN_S, s));

export function Board(props: Props) {
  const { universe, items, active, organize, apiRef } = props;
  const vpRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const cam = useRef<Camera>({ x: 0, y: 0, s: 0.3 });
  const size = BOARD_SIZE[universe];
  const zones = useMemo(() => zonesOf(universe), [universe]);
  const [view, setView] = useState<Rect>({ x: 0, y: 0, w: size.w, h: size.h });
  const [zoomLevel, setZoomLevel] = useState<'far' | 'mid' | 'near'>('mid');

  const activeRef = useRef(active);
  activeRef.current = active;
  const organizeRef = useRef(organize);
  organizeRef.current = organize;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const propsRef = useRef(props);
  propsRef.current = props;

  // ---------------------------------------------------------------- caméra

  const vpSize = () => {
    const el = vpRef.current;
    return { w: el?.clientWidth || window.innerWidth, h: el?.clientHeight || window.innerHeight };
  };

  const clampCam = useCallback(
    (c: Camera): Camera => {
      const { w, h } = vpSize();
      const bw = size.w * c.s;
      const bh = size.h * c.s;
      const x = bw < w ? Math.min(Math.max(c.x, 0), w - bw) : Math.min(w * 0.45, Math.max(c.x, w * 0.55 - bw));
      const y = bh < h ? Math.min(Math.max(c.y, 0), h - bh) : Math.min(h * 0.45, Math.max(c.y, h * 0.55 - bh));
      return { x, y, s: c.s };
    },
    [size.w, size.h],
  );

  const viewTimer = useRef<number | null>(null);
  const lastViewAt = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const lastZone = useRef('');

  const computeView = useCallback((): Rect => {
    const { w, h } = vpSize();
    const c = cam.current;
    return { x: -c.x / c.s, y: -c.y / c.s, w: w / c.s, h: h / c.s };
  }, []);

  const currentZone = useCallback((): string => {
    const v = computeView();
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    let best = zones[0];
    let bestD = Infinity;
    for (const z of zones) {
      const dx = Math.max(z.x - cx, 0, cx - (z.x + z.w));
      const dy = Math.max(z.y - cy, 0, cy - (z.y + z.h));
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = z;
      }
    }
    return best.id;
  }, [computeView, zones]);

  const flushView = useCallback(() => {
    lastViewAt.current = performance.now();
    setView(computeView());
    const s = cam.current.s;
    setZoomLevel(s < 0.32 ? 'far' : s < 0.7 ? 'mid' : 'near');
    const z = currentZone();
    if (z !== lastZone.current) {
      lastZone.current = z;
      propsRef.current.onZoneChange?.(z);
    }
  }, [computeView, currentZone]);

  const scheduleView = useCallback(() => {
    if (viewTimer.current !== null) return;
    const wait = Math.max(0, 140 - (performance.now() - lastViewAt.current));
    viewTimer.current = window.setTimeout(() => {
      viewTimer.current = null;
      flushView();
    }, wait);
  }, [flushView]);

  const apply = useCallback(
    (c: Camera, opts: { save?: boolean } = {}) => {
      cam.current = clampCam(c);
      const el = layerRef.current;
      if (el) {
        const { x, y, s } = cam.current;
        el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
      }
      scheduleView();
      if (opts.save !== false) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => lsSet(camKey(universe), JSON.stringify(cam.current)), 350);
      }
    },
    [clampCam, scheduleView, universe],
  );

  const anim = useRef<number | null>(null);
  const animateTo = useCallback(
    (target: Camera) => {
      if (anim.current) cancelAnimationFrame(anim.current);
      const to = clampCam(target);
      if (prefersReducedMotion()) {
        apply(to);
        flushView();
        return;
      }
      const from = { ...cam.current };
      const start = performance.now();
      const dur = 380;
      layerRef.current?.classList.add('is-moving');
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        apply({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, s: from.s + (to.s - from.s) * e });
        if (t < 1) anim.current = requestAnimationFrame(step);
        else {
          anim.current = null;
          layerRef.current?.classList.remove('is-moving');
          flushView();
        }
      };
      anim.current = requestAnimationFrame(step);
    },
    [apply, clampCam, flushView],
  );

  const fitRect = useCallback(
    (r: Rect, pad = 40): Camera => {
      const { w, h } = vpSize();
      const s = clampS(Math.min((w - pad * 2) / r.w, (h - pad * 2) / r.h));
      return { s, x: (w - r.w * s) / 2 - r.x * s, y: (h - r.h * s) / 2 - r.y * s };
    },
    [],
  );

  const zoomAt = useCallback(
    (sx: number, sy: number, factor: number, animate = false) => {
      const c = cam.current;
      const s = clampS(c.s * factor);
      const wx = (sx - c.x) / c.s;
      const wy = (sy - c.y) / c.s;
      const next = { s, x: sx - wx * s, y: sy - wy * s };
      if (animate) animateTo(next);
      else apply(next);
    },
    [apply, animateTo],
  );

  // Initialisation de la caméra pour cet univers
  useEffect(() => {
    const saved = loadCam(universe);
    const main = zones[0];
    const start = saved ?? fitRect({ x: main.x, y: main.y, w: main.w, h: main.h }, 16);
    apply(start, { save: false });
    flushView();
    const onResize = () => {
      apply(cam.current);
      flushView();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universe]);

  useImperativeHandle(
    apiRef,
    () => ({
      zoomBy: (f) => {
        const { w, h } = vpSize();
        zoomAt(w / 2, h / 2, f, true);
      },
      fitAll: () => animateTo(fitRect({ x: 0, y: 0, w: size.w, h: size.h }, 12)),
      goToZone: (id) => {
        const z = zones.find((zz) => zz.id === id);
        if (z) animateTo(fitRect({ x: z.x, y: z.y, w: z.w, h: z.h }, 16));
      },
      currentZone,
      focusItem: (id) => {
        const it = itemsRef.current.find((i) => i.id === id);
        if (!it) return;
        const { w, h } = cardSize(it);
        const { w: vw, h: vh } = vpSize();
        const s = Math.max(cam.current.s, Math.min(1, (vw * 0.7) / w));
        animateTo({ s, x: vw / 2 - (it.x + w / 2) * s, y: vh / 2 - (it.y + h / 2) * s });
      },
    }),
    [animateTo, currentZone, fitRect, size.h, size.w, zoomAt, zones],
  );

  // ---------------------------------------------------------------- gestes

  const g = useRef({
    pointers: new Map<number, { x: number; y: number }>(),
    mode: 'idle' as Mode,
    start: { x: 0, y: 0 },
    startCam: { x: 0, y: 0, s: 1 } as Camera,
    pinch: { dist: 1, mid: { x: 0, y: 0 } },
    card: null as null | { id: string; el: HTMLElement; x: number; y: number },
    lp: null as number | null,
    suppressClick: false,
    dragPos: { x: 0, y: 0 },
  });

  useEffect(() => {
    const vp = vpRef.current!;
    const st = g.current;

    const local = (e: { clientX: number; clientY: number }) => {
      const r = vp.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const clearLp = () => {
      if (st.lp !== null) {
        clearTimeout(st.lp);
        st.lp = null;
      }
    };

    const startDrag = () => {
      if (!st.card) return;
      st.mode = 'drag';
      st.suppressClick = true;
      st.dragPos = { x: st.card.x, y: st.card.y };
      st.card.el.classList.add('is-dragging');
      vibrate(15);
    };

    const endDrag = (commit: boolean) => {
      if (!st.card) return;
      const { el, id } = st.card;
      el.classList.remove('is-dragging');
      if (commit) {
        const it = itemsRef.current.find((i) => i.id === id);
        const { w, h } = it ? cardSize(it) : { w: 200, h: 200 };
        const x = Math.min(size.w - w, Math.max(0, st.dragPos.x));
        const y = Math.min(size.h - h, Math.max(0, st.dragPos.y));
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        void moveItem(id, x, y);
      }
      st.card = null;
    };

    const beginPinch = () => {
      const pts = [...st.pointers.values()];
      const a = pts[0];
      const b = pts[1];
      st.pinch = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      st.startCam = { ...cam.current };
      st.mode = 'pinch';
      st.suppressClick = true;
    };

    const onMove = (e: PointerEvent) => {
      if (!st.pointers.has(e.pointerId)) return;
      st.pointers.set(e.pointerId, local(e));
      if (st.mode === 'pinch' && st.pointers.size >= 2) {
        const pts = [...st.pointers.values()];
        const a = pts[0];
        const b = pts[1];
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const c0 = st.startCam;
        const s = clampS(c0.s * (dist / st.pinch.dist));
        const wx = (st.pinch.mid.x - c0.x) / c0.s;
        const wy = (st.pinch.mid.y - c0.y) / c0.s;
        apply({ s, x: mid.x - wx * s, y: mid.y - wy * s });
        return;
      }
      if (st.pointers.size !== 1) return;
      const p = local(e);
      const dx = p.x - st.start.x;
      const dy = p.y - st.start.y;
      const far = Math.hypot(dx, dy) > TAP_SLOP;

      if (st.mode === 'card-pending' && far) {
        startDrag();
      } else if (st.mode === 'pending' && far) {
        clearLp();
        st.card = null;
        st.mode = 'pan';
        st.suppressClick = true;
        layerRef.current?.classList.add('is-moving');
      }

      if (st.mode === 'drag' && st.card) {
        const s = cam.current.s;
        st.dragPos = { x: st.card.x + dx / s, y: st.card.y + dy / s };
        st.card.el.style.left = `${st.dragPos.x}px`;
        st.card.el.style.top = `${st.dragPos.y}px`;
      } else if (st.mode === 'pan') {
        apply({ s: st.startCam.s, x: st.startCam.x + dx, y: st.startCam.y + dy });
      }
    };

    const detach = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };

    const finish = () => {
      clearLp();
      st.mode = 'idle';
      layerRef.current?.classList.remove('is-moving');
      detach();
      flushView();
    };

    const onUp = (e: PointerEvent) => {
      if (!st.pointers.has(e.pointerId)) return;
      st.pointers.delete(e.pointerId);
      if (st.mode === 'drag') {
        if (st.pointers.size === 0) {
          endDrag(true);
          finish();
        }
        return;
      }
      if (st.mode === 'pinch') {
        if (st.pointers.size === 1) {
          // Continuer en déplacement avec le doigt restant
          const [p] = [...st.pointers.values()];
          st.start = p;
          st.startCam = { ...cam.current };
          st.mode = 'pan';
        } else if (st.pointers.size === 0) finish();
        return;
      }
      if (st.pointers.size === 0) {
        st.card = null;
        finish();
      }
    };

    const onCancel = (e: PointerEvent) => {
      st.pointers.delete(e.pointerId);
      if (st.pointers.size === 0) {
        if (st.mode === 'drag') endDrag(true);
        st.card = null;
        finish();
      }
    };

    const onDown = (e: PointerEvent) => {
      if (!activeRef.current) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (anim.current) {
        cancelAnimationFrame(anim.current);
        anim.current = null;
      }
      const p = local(e);
      st.pointers.set(e.pointerId, p);
      if (st.pointers.size === 1) {
        st.suppressClick = false;
        st.start = p;
        st.startCam = { ...cam.current };
        const target = e.target as Element;
        const cardEl = target.closest<HTMLElement>('[data-card]');
        const it = cardEl ? itemsRef.current.find((i) => i.id === cardEl.dataset.card) : undefined;
        if (cardEl && it) {
          st.card = { id: it.id, el: cardEl, x: it.x, y: it.y };
          if (organizeRef.current) {
            st.mode = 'card-pending';
          } else {
            st.mode = 'pending';
            st.lp = window.setTimeout(() => {
              st.lp = null;
              if (st.mode === 'pending' && st.pointers.size === 1) startDrag();
            }, LONG_PRESS_MS);
          }
        } else {
          st.card = null;
          st.mode = 'pending';
        }
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onCancel);
      } else if (st.pointers.size === 2) {
        clearLp();
        if (st.mode === 'drag') endDrag(true);
        st.card = null;
        layerRef.current?.classList.add('is-moving');
        beginPinch();
      }
    };

    const onClickCapture = (e: MouseEvent) => {
      if (st.suppressClick) {
        e.stopPropagation();
        e.preventDefault();
        st.suppressClick = false;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!activeRef.current) return;
      e.preventDefault();
      const p = local(e);
      if (e.ctrlKey || e.metaKey) {
        zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.01));
      } else {
        let dx = e.deltaX;
        let dy = e.deltaY;
        if (e.deltaMode === 1) {
          dx *= 18;
          dy *= 18;
        }
        if (e.shiftKey && !dx) {
          dx = dy;
          dy = 0;
        }
        const c = cam.current;
        apply({ s: c.s, x: c.x - dx, y: c.y - dy });
      }
    };

    // Safari (Mac) : pincement du pavé tactile ; sur iPhone, les pointeurs gèrent déjà le zoom.
    let gs = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gs = cam.current.s;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      if (!activeRef.current || st.pointers.size >= 2) return;
      const ge = e as Event & { scale: number; clientX: number; clientY: number };
      const p = local(ge);
      zoomAt(p.x, p.y, (gs * ge.scale) / cam.current.s);
    };
    const prevent = (e: Event) => e.preventDefault();

    vp.addEventListener('pointerdown', onDown);
    vp.addEventListener('click', onClickCapture, true);
    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('gesturestart', onGestureStart);
    vp.addEventListener('gesturechange', onGestureChange);
    vp.addEventListener('contextmenu', prevent);
    return () => {
      detach();
      vp.removeEventListener('pointerdown', onDown);
      vp.removeEventListener('click', onClickCapture, true);
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('gesturestart', onGestureStart);
      vp.removeEventListener('gesturechange', onGestureChange);
      vp.removeEventListener('contextmenu', prevent);
    };
  }, [apply, flushView, size.h, size.w, zoomAt]);

  // Si un panneau s'ouvre pendant un geste, on l'interrompt proprement
  useEffect(() => {
    if (!active) {
      const st = g.current;
      if (st.lp !== null) clearTimeout(st.lp);
      st.pointers.clear();
      st.card?.el.classList.remove('is-dragging');
      st.card = null;
      st.mode = 'idle';
    }
  }, [active]);

  // ---------------------------------------------------------------- clavier
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!active) return;
    const target = e.target as HTMLElement;
    const cardId = target.dataset?.card;
    const c = cam.current;
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (arrows[e.key]) {
      e.preventDefault();
      const [ax, ay] = arrows[e.key];
      if (cardId && organize) {
        const it = items.find((i) => i.id === cardId);
        if (it) void moveItem(it.id, it.x + ax * 20, it.y + ay * 20);
      } else {
        apply({ s: c.s, x: c.x - ax * 80, y: c.y - ay * 80 });
      }
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      const { w, h } = vpSize();
      zoomAt(w / 2, h / 2, 1.25, true);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      const { w, h } = vpSize();
      zoomAt(w / 2, h / 2, 0.8, true);
    } else if (e.key === '0') {
      e.preventDefault();
      animateTo(fitRect({ x: 0, y: 0, w: size.w, h: size.h }, 12));
    }
  };

  // ---------------------------------------------------------------- rendu limité
  const margin = 400 / Math.max(0.3, cam.current.s);
  const visible = useMemo(() => {
    const vx0 = view.x - margin;
    const vy0 = view.y - margin;
    const vx1 = view.x + view.w + margin;
    const vy1 = view.y + view.h + margin;
    return items.filter((it) => {
      const { w, h } = cardSize(it);
      return it.x + w > vx0 && it.x < vx1 && it.y + h > vy0 && it.y < vy1;
    });
  }, [items, view, margin]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  return (
    <div
      ref={vpRef}
      className={`board-viewport zoom-${zoomLevel} ${organize ? 'is-organizing' : ''}`}
      tabIndex={0}
      role="application"
      aria-roledescription="tableau d’inspirations"
      aria-label={`Tableau ${universe === 'cocon' ? 'Mon cocon' : 'Mes horizons'}. Flèches pour se déplacer, plus et moins pour zoomer, zéro pour tout voir.`}
      onKeyDown={onKeyDown}
    >
      <div ref={layerRef} className="board-layer" style={{ width: size.w, height: size.h }}>
        <div className="board-texture" aria-hidden="true" />
        {zones.map((z) => (
          <ZoneFrame
            key={z.id}
            zone={z}
            onList={() => props.onZoneList(z)}
            onAdd={() => props.onZoneAdd(z)}
            onDressing={z.id === 'dressing' || z.id === 'tenues' ? props.onOpenDressing : undefined}
          />
        ))}
        {universe === 'horizons' && (
          <button
            className="map-portal"
            style={{ left: MAP_PORTAL.x, top: MAP_PORTAL.y, width: MAP_PORTAL.w, height: MAP_PORTAL.h }}
            onClick={props.onOpenMap}
          >
            <span className="map-portal-globe" aria-hidden="true" />
            <span className="map-portal-text">
              <strong>Ouvrir la carte du monde</strong>
              <span>Explorer, placer un repère, suivre mes destinations</span>
            </span>
          </button>
        )}
        {visible.map((it) => (
          <BoardCard key={it.id} item={it} byId={byId} organize={organize} onOpen={props.onOpen} />
        ))}
      </div>
    </div>
  );
}

const ZoneFrame = memo(function ZoneFrame({
  zone,
  onList,
  onAdd,
  onDressing,
}: {
  zone: Zone;
  onList: () => void;
  onAdd: () => void;
  onDressing?: () => void;
}) {
  return (
    <section
      className={`zone tone-${zone.tone}`}
      style={{ left: zone.x, top: zone.y, width: zone.w, height: zone.h }}
      aria-label={zone.title}
    >
      <header className="zone-head">
        <h2 className="zone-title">{zone.title}</h2>
        <p className="zone-sub">{zone.subtitle}</p>
        <div className="zone-actions">
          {onDressing && (
            <button className="zone-btn" onClick={onDressing}>
              {zone.id === 'tenues' ? 'Créer une tenue' : 'Ouvrir mon dressing'}
            </button>
          )}
          <button className="zone-btn" onClick={onList}>
            Tout voir
          </button>
          <button className="zone-btn" onClick={onAdd} aria-label={`Ajouter dans ${zone.title}`}>
            + Ajouter
          </button>
        </div>
      </header>
    </section>
  );
});
