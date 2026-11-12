import {
  buildFlow,
  fmtMs,
  fmtStamp,
  NodeKind,
  TraceTurn,
} from '@/app/services/run-trace.service';

/**
 * The routing log for one turn, as rendered in the Logs panel.
 *
 * A turn is a sequence of hops the backend narrates over SSE: the model the
 * orchestrator picked (sometimes several), a document search, a tool,
 * generation. Shown as a plain log of those lines. The chat itself stays
 * clean; the panel is the only place this shows.
 */

/** A glyph per hop kind — identity never rests on color alone. */
export function NodeGlyph({ kind, size = 12 }: { kind: NodeKind; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', className: 'flex-shrink-0' };
  switch (kind) {
    case 'model':
      // A chip, not a sparkle: the sparkle is the picker's "Auto" mark and reads
      // as magic, where this row is a specific model doing specific work.
      return (
        <svg {...common}>
          <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.1" />
          <path d="M6.5 2.2v2.3M9.5 2.2v2.3M6.5 11.5v2.3M9.5 11.5v2.3M2.2 6.5h2.3M2.2 9.5h2.3M11.5 6.5h2.3M11.5 9.5h2.3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
      );
    case 'retrieval':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.1" />
          <path d="M10.2 10.2L14 14" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      );
    case 'tool':
      return (
        <svg {...common}>
          <path d="M6.5 2.5v4M9.5 2.5v4M4.5 6.5h7v2a3.5 3.5 0 01-7 0v-2zM8 12v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'prompt':
      return (
        <svg {...common}>
          <path d="M2.5 4.5h11v6h-6l-3 2.5v-2.5h-2v-6z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        </svg>
      );
    case 'answer':
      // The sparkle lands here, on the thing the whole run was for — a tick just
      // means "no error", which is a lower bar than "here is your answer".
      return (
        <svg {...common}>
          <path d="M8 2l1.6 4.4L14 8l-4.4 1.6L8 14l-1.6-4.4L2 8l4.4-1.6L8 2z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        </svg>
      );
    case 'halted':
      // Stopped or failed: a barred circle, so an unfinished run never wears the
      // same mark as a delivered answer.
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.4" stroke="currentColor" strokeWidth="1.1" />
          <path d="M5.4 8h5.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      );
  }
}

/**
 * The log itself: every line the backend sent for the run, verbatim, stamped
 * from the run's start, with how long it lasted — nothing hidden, merged or
 * summarised. Then how the run ended.
 */
export function FlowLog({ turn, now }: { turn: TraceTurn; now: number }) {
  const nodes = buildFlow(turn, now).filter((n) => n.kind !== 'prompt');

  // Sized to be read, not scanned: 12px text on a 20px line with air between
  // entries, the message in readable ink, and the stamp and duration as quiet
  // fixed columns either side so the eye runs down the words, not the numbers.
  return (
    <div className="flex flex-col gap-2">
      {nodes.map((n, i) => {
        const isTerminal = n.kind === 'answer' || n.kind === 'halted';
        const failed = isTerminal && turn.outcome === 'error';
        const ms = isTerminal ? undefined : n.ms;
        return (
          <div
            key={`${n.kind}-${i}-${n.label}`}
            className={`flex items-start gap-3 min-w-0 ${isTerminal ? 'mt-1 pt-2.5 border-t border-sl-border-subtle' : ''}`}
          >
            <span className="w-11 text-right text-[10px] leading-5 font-mono tabular-nums flex-shrink-0 text-sl-text-disabled">
              {fmtStamp(n.at)}
            </span>
            <span
              className={`text-[12px] leading-5 flex-1 min-w-0 break-words ${failed ? 'text-sl-status-error' : isTerminal ? 'font-medium text-sl-text-primary' : 'text-sl-text-secondary'}`}
            >
              {n.label}{n.running ? '…' : ''}
              {n.detail && <span className="text-sl-text-faint"> · {n.detail}</span>}
            </span>
            <span className="w-11 text-right text-[10px] leading-5 font-mono tabular-nums flex-shrink-0 text-sl-text-faint">
              {ms != null && ms >= 50 ? fmtMs(ms) : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
