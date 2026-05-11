import { Icons } from './Icons.jsx';
import { formatPrice } from '../lib/parse.js';

export function formatToolCall(name, args) {
  args = args || {};
  if (name === 'search_listings') {
    const where = [args.city, args.state].filter(Boolean).join(', ');
    const beds  = args.min_beds  ? `${args.min_beds}+ bd` : '';
    const cap   = args.max_price ? `≤ ${formatPrice(args.max_price)}` : '';
    const tail  = [where, beds, cap].filter(Boolean).join(' · ');
    return tail ? `Searching MLS · ${tail}` : 'Searching MLS';
  }
  if (name === 'calculate_mortgage') {
    return `Calculating mortgage · ${formatPrice(args.price || 0)}`;
  }
  return name;
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
  return (
    <div className={`tool-line ${running ? 'running' : 'done'}`}>
      {running
        ? <span className="spinner" aria-hidden="true"/>
        : <span className="check"><Icons.Check/></span>}
      <span className="tool-text">{formatToolCall(event.name, event.args)}</span>
      {!running && (
        <span className="tool-summary">{formatToolResult(event.name, event.result)}</span>
      )}
    </div>
  );
}
