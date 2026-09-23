import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CacheKeys } from '../dist/core/cache.js';

describe('GIT_STATUS cache key', () => {
  it('composites session_id and directory, filename-safe (base64)', () => {
    const key = CacheKeys.GIT_STATUS('abc-123', '/repo/a');
    assert.strictEqual(key.startsWith('git_status_'), true);
    assert.strictEqual(key, `git_status_${Buffer.from('abc-123:/repo/a').toString('base64')}`);
    assert.ok(!key.includes('/repo'), 'raw dir must not leak into filename');
    assert.ok(!key.includes('abc-123:'), 'raw session id must not leak into filename');
  });

  it('falls back to directory-only key when session_id is absent', () => {
    const key = CacheKeys.GIT_STATUS(undefined, '/repo/a');
    assert.strictEqual(key, `git_status_${Buffer.from('/repo/a').toString('base64')}`);
  });

  it('different sessions in the same dir do not share entries', () => {
    assert.notStrictEqual(CacheKeys.GIT_STATUS('s1', '/repo/a'), CacheKeys.GIT_STATUS('s2', '/repo/a'));
  });
});
