import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GitOperations } from '../dist/git/status.js';
import { Cache } from '../dist/core/cache.js';
import { loadConfig } from '../dist/core/config.js';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { makeSandbox } from './porcelain-parity-helpers.ts';

describe('getGitInfo (consolidated single-spawn)', () => {
  it('reports branch and indicators from one porcelain v2 call', async () => {
    const dir = makeSandbox('gitinfo');
    const config = { ...loadConfig(), noGitStatus: false, cacheDir: `${dir}/.git/cs-cache` };
    const info = await new GitOperations(config, new Cache(config)).getGitInfo(dir);
    assert.notStrictEqual(info, null);
    assert.strictEqual(info!.indicators.staged, 2);
    assert.strictEqual(info!.indicators.renamed, 1);
    assert.strictEqual(info!.indicators.deleted, 1);
    assert.strictEqual(info!.indicators.modified, 1);
    assert.strictEqual(info!.indicators.untracked, 1);
    assert.strictEqual(info!.indicators.stashed, 1);
    assert.strictEqual(info!.indicators.ahead, 1);
  });

  it('returns null outside a repository', async () => {
    const dir = mkdtempSync(`${tmpdir()}/cs-norepo2-`);
    const config = { ...loadConfig(), noGitStatus: false, cacheDir: `${dir}/cache` };
    const info = await new GitOperations(config, new Cache(config)).getGitInfo(dir);
    assert.strictEqual(info, null);
  });
});
