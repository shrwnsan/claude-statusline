import { EMPTY_INDICATORS, GitIndicators } from './status.js';

/**
 * Result of parsing `git status --porcelain=v2 --branch --show-stash`.
 * Field notes (verified against git 2.x output, 2026-09-23):
 * - `# stash N` line is OMITTED entirely when zero stashes (default 0).
 * - Detached HEAD emits `# branch.head (detached)`.
 * - Rename "2" records join path and origPath with a literal TAB.
 */
export interface StatusV2 {
  head: string | null; // branch name; null when detached
  detached: boolean;
  oid: string | null; // full HEAD oid (from `# branch.oid`)
  upstream: string | null;
  ahead: number;
  behind: number;
  stash: number;
  indicators: GitIndicators;
}

/** Extract XY codes from a "1"/"2" record (chars 2-3 of the line). */
function countXY(ind: GitIndicators, line: string): void {
  const X = line.charAt(2);
  const Y = line.charAt(3);
  switch (X) {
    case 'M':
    case 'A':
    case 'C':
      ind.staged++;
      break;
    case 'D':
      ind.deleted++;
      break;
    case 'R':
      ind.renamed++;
      break;
  }
  switch (Y) {
    case 'M':
      ind.modified++;
      break;
    case 'D':
      ind.deleted++;
      break;
    case 'R':
      ind.renamed++;
      break;
  }
}

export function parseStatusV2(output: string): StatusV2 {
  const r: StatusV2 = {
    head: null,
    detached: false,
    oid: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    stash: 0,
    indicators: { ...EMPTY_INDICATORS },
  };
  for (const raw of output.split('\n')) {
    const line = raw.trimEnd(); // trim CR/CRLF, keep leading chars intact
    if (!line) continue;
    if (line.startsWith('# branch.head ')) {
      const v = line.slice('# branch.head '.length);
      r.detached = v === '(detached)';
      r.head = r.detached ? null : v;
    } else if (line.startsWith('# branch.oid ')) {
      r.oid = line.slice('# branch.oid '.length);
    } else if (line.startsWith('# branch.upstream ')) {
      r.upstream = line.slice('# branch.upstream '.length);
    } else if (line.startsWith('# branch.ab ')) {
      const m = /(?:^|\s)\+(\d+)\s+-(\d+)$/.exec(line);
      if (m) {
        r.ahead = parseInt(m[1] ?? '0', 10) || 0;
        r.behind = parseInt(m[2] ?? '0', 10) || 0;
      }
    } else if (line.startsWith('# stash ')) {
      r.stash = parseInt(line.slice('# stash '.length), 10) || 0;
    } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
      countXY(r.indicators, line);
    } else if (line.startsWith('u ')) {
      r.indicators.conflicts++;
    } else if (line.startsWith('? ')) {
      r.indicators.untracked++;
    }
    // '!' (ignored) records: intentionally not displayed
  }
  return r;
}
