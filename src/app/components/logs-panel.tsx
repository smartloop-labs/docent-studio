import { useEffect, useState } from 'react';
import { runTrace, turnDuration, fmtMs, TraceTurn } from '@/app/services/run-trace.service';
import { FlowLog } from './routing-trace';

/**
 * Logs — what the model did on each run.
 *
 * The question this answers is "what is it doing, and who is doing it": the
 * orchestrator picked a model (sometimes several in one turn), maybe searched
 * documents, then generated. That routing is narrated over SSE as `chat.status`
 * events, each line previously overwriting the last in the composer — so the
 * shape of a turn was never visible, only its most recent instant.
 *
 * Only the current run — the one in flight, or the one that just finished. A
 * list of past runs sat under it, but each of those is already a message in the
 * chat, and the panel's question is "what is it doing now", not an archive.
 * The run survives a restart (the store hydrates finished runs from SQLite), so
 * the panel isn't empty after one.
 *
 * Speed deliberately isn't here: tok/s is a machine stat, not routing, and it
 * already has a home in the composer footer.
 */

/**
 * A log stamp that degrades the way every list of dated things does: the clock
 * for today, the date once it isn't, the year once that changes. A bare
 * `21:04` on a week-old run is a lie by omission — it reads as this evening.
 */
const stamp = (ms: number) => {
  const d = new Date(ms);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString(undefined, sameYear
    ? { month: 'short', day: 'numeric' }
    : { year: '2-digit', month: 'short', day: 'numeric' });
};

/** Everything about when, for the hover: full date, time, and how long ago. */
const stampTitle = (ms: number, now: number) => `${new Date(ms).toLocaleString()} · ${relative(ms, now)}`;

/** "just now" / "4m ago" / "2h ago" — kept for hover, where "how long ago" reads
 *  better than a wall clock. */
const relative = (ms: number, now: number): string => {
  const delta = Math.max(0, now - ms);
  if (delta < 45_000) return 'just now';
  const mins = Math.round(delta / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

/** A panel card: one bordered group, holding one thing. */
function Card({ lead, action, children }: { lead?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    // Transparent with a hairline border and 12/14 padding — the same card the
    // Skills and Connections panels use, so Activity doesn't read as a different
    // app. A filled surface made it the loudest thing in the sidebar.
    <section
      className="rounded-xl flex flex-col gap-2.5"
      style={{ padding: '12px 14px', border: '1px solid var(--sl-border-subtle)', backgroundColor: 'transparent' }}
    >
      {(lead || action) && (
        /* Identity on the left, its measure on the right. */
        <header className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 flex-1">{lead}</span>
          <span className="flex items-center gap-2 flex-shrink-0">{action}</span>
        </header>
      )}
      {children}
    </section>
  );
}

/** Forget the run shown. */
function ForgetButton({ id }: { id: string }) {
  return (
    <button
      type="button"
      onClick={() => runTrace.remove(id)}
      title="Forget this run"
      aria-label="Forget this run"
      className="flex items-center justify-center flex-shrink-0 rounded transition-colors"
      style={{
        width: 16,
        height: 16,
        background: 'none',
        border: 'none',
        padding: 0,
        color: 'var(--sl-text-disabled)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sl-status-error)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sl-text-disabled)'; }}
    >
      {/* A bin, not an ✕: this removes the record, where an ✕ in a list row
          usually means "close" or "dismiss from view". */}
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
        <path d="M2.8 4.3h10.4M6.3 4.3V3.1a.9.9 0 01.9-.9h1.6a.9.9 0 01.9.9v1.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M4.2 4.3l.6 8.4a1 1 0 001 .9h4.4a1 1 0 001-.9l.6-8.4" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M6.8 6.9v4M9.2 6.9v4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export default function LogsPanel({ projectId }: { projectId?: string }) {
  const [turns, setTurns] = useState<TraceTurn[]>(() => runTrace.getTurns(projectId));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setTurns(runTrace.getTurns(projectId));
    return runTrace.subscribe(() => setTurns(runTrace.getTurns(projectId)));
  }, [projectId]);

  const live = turns.length > 0 && !turns[0].endedAt;

  // Tick while a turn is in flight so the live stamps move; otherwise once a
  // minute, which is all the "4m ago" column needs.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), live ? 500 : 60_000);
    return () => clearInterval(id);
  }, [live]);

  const latest = turns[0];

  if (!latest) {
    return (
      <Card>
        <p className="m-0 text-[11px] leading-relaxed" style={{ color: 'var(--sl-text-faint)' }}>
          No runs yet. Send a prompt and the routing lands here — which model the
          orchestrator picked, what it searched, and how long each hop took.
        </p>
      </Card>
    );
  }

  return (
    <Card
      /* Named by where the run is, not what it asked: the log below is
         about it either way. */
      lead={(
        <span className="text-[12px] font-semibold text-sl-text-secondary">
          {live ? 'Running' : 'Last run'}
        </span>
      )}
      action={
        <>
          <span className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--sl-text-faint)' }}>
            {fmtMs(turnDuration(latest, now))}
          </span>
          <span
            className="text-[10px] font-mono tabular-nums"
            style={{ color: 'var(--sl-text-disabled)' }}
            title={live ? 'running now' : stampTitle(latest.startedAt, now)}
          >
            {live ? 'now' : stamp(latest.startedAt)}
          </span>
          {!live && <ForgetButton id={latest.id} />}
        </>
      }
    >
      <FlowLog turn={latest} now={now} />
    </Card>
  );
}
