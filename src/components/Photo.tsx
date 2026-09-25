import { useState } from 'react';
import type { Photo as PhotoT } from '../types';
import { creditFor, usePhotoUrl } from '../lib/images';

interface Props {
  photo?: PhotoT;
  size?: 'small' | 'large';
  alt: string;
  className?: string;
  /** Afficher l'attribution sous l'image (fiches) */
  credit?: boolean;
  fallbackLabel?: string;
}

/** Image avec chargement différé et repli propre lorsqu'elle manque. */
export function Photo({ photo, size = 'small', alt, className = '', credit, fallbackLabel }: Props) {
  const { url, loading } = usePhotoUrl(photo, size);
  const [failed, setFailed] = useState<string | null>(null);
  const broken = !url || failed === url;
  const c = credit && photo?.kind === 'seed' ? creditFor(photo.ref) : undefined;

  return (
    <span className={`photo ${className} ${broken && !loading ? 'is-missing' : ''}`}>
      {!broken && (
        <img
          src={url!}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(url)}
        />
      )}
      {broken && !loading && (
        <span className="photo-fallback" role="img" aria-label={alt}>
          <span className="photo-fallback-mark" aria-hidden="true">
            ✿
          </span>
          {fallbackLabel && <span className="photo-fallback-text">{fallbackLabel}</span>}
        </span>
      )}
      {c && !broken && (
        <span className="photo-credit">
          Photo : {c.author} ·{' '}
          <a href={c.source} target="_blank" rel="noopener noreferrer">
            {c.license}
          </a>
        </span>
      )}
    </span>
  );
}
