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

// `kind` maps each result to one of the four semantic tag colors: a tool
// call either failed (red), came back empty (yellow, a soft warning rather
// than a hard failure), found something (green), or returned a neutral
// figure like a price (blue). No 5th color, no decoration.
export function formatToolResult(name, result) {
  if (!result) return { text: '', kind: 'neutral' };
  if (result.error) return { text: 'error', kind: 'error' };
  if (name === 'search_listings') {
    const c = result.count || 0;
    return c === 0
      ? { text: 'no results', kind: 'empty' }
      : { text: `${c} listing${c === 1 ? '' : 's'}`, kind: 'success' };
  }
  if (name === 'calculate_mortgage' && result.monthly_payment) {
    return { text: `$${result.monthly_payment.toLocaleString()}/mo`, kind: 'info' };
  }
  return { text: '', kind: 'neutral' };
}

export function ToolLine({ event }) {
  const running = event.status === 'running';
  const call = formatToolCall(event.name, event.args);
  const summary = !running && formatToolResult(event.name, event.result);
  return (
    <div className={`tool-line ${running ? 'running' : 'done'}`}>
      {running
        ? <span className="spinner" aria-hidden="true"/>
        : <span className="check"><Icons.Check/></span>}
      <span className="tool-text">
        {call.text}
        {call.detail && <span className="tool-detail">{call.detail}</span>}
      </span>
      {summary && summary.text && (
        <span className={`tool-summary tool-summary--${summary.kind}`}>{summary.text}</span>
      )}
    </div>
  );
}
