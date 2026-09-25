import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CategorySection, Item } from './types';
import type { BackupPreview } from './db/backup';

export type SheetDesc =
  | { kind: 'item'; id: string }
  | { kind: 'edit'; id?: string; draft?: Item }
  | { kind: 'add'; zoneId: string }
  | { kind: 'dressing'; tab?: DressingTab }
  | { kind: 'list'; section?: ListSection }
  | { kind: 'settings' }
  | { kind: 'credits' }
  | { kind: 'categories'; section: CategorySection }
  | { kind: 'import'; preview: BackupPreview }
  | { kind: 'map'; focusId?: string; placing?: boolean };

export type DressingTab = 'vetements' | 'tenues' | 'capsules' | 'achats';
export type ListSection = 'deco' | 'dressing' | 'classe' | 'voyages' | 'notes' | 'favoris';

export interface Toast {
  id: number;
  message: string;
  tone?: 'info' | 'error';
  action?: { label: string; run: () => void };
  onExpire?: () => void;
  duration?: number;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface UIContext {
  stack: SheetDesc[];
  open: (s: SheetDesc) => void;
  replace: (s: SheetDesc) => void;
  close: () => void;
  closeAll: () => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<UIContext | null>(null);

export function useUI() {
  const c = useContext(Ctx);
  if (!c) throw new Error('UIProvider manquant');
  return c;
}

let toastSeq = 1;

export function UIProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<SheetDesc[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirm] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const depth = useRef(0);

  // Chaque panneau ouvert correspond à une entrée d'historique : le bouton « retour » du téléphone le ferme.
  useEffect(() => {
    // Au chargement, on repart d'un état propre (pas de panneau fantôme après actualisation)
    if ((history.state as { uo?: number } | null)?.uo) {
      history.replaceState({ uo: 0 }, '');
    }
    const onPop = (e: PopStateEvent) => {
      const d = (e.state as { uo?: number } | null)?.uo ?? 0;
      depth.current = d;
      setStack((s) => s.slice(0, d));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const open = useCallback((s: SheetDesc) => {
    depth.current += 1;
    history.pushState({ uo: depth.current }, '');
    setStack((st) => [...st.slice(0, depth.current - 1), s]);
  }, []);

  const replace = useCallback((s: SheetDesc) => {
    setStack((st) => (st.length ? [...st.slice(0, -1), s] : st));
  }, []);

  const close = useCallback(() => {
    if (depth.current > 0) history.back();
  }, []);

  const closeAll = useCallback(() => {
    if (depth.current > 0) history.go(-depth.current);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((ts) => {
      const t = ts.find((x) => x.id === id);
      t?.onExpire?.();
      return ts.filter((x) => x.id !== id);
    });
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = toastSeq++;
      setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
      window.setTimeout(() => dismissToast(id), t.duration ?? (t.action ? 7000 : 4000));
    },
    [dismissToast],
  );

  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirm({ ...o, resolve })),
    [],
  );

  const value = useMemo(
    () => ({ stack, open, replace, close, closeAll, toast, toasts, dismissToast, confirm }),
    [stack, open, replace, close, closeAll, toast, toasts, dismissToast, confirm],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {confirmState && (
        <ConfirmDialog
          {...confirmState}
          onDone={(v) => {
            confirmState.resolve(v);
            setConfirm(null);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

function ConfirmDialog(props: ConfirmOptions & { onDone: (v: boolean) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onDone(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props]);
  return (
    <div className="confirm-backdrop" onClick={() => props.onDone(false)}>
      <div
        className="confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title">{props.title}</h2>
        {props.message && <p>{props.message}</p>}
        <div className="confirm-actions">
          <button ref={ref} className="btn ghost" onClick={() => props.onDone(false)}>
            {props.cancelLabel ?? 'Annuler'}
          </button>
          <button className={`btn ${props.danger ? 'danger' : 'primary'}`} onClick={() => props.onDone(true)}>
            {props.confirmLabel ?? 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
