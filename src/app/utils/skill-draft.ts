/**
 * Skills a reply drafts, ready to be created through the skills API.
 *
 * The framework no longer saves skills; asked for one, the model is told (see
 * skillHint in electron/chat-stream.js) to give it as a heredoc —
 *
 *   ```sh
 *   cat > skills/<name>/SKILL.md <<'EOF'
 *   ---
 *   name: <name>
 *   description: ...
 *   ---
 *   ...
 *   EOF
 *   ```
 *
 * — the same shape docent asks for. This finds those, so the app can create
 * each one the way the "/" command does.
 */

export interface SkillDraft {
  name: string;
  content: string;
}

// `cat > path <<'EOF'` / `cat > path << "EOF"` / `cat >path <<EOF`.
// The path may still hold the hint's `<name>` placeholder: small models copy it.
const HEREDOC_START = /^\s*cat\s*>\s*["']?([^\s"']+)["']?\s*<<-?\s*(['"]?)([A-Za-z_][\w-]*)\2\s*$/;

/** The skill's name from a heredoc path: `.../skills/<name>/SKILL.md` or `.../skills/<name>.md`. */
function skillNameFromPath(path: string): string | null {
  const p = path.replace(/\\/g, '/');
  const dir = p.match(/(?:^|\/)skills\/([^/]+)\/SKILL\.md$/i);
  if (dir) return dir[1];
  const file = p.match(/(?:^|\/)skills\/([^/]+)\.md$/i);
  return file ? file[1] : null;
}

function frontmatterName(content: string): string | null {
  const fm = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const line = fm?.[1].split('\n').find((l) => /^name\s*:/i.test(l));
  const value = line?.replace(/^name\s*:/i, '').trim().replace(/^["']|["']$/g, '');
  return value || null;
}

const slug = (text: string) => text.trim().toLowerCase()
  .replace(/[^a-z0-9\s-]/g, ' ').trim().split(/[\s-]+/).filter(Boolean).slice(0, 5).join('-');

/** A name that's still the hint's placeholder (`<name>`), not a real one. */
const isPlaceholder = (name: string | null) => !name || /[<>]/.test(name);

/**
 * The skill's name, as it's saved and shown: its frontmatter's, else its
 * path's, else its first heading's (`# Skill: Weekly Report`) — a reply that
 * kept the `<name>` placeholder and skipped the frontmatter still gets one.
 */
function skillName(path: string, content: string): string {
  const fm = frontmatterName(content);
  if (!isPlaceholder(fm) && slug(fm!)) return slug(fm!);
  const fromPath = skillNameFromPath(path);
  if (!isPlaceholder(fromPath) && slug(fromPath!)) return slug(fromPath!);
  const heading = content.split('\n').find((l) => /^#{1,3}\s+\S/.test(l));
  const fromHeading = heading && slug(heading.replace(/^#+\s*/, '').replace(/^skill\s*:\s*/i, ''));
  return fromHeading || 'new-skill';
}

/** A one-line description for a draft without frontmatter. */
function describe(content: string, name: string): string {
  const labelled = content.match(/description\s*:?\**\s*:?\s*(.+)/i)?.[1];
  const first = content.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#'));
  const text = (labelled || first || name.replace(/-/g, ' ')).replace(/[*_`]/g, '').trim();
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

/** `content` with frontmatter naming it `name`, added or corrected. */
function withFrontmatter(content: string, name: string): string {
  if (/^---\s*\n[\s\S]*?\n---/.test(content)) {
    return /^---\s*\n[\s\S]*?^name\s*:/m.test(content)
      ? content.replace(/^(---\s*\n[\s\S]*?^)name\s*:.*$/m, `$1name: ${name}`)
      : content.replace(/^---\s*\n/, `---\nname: ${name}\n`);
  }
  return `---\nname: ${name}\ndescription: ${describe(content, name)}\n---\n\n${content}`;
}

const FENCE = /^\s*(`{3,}|~{3,})\s*([\w-]*)\s*$/;

export type SkillDraftStatus = 'writing' | 'saved' | 'failed';

/**
 * `reply` as it should be shown: each skill heredoc (and the fenced block
 * around it) becomes a line naming the skill, then the SKILL.md being saved.
 * The `cat > …` wrapper is how the model hands the skill to the app, not
 * something to read. A block not yet closed, or one `statusOf` says is still
 * being created, shows as being written; "Saved" only once it exists.
 */
export function showSkillDrafts(
  reply: string,
  statusOf: (name: string) => SkillDraftStatus = () => 'saved',
): string {
  const lines = String(reply || '').split(/\r?\n/);
  const out: string[] = [];
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    // A fence whose first non-blank line is a skill heredoc, or a bare heredoc.
    const fence = lines[i].match(FENCE);
    let k = fence ? i + 1 : i;
    while (fence && k < lines.length && !lines[k].trim()) k++;
    const start = k < lines.length ? lines[k].match(HEREDOC_START) : null;
    if (!start || !skillNameFromPath(start[1])) { out.push(lines[i]); continue; }

    const word = start[3];
    const body: string[] = [];
    let j = k + 1;
    for (; j < lines.length && lines[j].trim() !== word; j++) body.push(lines[j]);
    let closed = j < lines.length;
    if (closed && fence) {
      // Past the EOF, up to the fence's close.
      let f = j + 1;
      while (f < lines.length && !(lines[f].trim().startsWith(fence[1][0]) && lines[f].trim().length >= fence[1].length && /^[`~]+$/.test(lines[f].trim()))) f++;
      closed = f < lines.length;
      j = f;
    }
    changed = true;
    const name = skillName(start[1], body.join('\n').trim());
    const status: SkillDraftStatus = closed ? statusOf(name) : 'writing';
    out.push(
      status === 'saved' ? `> Saved skill **${name}** — run it with \`/${name}\``
        : status === 'failed' ? `> Couldn't save skill **${name}**`
          : `> Writing skill **${name}**…`,
    );
    // The SKILL.md itself, in a fence longer than any backtick run inside it.
    const text = body.join('\n').replace(/\s+$/, '');
    if (text) {
      const longest = Math.max(2, ...(text.match(/`+/g) || []).map((r) => r.length));
      const ticks = '`'.repeat(longest + 1);
      out.push('', `${ticks}markdown`, text, ticks);
    }
    if (!closed) break;
    i = j;
  }
  return changed ? out.join('\n') : reply;
}

/**
 * Whether a skill request changes an existing skill rather than making one.
 * Mirrors isSkillUpdate in electron/chat-stream.js — keep them in step.
 */
export function isSkillUpdate(text: string): boolean {
  const t = String(text || '').toLowerCase();
  if (!/\bskills?\b/.test(t)) return false;
  if (/\b(update|edit|change|improve|modify|fix|tweak|adjust|revise|rename)\b/.test(t)) return true;
  return /\b(the|this|that|my)\s+skill\b/.test(t) && !/\b(create|make|new|another|save|turn|convert)\b/.test(t);
}

/**
 * `draft` saved under `name` instead: an update the model gave a new name to
 * still replaces the skill it was asked to change, rather than adding one.
 */
export function retargetDraft(draft: SkillDraft, name: string): SkillDraft {
  if (draft.name === name) return draft;
  return { name, content: withFrontmatter(draft.content, name) };
}

/** Every skill drafted in `reply`, last one winning for a repeated name. */
export function extractSkillDrafts(reply: string): SkillDraft[] {
  const drafts = new Map<string, SkillDraft>();
  const lines = String(reply || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i].match(HEREDOC_START);
    if (!start) continue;
    if (!skillNameFromPath(start[1])) continue;
    const word = start[3];
    const body: string[] = [];
    let j = i + 1;
    for (; j < lines.length && lines[j].trim() !== word; j++) body.push(lines[j]);
    if (j >= lines.length) continue;  // never closed — a cut-off reply, not a skill
    i = j;
    const content = body.join('\n').trim();
    if (!content) continue;
    const name = skillName(start[1], content);
    // The API names a skill from its frontmatter: make sure it has one, with this name.
    drafts.set(name, { name, content: `${withFrontmatter(content, name)}\n` });
  }
  return [...drafts.values()];
}
