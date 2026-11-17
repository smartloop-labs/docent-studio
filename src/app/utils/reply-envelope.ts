// Unwraps a reply a small model wrapped in a JSON envelope.
//
// Answering from tool output or fetched pages, a small local model sometimes
// switches mid-reply from prose into
//
//   MaxCore Cloud is a```json
//   {
//     "response": "MaxCore Cloud aggregates ... "absurd pricing" ... common in the```
//   </code>
//
// — an object nobody asked for, usually not even valid JSON (unescaped inner
// quotes, no closing brace, a stray `</code>`). The framework passes replies
// through untouched because it also serves a coding harness, where JSON is a
// real answer, so the chat view is where this gets cleaned up.
//
// Kept narrow so a JSON answer the user asked for survives: only an object
// whose sole key is `response`, `answer` or `reply` holding a string, either
// fenced as ```json or opening the reply, and nothing but trailing junk after
// it. An object with any other key is left as written. Works on a partial
// reply too, so a streaming answer shows as prose from the first token.

const KEY = '(?:response|answer|reply)';
// A ```json fence anywhere (models glue it onto the prose before it).
const FENCED_OPEN = new RegExp('```json[ \\t]*\\n\\s*\\{\\s*"' + KEY + '"\\s*:\\s*"', 'i');
// A bare object opening the reply.
const BARE_OPEN = new RegExp('^\\s*\\{\\s*"' + KEY + '"\\s*:\\s*"');
// What models leave after the value: closing quote/brace/fence, stray tags.
const TRAILING_JUNK = /(?:\s|```|<\/?code>|<\/?pre>)+$/;
// A second key: the object carries more than a reply.
const ANOTHER_KEY = /"\s*,\s*"[\w-]+"\s*:/;
// The reply's prose before the envelope ended a thought.
const SENTENCE_END = /[.!?:)\]"'*`]$/;

function unescapeJson(value: string): string {
  return value.replace(/\\(u[0-9a-fA-F]{4}|["\\/bfnrt])/g, (_m, esc: string) => {
    if (esc[0] === 'u') return String.fromCharCode(parseInt(esc.slice(1), 16));
    return ({ n: '\n', t: '\t', r: '', b: '', f: '' } as Record<string, string>)[esc] ?? esc;
  });
}

export function unwrapReplyEnvelope(reply: string): string {
  if (!reply || !reply.includes('{')) return reply;
  const match = reply.match(FENCED_OPEN) ?? reply.match(BARE_OPEN);
  if (!match || match.index === undefined) return reply;

  let value = reply.slice(match.index + match[0].length);
  if (ANOTHER_KEY.test(value)) return reply;

  // Peel the end of the envelope: junk, the closing brace, the closing quote.
  // Anything else after the brace means it wasn't the whole reply — leave it.
  value = value.replace(TRAILING_JUNK, '');
  const close = value.match(/"\s*\}$/);
  if (close) {
    value = value.slice(0, close.index);
  } else if (/\}\s*\S/.test(value.slice(value.lastIndexOf('"')))) {
    return reply;
  }
  value = unescapeJson(value).trim();

  // Prose before the envelope is kept when it finished a thought; a fragment
  // ("MaxCore Cloud is a") is a false start the envelope restates.
  const before = reply.slice(0, match.index).trimEnd();
  if (before && SENTENCE_END.test(before)) return `${before}\n\n${value}`;
  return value;
}
