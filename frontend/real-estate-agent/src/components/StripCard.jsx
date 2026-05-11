import { useState, useEffect, useRef } from 'react';
import { Icons } from './Icons.jsx';
import { formatPrice } from '../lib/parse.js';

// Compact horizontal-strip card. Scrolls into view when activated.
export function StripCard({ prop, active, onClick }) {
  const [imgFailed, setImgFailed] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [active]);

  return (
    <button
      ref={ref}
      className={`strip-card ${active ? 'active' : ''}`}
      onClick={() => onClick(prop)}
    >
      <div className="strip-img-wrap">
        {prop.image && !imgFailed ? (
          <img
            src={prop.image}
            alt=""
            className="strip-img"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="strip-img-fallback"><Icons.Home/></div>
        )}
        {prop.score != null && (
          <div className="strip-score"><span className="star">★</span>{prop.score}</div>
        )}
      </div>
      <div className="strip-body">
        <div className="strip-price">{formatPrice(prop.price)}</div>
        <div className="strip-addr">{prop.address}</div>
        <div className="strip-neigh">{prop.neighborhood}</div>
        <div className="strip-meta">
          {prop.beds}bd · {prop.baths}ba{prop.sqft ? ` · ${prop.sqft.toLocaleString()}sf` : ''}
        </div>
      </div>
    </button>
  );
}
