import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GitOperations } from '../dist/git/status.js';
import { Cache } from '../dist/core/cache.js';
import { loadConfig } from '../dist/core/config.js';
import { getStatusV2 } from '../dist/git/porcelain.js';
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, appendFileSync } from 'fs';
import { tmpdir } from 'os';

/**
 * Throwaway repo exercising every indicator: upstream (ahead 1), 1 stash,
 * staged rename + adds (incl. spaced path), staged delete, unstaged
 * modification, untracked file.
 */
export function makeSandbox(suffix: string): string {
  const dir = mkdtempSync(`${tmpdir()}/cs-${suffix}-`);
  const g = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  const gbare = (...args: string[]) => execFileSync('git', args, { stdio: 'ignore' });
  g('init', '-q');
  g('config', 'user.email', 't@t');
  g('config', 'user.name', 't');
  g('config', 'commit.gpgsign', 'false');
  writeFileSync(`${dir}/a.txt`, 'one\n');
  writeFileSync(`${dir}/b.txt`, 'two\n');
  writeFileSync(`${dir}/f.txt`, 'five\n');
  g('add', '.');
  g('commit', '-qm', 'init');
  gbare('clone', '--bare', dir, `${dir}-remote.git`);
  g('remote', 'add', 'origin', `${dir}-remote.git`);
  g('push', '-q', '-u', 'origin', 'HEAD');
  appendFileSync(`${dir}/a.txt`, 'second\n');
  g('commit', '-qam', 'second');                              // ahead 1
  writeFileSync(`${dir}/b.txt`, 'stashme\n');
  g('stash', 'push', '-q', '--', 'b.txt');                    // stash 1 (path-limited)
  g('mv', 'b.txt', 'z.txt');                                  // staged R
  writeFileSync(`${dir}/a.txt`, 'dirty\n');                   // modified unstaged
  writeFileSync(`${dir}/c.txt`, 'three\n');
  g('add', 'c.txt');                                          // staged A
  writeFileSync(`${dir}/my file.txt`, 'spaced\n');
  g('add', './my file.txt');                                  // staged A, space in path
  g('rm', '-q', 'f.txt');                                     // staged D
  writeFileSync(`${dir}/e.txt`, 'untracked\n');               // untracked
  return dir;
}

describe('porcelain v2 parity with v1 pipeline', () => {
  it('reports identical branch and indicator counts', async () => {
    const dir = makeSandbox('parity');
    const config = { ...loadConfig(), noGitStatus: false, cacheDir: `${dir}/.git/cs-cache` };
    const ops = new GitOperations(config, new Cache(config));

    const oldInfo = await ops.getGitInfo(dir);       // v1 multi-shell pipeline
    const v2 = await getStatusV2(dir);               // new single-call parser

    assert.notStrictEqual(oldInfo, null);
    assert.notStrictEqual(v2, null);

    // Non-vacuousness guards: the sandbox must genuinely exercise every
    // counter, so the parity checks below can never pass 0-vs-0.
    assert.strictEqual(oldInfo!.indicators.staged, 2);
    assert.strictEqual(oldInfo!.indicators.modified, 1);
    assert.strictEqual(oldInfo!.indicators.untracked, 1);
    assert.strictEqual(oldInfo!.indicators.renamed, 1);
    assert.strictEqual(oldInfo!.indicators.deleted, 1);
    assert.strictEqual(oldInfo!.indicators.stashed, 1);
    assert.strictEqual(oldInfo!.indicators.ahead, 1);
    assert.strictEqual(oldInfo!.indicators.behind, 0);

    assert.strictEqual(v2!.head, oldInfo!.branch);
    assert.strictEqual(v2!.indicators.staged, oldInfo!.indicators.staged);
    assert.strictEqual(v2!.indicators.modified, oldInfo!.indicators.modified);
    assert.strictEqual(v2!.indicators.untracked, oldInfo!.indicators.untracked);
    assert.strictEqual(v2!.indicators.stashed, oldInfo!.indicators.stashed);
    assert.strictEqual(v2!.indicators.ahead, oldInfo!.indicators.ahead);
    assert.strictEqual(v2!.indicators.behind, oldInfo!.indicators.behind);
    assert.strictEqual(v2!.indicators.renamed, oldInfo!.indicators.renamed);
    assert.strictEqual(v2!.indicators.deleted, oldInfo!.indicators.deleted);
    assert.strictEqual(v2!.indicators.diverged, oldInfo!.indicators.diverged);
  });
});
