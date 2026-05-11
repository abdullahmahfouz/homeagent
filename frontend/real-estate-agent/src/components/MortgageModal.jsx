import { useState } from 'react';
import { formatPrice } from '../lib/parse.js';
import { calcMortgage } from '../lib/mortgage.js';

export function MortgageModal({ property, onClose }) {
  const [downPct, setDownPct] = useState(20);
  const [years, setYears]     = useState(30);
  const [rate, setRate]       = useState(7.0);
  const price = property?.price || 750000;
  const r = calcMortgage(price, downPct, years, rate);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-eyebrow">Affordability</div>
        <div className="modal-title">Mortgage estimate</div>
        <div className="modal-sub">
          <b>{property?.address}</b> · {formatPrice(price)}
        </div>

        <div className="field">
          <div className="field-head">
            <span className="field-label">Down payment</span>
            <span className="field-value">{downPct}%<em>${(price * downPct / 100 / 1000).toFixed(0)}k</em></span>
          </div>
          <input type="range" min="3" max="50" value={downPct} step="1"
                 onChange={e => setDownPct(+e.target.value)}/>
        </div>
        <div className="field">
          <div className="field-head">
            <span className="field-label">Loan term</span>
            <span className="field-value">{years}<em>years</em></span>
          </div>
          <input type="range" min="10" max="30" value={years} step="5"
                 onChange={e => setYears(+e.target.value)}/>
        </div>
        <div className="field">
          <div className="field-head">
            <span className="field-label">Interest rate</span>
            <span className="field-value">{rate.toFixed(2)}<em>%</em></span>
          </div>
          <input type="range" min="3" max="9" value={rate} step="0.25"
                 onChange={e => setRate(+e.target.value)}/>
        </div>

        <div className="modal-result">
          <div className="result-row"><span className="rk">Down payment</span><span className="rv">${r.down.toLocaleString()}</span></div>
          <div className="result-row"><span className="rk">Loan amount</span><span className="rv">${r.principal.toLocaleString()}</span></div>
          <div className="result-row"><span className="rk">Principal & interest</span><span className="rv">${r.monthlyPI.toLocaleString()}/mo</span></div>
          {r.pmi > 0 && <div className="result-row"><span className="rk">PMI</span><span className="rv">${r.pmi.toLocaleString()}/mo</span></div>}
          <div className="result-row total">
            <span className="rk">Monthly payment</span>
            <span className="rv">${r.monthly.toLocaleString()}<span className="per"> /mo</span></span>
          </div>
        </div>

        <button className="modal-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
