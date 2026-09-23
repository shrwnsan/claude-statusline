import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseStatusV2 } from '../dist/git/porcelain.js';

const BRANCHY = `# branch.oid e8d631f0123456789abcdef0123456789abcdef01
# branch.head main
# branch.upstream origin/main
# branch.ab +2 -1
# stash 3
1 M. N... 100644 100644 100644 abc def src/a.ts
1 D. N... 100644 000000 100644 abc 000 src/gone.ts
2 R. N... 100644 100644 100644 abc def R100 src/old.ts\tsrc/new.ts
1 .M N... 100644 100644 100644 abc def src/b.ts
? untracked.txt
`;

describe('parseStatusV2', () => {
  it('parses branch header lines', () => {
    const r = parseStatusV2(BRANCHY);
    assert.strictEqual(r.head, 'main');
    assert.strictEqual(r.detached, false);
    assert.strictEqual(r.upstream, 'origin/main');
    assert.strictEqual(r.ahead, 2);
    assert.strictEqual(r.behind, 1);
    assert.strictEqual(r.stash, 3);
  });

  it('omitted stash line means zero stashes (line is absent, not "# stash 0")', () => {
    const r = parseStatusV2('# branch.oid abc\n# branch.head main\n');
    assert.strictEqual(r.stash, 0);
  });

  it('parses detached HEAD and exposes oid', () => {
    const r = parseStatusV2('# branch.oid e8d631f0123456789abcdef0123456789abcdef01\n# branch.head (detached)\n');
    assert.strictEqual(r.detached, true);
    assert.strictEqual(r.head, null);
    assert.strictEqual(r.oid, 'e8d631f0123456789abcdef0123456789abcdef01');
  });

  it('counts XY indicators from "1" and "2" records', () => {
    const r = parseStatusV2(BRANCHY);
    assert.strictEqual(r.indicators.staged, 1);   // M.
    assert.strictEqual(r.indicators.renamed, 1);  // "2 R." record
    assert.strictEqual(r.indicators.deleted, 1);  // D.
    assert.strictEqual(r.indicators.modified, 1); // .M
    assert.strictEqual(r.indicators.untracked, 1);
  });

  it('counts conflicts from "u" records', () => {
    const r = parseStatusV2('u 1. N... 100644 100644 100644 a b c src/x.ts\n');
    assert.strictEqual(r.indicators.conflicts, 1);
  });

  it('rename records split on TAB (path<TAB>origPath)', () => {
    const r = parseStatusV2('2 R. N... 100644 100644 100644 a b R100 p1\tp2\n');
    assert.strictEqual(r.indicators.renamed, 1);
  });

  it('never produces NaN for missing/absent lines', () => {
    const r = parseStatusV2('');
    assert.strictEqual(r.head, null);
    assert.strictEqual(r.ahead, 0);
    assert.strictEqual(r.behind, 0);
    assert.strictEqual(r.stash, 0);
  });

  it('tolerates CRLF output (Windows)', () => {
    const r = parseStatusV2('# branch.head main\r\n1 M. N... 100644 100644 100644 a b f.ts\r\n');
    assert.strictEqual(r.head, 'main');
    assert.strictEqual(r.indicators.staged, 1);
  });
});
