// Tiny inline markdown renderer. Handles **bold**, *italic*, `code`, and
// `*` / `-` / `•` bullet lists. Not a full markdown spec — just what the
// agent realistically emits.

function renderInline(text) {
  const out = [];
  const re = /\*\*(.+?)\*\*|\*([^*\n]+?)\*|`([^`\n]+?)`/g;
  let last = 0, m, key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={`s${key++}`}>{m[1]}</strong>);
    else if (m[2] !== undefined) out.push(<em key={`e${key++}`}>{m[2]}</em>);
    else if (m[3] !== undefined) out.push(<code key={`c${key++}`}>{m[3]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MarkdownProse({ text }) {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const blocks = [];
  let listBuf = [];
  for (const line of lines) {
    const trim = line.trim();
    const lm = trim.match(/^[*\-•]\s+(.+)/);
    if (lm) {
      listBuf.push(lm[1]);
    } else {
      if (listBuf.length) { blocks.push({ type: 'ul', items: listBuf }); listBuf = []; }
      blocks.push({ type: 'p', text: trim });
    }
  }
  if (listBuf.length) blocks.push({ type: 'ul', items: listBuf });

  return (
    <div className="prose">
      {blocks.map((b, i) =>
        b.type === 'ul'
          ? <ul key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>
          : <p key={i}>{renderInline(b.text)}</p>
      )}
    </div>
  );
}
