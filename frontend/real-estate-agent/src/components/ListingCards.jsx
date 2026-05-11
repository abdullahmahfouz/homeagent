import { useState } from 'react';
import { Icons } from './Icons.jsx';
import { formatPrice, pad2 } from '../lib/parse.js';

// Big inline card shown in chat alongside the assistant's response.
export function ListingCard({ prop, index, active, onClick }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <button className={`listing-card ${active ? 'active' : ''}`} onClick={() => onClick(prop)}>
      <div className="listing-img-wrap">
        {prop.image && !imgFailed ? (
          <img
            src={prop.image}
            alt={prop.address}
            className="listing-img"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="listing-img-fallback"><Icons.Home/></div>
        )}
        {typeof index === 'number' && <div className="listing-rank">{pad2(index + 1)}</div>}
        {prop.score != null && (
          <div className="listing-score">
            <span className="star">★</span>{prop.score}
          </div>
        )}
      </div>
      <div className="listing-body">
        <div className="listing-price-row">
          <span className="listing-price">{formatPrice(prop.price)}</span>
          {prop.walkScore != null && (
            <span className="listing-walk">walk <b>{prop.walkScore}</b></span>
          )}
        </div>
        <div className="listing-addr">{prop.address}</div>
        {prop.neighborhood && <div className="listing-neigh">{prop.neighborhood}</div>}
        <div className="listing-meta">
          <span className="meta-chip">{prop.beds} bd</span>
          <span className="meta-chip">{prop.baths} ba</span>
          {prop.sqft ? <span className="meta-chip">{prop.sqft.toLocaleString()} sqft</span> : null}
          {prop.commute && <span className="meta-chip">{prop.commute}</span>}
        </div>
        {prop.why && <div className="listing-why">{prop.why}</div>}
      </div>
    </button>
  );
}

// Compact sidebar thumb.
export function SideCard({ prop, active, onClick }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <button className={`side-card ${active ? 'active' : ''}`} onClick={() => onClick(prop)}>
      {prop.image && !imgFailed ? (
        <img
          src={prop.image}
          alt=""
          className="side-card-img"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="side-card-img placeholder"><Icons.Home/></div>
      )}
      <div className="side-card-info">
        <div className="side-card-price">{formatPrice(prop.price)}</div>
        <div className="side-card-addr">{prop.address}</div>
        <div className="side-card-meta">
          {prop.beds}bd · {prop.baths}ba{prop.sqft ? ` · ${prop.sqft.toLocaleString()}sf` : ''}
        </div>
      </div>
    </button>
  );
}
