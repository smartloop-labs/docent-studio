import { Tooltip } from '@mui/material';
import {
  buildFlow,
  condenseFlow,
  flowSummary,
  fmtMs,
  NodeKind,
  turnDuration,
  TraceTurn,
} from '@/app/services/run-trace.service';

/**
 * The routing log for one turn, as rendered in the Logs panel.
 *
 * A turn is a sequence of hops the backend narrates over SSE: the model the
 * orchestrator picked (sometimes several), a document search, a tool,
 * generation. Shown as what was involved (models, skills, tools), then one row
 * per hop that did something, each with a bar placed on the run's timeline —
 * the way a network panel shows where the time went. The chat itself stays
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

/** An outlined label, per the app's badge style. */
function Label({ children, brand = false }: { children: React.ReactNode; brand?: boolean }) {
  return (
    <span
      className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase border ${brand ? 'text-sl-brand-primary opacity-70' : 'text-sl-text-faint border-sl-border-default'}`}
      style={brand ? { borderColor: 'var(--sl-brand-alpha-30)' } : undefined}
    >
      {children}
    </span>
  );
}

/**
 * The log itself: what the run involved, then a row per hop with its share of
 * the run's time as a bar on a shared timeline.
 *
 * A bar here is a span on the timeline, not progress toward done: it starts
 * where the hop started and is as long as the hop took, so the long ones —
 * usually choosing a tool and generating — stand out without reading numbers.
 * The hop in flight grows as it runs.
 */
export function FlowLog({ turn, now }: { turn: TraceTurn; now: number }) {
  const nodes = condenseFlow(buildFlow(turn, now));
  const { models, skills, tools } = flowSummary(turn, nodes);
  const total = Math.max(1, turnDuration(turn, now));
  const pct = (ms: number) => `${Math.min(100, Math.max(0, (ms / total) * 100))}%`;
  const hasSummary = models.length > 0 || skills > 0 || tools.length > 0 || !!turn.tokensPerSecond;

  return (
    <div className="flex flex-col gap-2.5">
      {hasSummary && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {models.map((m) => <Label key={m} brand>{m}</Label>)}
          {skills > 0 && <Label>{skills} {skills === 1 ? 'skill' : 'skills'}</Label>}
          {tools.map((t) => <Label key={t}>{t}</Label>)}
          {!!turn.tokensPerSecond && (
            <span className="ml-auto text-[10px] font-mono tabular-nums text-sl-text-faint">
              {turn.tokensPerSecond.toFixed(0)} tok/s
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {nodes.map((n, i) => {
          const isTerminal = n.kind === 'answer' || n.kind === 'halted';
          const failed = isTerminal && turn.outcome === 'error';
          const ms = isTerminal ? total : n.ms;
          // A hop that took a quarter of a run worth timing is where the time went.
          const slow = !isTerminal && ms != null && total >= 1000 && ms >= total / 4;
          return (
            <div key={`${n.kind}-${i}-${n.label}`} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`flex items-center flex-shrink-0 ${n.kind === 'model' ? 'text-sl-brand-primary' : failed ? 'text-sl-status-error' : 'text-sl-text-faint'}`}>
                  <NodeGlyph kind={n.kind} />
                </span>
                <Tooltip title={n.label} placement="left" arrow>
                  <span className="text-[11px] flex-1 min-w-0 truncate cursor-default text-sl-text-muted">
                    {n.model ? (
                      <>
                        <span className="font-semibold text-sl-text-secondary">{n.model}</span>
                        <span className="text-sl-text-faint"> for {n.purpose}</span>
                      </>
                    ) : (
                      <span className={failed ? 'text-sl-status-error' : isTerminal ? 'text-sl-text-secondary' : ''}>{n.label}</span>
                    )}
                    {n.running ? '…' : ''}
                  </span>
                </Tooltip>
                {ms != null && (isTerminal || ms >= 50 || n.running) && (
                  <span className={`text-[10px] font-mono tabular-nums flex-shrink-0 ${slow ? 'text-sl-brand-primary' : 'text-sl-text-faint'}`}>
                    {fmtMs(ms)}
                  </span>
                )}
              </div>
              {!isTerminal && ms != null && ms >= 50 && (
                // The hop's span on the run's timeline. Left and width are
                // the data, so they're the one thing set inline.
                <div className="relative h-[3px] ml-5 rounded-full overflow-hidden bg-sl-border-subtle">
                  <span
                    className={`absolute inset-y-0 rounded-full ${slow ? 'bg-sl-brand-primary' : 'bg-sl-text-disabled'} ${n.running ? 'animate-pulse' : ''}`}
                    style={{ left: pct(n.at), width: `max(3px, ${pct(ms)})` }}
                  />
                </div>
              )}
              {n.detail && !isTerminal && (
                <span className="block text-[10px] ml-5 break-words text-sl-text-faint">{n.detail}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
