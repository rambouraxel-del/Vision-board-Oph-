/**
 * Enregistrement du service worker (mise en cache de l'interface pour le hors-ligne).
 * Les mises à jour ne touchent jamais IndexedDB : les données d'Ophélie sont conservées.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let waiting: ServiceWorker | null = null;

export function onUpdateReady(l: Listener) {
  listeners.add(l);
  if (waiting) l();
  return () => listeners.delete(l);
}

export function applyUpdate() {
  if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
  else location.reload();
}

function notify(w: ServiceWorker) {
  waiting = w;
  listeners.forEach((l) => l());
}

export function registerSW() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
      if (reg.waiting && navigator.serviceWorker.controller) notify(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) notify(nw);
        });
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        location.reload();
      });
      // Vérifier régulièrement s'il existe une nouvelle version
      setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => undefined);
      });
    } catch {
      /* hors ligne ou navigateur sans service worker : l'application fonctionne quand même */
    }
  });
}
