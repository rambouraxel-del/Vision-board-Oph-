import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Item, TravelStatus } from '../types';
import { useStore } from '../db/store';
import { useUI } from '../ui';
import { Sheet } from './Sheet';
import { Photo } from './Photo';
import { TRAVEL_STATUS } from '../lib/labels';
import { newItem } from '../lib/factory';

interface GeoResult {
  name: string;
  full: string;
  country: string;
  lat: number;
  lng: number;
}

const pinIcon = (status: TravelStatus, active = false) =>
  L.divIcon({
    className: `pin pin-${status} ${active ? 'is-active' : ''}`,
    html: '<span class="pin-dot"></span>',
    iconSize: [30, 40],
    iconAnchor: [15, 38],
  });

const tempIcon = L.divIcon({ className: 'pin pin-temp', html: '<span class="pin-dot"></span>', iconSize: [30, 40], iconAnchor: [15, 38] });

export function MapView({ focusId, initialPlacing, top }: { focusId?: string; initialPlacing?: boolean; top: boolean }) {
  const ui = useUI();
  const items = useStore((s) => s.items);
  const dests = useMemo(() => items.filter((i) => i.type === 'destination'), [items]);
  const [filter, setFilter] = useState<TravelStatus | 'all'>('all');
  const [selected, setSelected] = useState<string | null>(focusId ?? null);
  const [placing, setPlacing] = useState(!!initialPlacing);
  const [online, setOnline] = useState(navigator.onLine);
  const [tileErrors, setTileErrors] = useState(0);
  const [showList, setShowList] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');

  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const temp = useRef<L.Marker | null>(null);
  const placingRef = useRef(placing);
  placingRef.current = placing;

  const visible = useMemo(() => dests.filter((d) => filter === 'all' || d.travelStatus === filter), [dests, filter]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Création de la carte
  useEffect(() => {
    if (!mapEl.current) return;
    const m = L.map(mapEl.current, {
      center: [30, 10],
      zoom: 2,
      minZoom: 2,
      maxZoom: 18,
      worldCopyJump: true,
      zoomControl: true,
      attributionControl: true,
    });
    m.attributionControl.setPrefix(false);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">Contributeurs OpenStreetMap</a>',
    });
    tiles.on('tileerror', () => setTileErrors((n) => n + 1));
    tiles.on('tileload', () => setTileErrors(0));
    tiles.addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => {
      if (!placingRef.current) {
        setSelected(null);
        return;
      }
      const { lat, lng } = e.latlng.wrap();
      temp.current?.remove();
      temp.current = L.marker([lat, lng], { icon: tempIcon }).addTo(m);
      setPlacing(false);
      ui.open({
        kind: 'edit',
        draft: newItem('destination', { zoneId: 'voyages', preset: { lat: round(lat), lng: round(lng) } }),
      });
    });
    map.current = m;
    const t = window.setTimeout(() => m.invalidateSize(), 120);
    return () => {
      clearTimeout(t);
      m.remove();
      map.current = null;
      markers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le repère temporaire disparaît quand on revient sur la carte
  useEffect(() => {
    if (top) {
      temp.current?.remove();
      temp.current = null;
      map.current?.invalidateSize();
    }
  }, [top]);

  // Repères des destinations
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const keep = new Set<string>();
    for (const d of visible) {
      if (d.lat == null || d.lng == null) continue;
      keep.add(d.id);
      const status = d.travelStatus ?? 'a-decouvrir';
      let mk = markers.current.get(d.id);
      if (!mk) {
        mk = L.marker([d.lat, d.lng], { icon: pinIcon(status, d.id === selected), title: d.title, keyboard: true });
        mk.on('click', () => setSelected(d.id));
        mk.addTo(m);
        markers.current.set(d.id, mk);
      } else {
        mk.setLatLng([d.lat, d.lng]);
        mk.setIcon(pinIcon(status, d.id === selected));
      }
      mk.options.title = d.title;
    }
    for (const [id, mk] of markers.current) {
      if (!keep.has(id)) {
        mk.remove();
        markers.current.delete(id);
      }
    }
  }, [visible, selected]);

  // Centrage initial sur la destination demandée
  useEffect(() => {
    const d = dests.find((x) => x.id === focusId);
    if (d && d.lat != null && d.lng != null) map.current?.setView([d.lat, d.lng], 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const flyTo = (d: Item) => {
    setSelected(d.id);
    setShowList(false);
    if (d.lat != null && d.lng != null) map.current?.flyTo([d.lat, d.lng], Math.max(map.current.getZoom(), 5), { duration: 0.8 });
  };

  const search = async () => {
    if (!q.trim()) return;
    setSearching(true);
    setSearchErr('');
    setResults(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&accept-language=fr&q=${encodeURIComponent(q.trim())}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        name?: string;
        display_name: string;
        lat: string;
        lon: string;
        address?: { country?: string };
      }[];
      setResults(
        data.map((r) => ({
          name: r.name || r.display_name.split(',')[0],
          full: r.display_name,
          country: r.address?.country ?? '',
          lat: Number(r.lat),
          lng: Number(r.lon),
        })),
      );
    } catch {
      setSearchErr('La recherche nécessite Internet et n’a pas pu aboutir. Vous pouvez placer un repère directement sur la carte.');
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: GeoResult) => {
    const m = map.current;
    if (m) {
      temp.current?.remove();
      temp.current = L.marker([r.lat, r.lng], { icon: tempIcon }).addTo(m);
      m.flyTo([r.lat, r.lng], 8, { duration: 0.8 });
    }
    setResults(null);
    setSearchOpen(false);
    ui.open({
      kind: 'edit',
      draft: newItem('destination', { zoneId: 'voyages', preset: { title: r.name, country: r.country, lat: round(r.lat), lng: round(r.lng) } }),
    });
  };

  const sel = dests.find((d) => d.id === selected);
  const noCoords = dests.filter((d) => d.lat == null || d.lng == null);

  return (
    <Sheet title="Carte de mes voyages" onClose={ui.close} top={top} size="full" className="mapview">
      <div className="map-bar">
        <div className="chips-row" role="group" aria-label="Filtrer par statut">
          <button className={`chip ${filter === 'all' ? 'is-on' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            Toutes
          </button>
          {(Object.keys(TRAVEL_STATUS) as TravelStatus[]).map((s) => (
            <button key={s} className={`chip travel-chip travel-${s} ${filter === s ? 'is-on' : ''}`} aria-pressed={filter === s} onClick={() => setFilter(s)}>
              {TRAVEL_STATUS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="map-wrap">
        <div ref={mapEl} className={`map ${placing ? 'is-placing' : ''}`} role="region" aria-label="Carte du monde interactive" />

        {(!online || tileErrors > 4) && (
          <div className="map-offline" role="status">
            La carte nécessite une connexion Internet. Vos destinations restent accessibles dans la liste.
          </div>
        )}

        {placing && (
          <div className="map-hint" role="status">
            Touchez la carte à l’endroit de la destination…
            <button className="btn ghost small" onClick={() => setPlacing(false)}>
              Annuler
            </button>
          </div>
        )}

        <div className="map-tools">
          <button className={`btn ${placing ? 'soft' : 'primary'}`} onClick={() => setPlacing((p) => !p)} aria-pressed={placing}>
            {placing ? 'Placement…' : '+ Placer un repère'}
          </button>
          <button className="btn soft" onClick={() => setSearchOpen((s) => !s)} aria-expanded={searchOpen}>
            Rechercher
          </button>
          <button className="btn soft" onClick={() => setShowList((s) => !s)} aria-expanded={showList}>
            Liste ({visible.length})
          </button>
        </div>

        {searchOpen && (
          <div className="map-search">
            <form
              className="url-row"
              onSubmit={(e) => {
                e.preventDefault();
                void search();
              }}
            >
              <input className="input" type="search" placeholder="Ville, pays, lieu…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un lieu" autoFocus />
              <button className="btn primary" disabled={searching || !q.trim()}>
                {searching ? '…' : 'OK'}
              </button>
            </form>
            {searchErr && <p className="field-error">{searchErr}</p>}
            {results && results.length === 0 && <p className="muted">Aucun résultat.</p>}
            {results && results.length > 0 && (
              <ul className="geo-results">
                {results.map((r, i) => (
                  <li key={i}>
                    <button onClick={() => pickResult(r)}>
                      <strong>{r.name}</strong>
                      <span className="muted">{r.full}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="field-hint">Recherche en ligne via Nominatim (© OpenStreetMap). Nécessite Internet.</p>
          </div>
        )}

        {sel && !showList && (
          <div className="map-card">
            <Photo photo={sel.photos[0]} alt="" fallbackLabel={sel.title} />
            <div className="map-card-text">
              <strong>{sel.title}</strong>
              <span className="muted">
                {sel.country} · {TRAVEL_STATUS[sel.travelStatus ?? 'a-decouvrir']}
                {sel.suggestion ? ' · suggestion' : ''}
              </span>
              <button className="btn primary small" onClick={() => ui.open({ kind: 'item', id: sel.id })}>
                Ouvrir la fiche
              </button>
            </div>
            <button className="icon-btn small map-card-close" onClick={() => setSelected(null)} aria-label="Fermer l’aperçu">
              ✕
            </button>
          </div>
        )}

        {showList && (
          <div className="map-list">
            {visible.length === 0 && <p className="empty">Aucune destination avec ce statut.</p>}
            <ul className="rows">
              {visible.map((d) => (
                <li key={d.id}>
                  <button className="row" onClick={() => (d.lat != null ? flyTo(d) : ui.open({ kind: 'item', id: d.id }))}>
                    <Photo photo={d.photos[0]} alt="" className="row-photo" fallbackLabel={d.title} />
                    <span className="row-text">
                      <strong>{d.title}</strong>
                      <span className="muted">
                        {d.country} · {TRAVEL_STATUS[d.travelStatus ?? 'a-decouvrir']}
                        {d.lat == null ? ' · sans coordonnées' : ''}
                        {d.suggestion ? ' · suggestion' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {noCoords.length > 0 && <p className="field-hint">Les destinations sans coordonnées n’apparaissent pas sur la carte : ajoutez-les depuis leur fiche.</p>}
          </div>
        )}
      </div>
    </Sheet>
  );
}

const round = (n: number) => Math.round(n * 10000) / 10000;
