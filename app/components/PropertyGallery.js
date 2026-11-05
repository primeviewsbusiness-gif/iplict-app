'use client';

import { useState } from 'react';

export default function PropertyGallery({ images = [], title = 'Imóvel' }) {
  const [active, setActive] = useState(0);
  const safeImages = images.filter((src) => typeof src === 'string' && /^https?:\/\//i.test(src));
  if (!safeImages.length) return null;
  const current = safeImages[Math.min(active, safeImages.length - 1)];

  return (
    <div className="property-gallery" aria-label={`Galeria de ${title}`}>
      <div className="property-gallery-main">
        <img src={current} alt={`${title} — imagem ${active + 1}`} loading="lazy" referrerPolicy="no-referrer" />
      </div>
      {safeImages.length > 1 && <div className="property-gallery-thumbs" role="list" aria-label="Selecionar imagem">
        {safeImages.slice(0, 6).map((src, index) => <button type="button" key={`${src}-${index}`} className={index === active ? 'active' : ''} onClick={() => setActive(index)} aria-label={`Ver imagem ${index + 1}`}><img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" /></button>)}
      </div>}
    </div>
  );
}
