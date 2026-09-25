import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  headerExtra?: ReactNode;
  size?: 'normal' | 'full';
  /** Seul le panneau du dessus répond au clavier */
  top: boolean;
  className?: string;
}

/** Panneau adapté au téléphone : plein écran en bas sur mobile, fenêtre centrée sur ordinateur. */
export function Sheet({ title, onClose, children, footer, headerExtra, size = 'normal', top, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    ref.current?.focus({ preventScroll: true });
    return () => {
      const el = previouslyFocused.current as HTMLElement | null;
      el?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!top) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.confirm')) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [top, onClose]);

  return (
    <div className={`sheet-root ${top ? 'is-top' : 'is-under'}`}>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        className={`sheet sheet-${size} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          {headerExtra}
          <button className="icon-btn sheet-close" onClick={onClose} aria-label="Fermer">
            <span aria-hidden="true">✕</span>
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </div>
  );
}
