import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GitOperations } from '../dist/git/status.js';
import { Cache } from '../dist/core/cache.js';
import { loadConfig } from '../dist/core/config.js';
import { getStatusV2 } from '../dist/git/porcelain.js';
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, appendFileSync } from 'fs';
import { tmpdir } from 'os';

/** Throwaway repo: 1 staged add, 1 unstaged modification, 1 untracked file. */
export function makeSandbox(suffix: string): string {
  const dir = mkdtempSync(`${tmpdir()}/cs-${suffix}-`);
  const g = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  g('init', '-q');
  g('config', 'user.email', 't@t');
  g('config', 'user.name', 't');
  g('config', 'commit.gpgsign', 'false');
  writeFileSync(`${dir}/a.txt`, 'one\n');
  writeFileSync(`${dir}/b.txt`, 'two\n');
  g('add', '.');
  g('commit', '-qm', 'init');
  appendFileSync(`${dir}/a.txt`, 'dirty\n'); // modified, unstaged
  writeFileSync(`${dir}/c.txt`, 'three\n');
  writeFileSync(`${dir}/d.txt`, 'four\n');
  g('add', 'c.txt');                          // staged: A
  return dir;                                 // d.txt untracked
}

describe('porcelain v2 parity with v1 pipeline', () => {
  it('reports identical branch and indicator counts', async () => {
    const dir = makeSandbox('parity');
    const config = { ...loadConfig(), cacheDir: `${dir}/.git/cs-cache` };
    const ops = new GitOperations(config, new Cache(config));

    const oldInfo = await ops.getGitInfo(dir);       // v1 multi-shell pipeline
    const v2 = await getStatusV2(dir);               // new single-call parser

    assert.notStrictEqual(oldInfo, null);
    assert.notStrictEqual(v2, null);
    assert.strictEqual(v2!.head, oldInfo!.branch);
    assert.strictEqual(v2!.indicators.staged, oldInfo!.indicators.staged);
    assert.strictEqual(v2!.indicators.modified, oldInfo!.indicators.modified);
    assert.strictEqual(v2!.indicators.untracked, oldInfo!.indicators.untracked);
    assert.strictEqual(v2!.indicators.stashed, oldInfo!.indicators.stashed);
    assert.strictEqual(v2!.indicators.ahead, oldInfo!.indicators.ahead);
    assert.strictEqual(v2!.indicators.behind, oldInfo!.indicators.behind);
  });
});
