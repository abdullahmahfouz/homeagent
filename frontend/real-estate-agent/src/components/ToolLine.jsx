import { Icons } from './Icons.jsx';
import { formatPrice } from '../lib/parse.js';

// The place goes in the sentence and the filters ride behind it, so a row
// reads "Searching MLS in Austin, TX  3+ bd, under $900k" rather than four
// fragments strung together with dots.
export function formatToolCall(name, args) {
  args = args || {};
  if (name === 'search_listings') {
    const where = [args.city, args.state].filter(Boolean).join(', ');
    const beds  = args.min_beds  ? `${args.min_beds}+ bd` : '';
    const cap   = args.max_price ? `under ${formatPrice(args.max_price)}` : '';
    return {
      text: where ? `Searching MLS in ${where}` : 'Searching MLS',
      detail: [beds, cap].filter(Boolean).join(', '),
    };
  }
  if (name === 'calculate_mortgage') {
    return { text: `Calculating mortgage for ${formatPrice(args.price || 0)}`, detail: '' };
  }
  return { text: name, detail: '' };
}

export function formatToolResult(name, result) {
  if (!result) return '';
  if (result.error) return 'error';
  if (name === 'search_listings') {
    const c = result.count || 0;
    return c === 0 ? 'no results' : `${c} listing${c === 1 ? '' : 's'}`;
  }
  if (name === 'calculate_mortgage' && result.monthly_payment) {
    return `$${result.monthly_payment.toLocaleString()}/mo`;
  }
  return '';
}

export function ToolLine({ event }) {
  const running = event.status === 'running';
  const call = formatToolCall(event.name, event.args);
  return (
    <div className={`tool-line ${running ? 'running' : 'done'}`}>
      {running
        ? <span className="spinner" aria-hidden="true"/>
        : <span className="check"><Icons.Check/></span>}
      <span className="tool-text">
        {call.text}
        {call.detail && <span className="tool-detail">{call.detail}</span>}
      </span>
      {!running && (
        <span className="tool-summary">{formatToolResult(event.name, event.result)}</span>
      )}
    </div>
  );
}
