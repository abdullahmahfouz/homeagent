import { Icons } from './Icons.jsx';
import { parseAgentResponse, mergeListingData } from '../lib/parse.js';
import { MarkdownProse } from './MarkdownProse.jsx';
import { ToolLine } from './ToolLine.jsx';
import { ListingCard } from './ListingCards.jsx';

// Match prose lines that look like manual tool narration ("Searching MLS...").
// Only used as a fallback when a message has no live `toolEvents`.
function isToolLine(l) {
  const lower = l.trim().toLowerCase();
  if (!lower.endsWith('...') && !lower.endsWith('…')) return false;
  return ['search', 'pull', 'check', 'fetch', 'running', 'querying',
          'calculating', 'ranking', 'broaden'].some(k => lower.includes(k));
}

export function AssistantTurn({ msg, activeId, onPropertyClick, onFollowup }) {
  const { clean, listings: parsedListings, followups } = parseAgentResponse(msg.content);
  const listings = mergeListingData(parsedListings, msg.toolListings || []);

  const lines = clean.split('\n');
  const fallbackToolLines = lines.filter(l => l.trim() && isToolLine(l));
  const proseText = lines.filter(l => !isToolLine(l)).join('\n').trim();

  return (
    <div className="turn">
      <div className="assistant-row">
        <div className="avatar"><Icons.Spark/></div>
        <div className="assistant-body">
          <div className="assistant-name">HomeAgent</div>

          {msg.toolEvents && msg.toolEvents.length > 0 ? (
            <div className="tool-stack">
              {msg.toolEvents.map((te, i) => (
                <ToolLine key={`${te.name}-${i}`} event={te}/>
              ))}
            </div>
          ) : fallbackToolLines.length > 0 ? (
            <div className="tool-stack">
              {fallbackToolLines.map((l, i) => (
                <div key={i} className="tool-line done">
                  <span className="check"><Icons.Check/></span>
                  <span className="tool-text">{l.trim().replace(/[.…]+$/, '')}</span>
                </div>
              ))}
            </div>
          ) : null}

          {proseText && <MarkdownProse text={proseText}/>}

          {listings && listings.length > 0 && (
            <div className={`listing-grid ${listings.length >= 2 ? 'dense' : ''}`}>
              {listings.map((p, i) => (
                <ListingCard
                  key={p.id || i}
                  prop={p}
                  index={i}
                  active={activeId === p.id}
                  onClick={onPropertyClick}
                />
              ))}
            </div>
          )}

          {followups.length > 0 && (
            <div className="followups">
              {followups.map((f, i) => (
                <button key={i} className="followup" onClick={() => onFollowup(f)}>{f}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
