// Normalizes how a reply writes math so Streamdown's KaTeX plugin renders it.
//
// Models write math three ways: `$…$` / `$$…$$`, which remark-math reads, and
// the LaTeX `\(…\)` / `\[…\]`, which it doesn't. The latter are rewritten to
// the dollar forms. Single-dollar inline math is on (see chat.tsx), which turns
// prose like "costs $5 and $10" into a formula, so a `$` that opens an amount
// is escaped. Fenced and inline code are left exactly as written.

const FENCE = /^\s*(`{3,}|~{3,})/;

// `$` that starts an amount: a number followed by a space, punctuation, an
// optional k/m/b suffix, or the end of the line — never by a closing `$` or
// more math ("$2x$", "$3$" stay math).
const CURRENCY = /(^|[^\\$\w])\$(?=\d[\d,]*(?:\.\d+)?[kKmMbB]?(?:[\s.,;:!?)]|$))/gm;

function normalizeProse(text: string): string {
  // Inline code spans are kept verbatim: odd indexes are the spans.
  return text
    .split(/(`+[^`\n]*?`+)/)
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part
        .replace(/\\\[([\s\S]+?)\\\]/g, (_m, body) => `$$${body}$$`)
        .replace(/\\\(([\s\S]+?)\\\)/g, (_m, body) => `$${body.trim()}$`)
        .replace(CURRENCY, (_m, lead) => `${lead}\\$`);
    })
    .join('');
}

export function normalizeMath(reply: string): string {
  if (!reply || !/[$\\]/.test(reply)) return reply;
  const lines = reply.split('\n');
  const out: string[] = [];
  let prose: string[] = [];
  let fence: string | null = null;

  const flush = () => {
    if (prose.length) out.push(normalizeProse(prose.join('\n')));
    prose = [];
  };

  for (const line of lines) {
    const m = line.match(FENCE);
    if (fence) {
      out.push(line);
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
    } else if (m) {
      flush();
      fence = m[1];
      out.push(line);
    } else {
      prose.push(line);
    }
  }
  flush();
  return out.join('\n');
}
