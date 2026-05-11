// Parsing & formatting helpers used across components.

export const pad2 = (n) => String(n).padStart(2, '0');

export const formatPrice = (n) => {
  if (!n) return "—";
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `$${(v >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(/\.?0+$/, '')}M`;
  }
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString()}`;
};

// Extract the agent's tagged blocks (<<<LISTINGS>>>, <<<FOLLOWUPS>>>, <<<MORTGAGE>>>)
// and return the cleaned prose alongside the parsed structures.
export function parseAgentResponse(text) {
  let listings = null;
  let followups = [];
  let mortgage = null;

  const m1 = text.match(/<<<LISTINGS:(\[[\s\S]*?\])>>>/);
  if (m1) { try { listings = JSON.parse(m1[1]); } catch {} }
  const m2 = text.match(/<<<FOLLOWUPS:(\[[\s\S]*?\])>>>/);
  if (m2) { try { followups = JSON.parse(m2[1]); } catch {} }
  // Dedupe followups (model occasionally repeats the same suggestion)
  if (Array.isArray(followups) && followups.length) {
    followups = Array.from(new Set(followups.map(f => String(f).trim()))).filter(Boolean);
  }
  const m3 = text.match(/<<<MORTGAGE:(\{[\s\S]*?\})>>>/);
  if (m3) { try { mortgage = JSON.parse(m3[1]); } catch {} }

  let clean = text
    .replace(/<<<LISTINGS:[\s\S]*?>>>/g, '')
    .replace(/<<<FOLLOWUPS:[\s\S]*?>>>/g, '')
    .replace(/<<<MORTGAGE:[\s\S]*?>>>/g, '')
    .trim();

  // While streaming, hide any unclosed `<<<...` block until its `>>>` arrives.
  const open = clean.indexOf('<<<');
  if (open !== -1) clean = clean.slice(0, open).trim();

  // Strip bullet lines from prose that duplicate followup chips (model sometimes
  // emits the same suggestion in both places, e.g. "* Tell me about ..." + chip).
  if (followups.length > 0) {
    const followupSet = new Set(followups.map(f => f.toLowerCase().replace(/[?.!\s]+$/, '')));
    clean = clean
      .split('\n')
      .filter(line => {
        const m = line.trim().match(/^[*\-•]\s+(.+)/);
        if (!m) return true;
        const item = m[1].toLowerCase().replace(/[?.!\s]+$/, '');
        return !followupSet.has(item);
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return { clean, listings, followups, mortgage };
}

// Merge raw tool-result data (image, sqft, lat, lng) onto agent-emitted listings.
export function mergeListingData(parsed, tool) {
  if (!parsed || !parsed.length) return tool || [];
  if (!tool || !tool.length) return parsed;
  const byId = Object.fromEntries(tool.map(t => [String(t.id), t]));
  return parsed.map(l => {
    const t = byId[String(l.id)];
    if (!t) return l;
    return {
      ...l,
      image: l.image || t.image,
      sqft:  l.sqft  || t.sqft,
      lat:   l.lat ?? t.lat,
      lng:   l.lng ?? t.lng,
    };
  });
}
