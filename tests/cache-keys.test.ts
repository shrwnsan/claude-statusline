import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CacheKeys } from '../dist/core/cache.js';

describe('GIT_STATUS cache key', () => {
  it('composites session_id and directory, filename-safe (base64url)', () => {
    const key = CacheKeys.GIT_STATUS('abc-123', '/repo/a');
    assert.strictEqual(key.startsWith('git_status_'), true);
    assert.strictEqual(key, `git_status_${Buffer.from('abc-123:/repo/a').toString('base64').replace(/\+/g, '-').replace(/\//g, '_')}`);
    assert.ok(!key.includes('/repo'), 'raw dir must not leak into filename');
    assert.ok(!key.includes('abc-123:'), 'raw session id must not leak into filename');
  });

  it('falls back to directory-only key when session_id is absent', () => {
    const key = CacheKeys.GIT_STATUS(undefined, '/repo/a');
    assert.strictEqual(key, `git_status_${Buffer.from('/repo/a').toString('base64').replace(/\+/g, '-').replace(/\//g, '_')}`);
  });

  it('different sessions in the same dir do not share entries', () => {
    assert.notStrictEqual(CacheKeys.GIT_STATUS('s1', '/repo/a'), CacheKeys.GIT_STATUS('s2', '/repo/a'));
  });

  it('base64url-encodes inputs whose standard base64 contains + and /', () => {
    // '~u~:k?3b' -> 'fnV+Oms/M2I=' in standard base64
    const key = CacheKeys.GIT_STATUS('~u~:k?3b', '/repo');
    assert.ok(!key.includes('+'), 'key must not contain + (breaks nothing, but base64url mandates -)');
    assert.ok(!key.includes('/'), 'key must not contain / (would target a nonexistent subdir)');
    assert.strictEqual(
      key,
      `git_status_${Buffer.from('~u~:k?3b:/repo').toString('base64').replace(/\+/g, '-').replace(/\//g, '_')}`
    );
  });

  it('never emits / or + across adversarial inputs', () => {
    const inputs: Array<[string | undefined, string]> = [
      ['~u~:k?3b', '/repo'],
      ['xx??/', '/a?b'],
      ['zz?/', '?????'],
      ['session-with-+/chars', '/p/a/t/h?x=1/2'],
      [undefined, '/??/../??'],
      ['a'.repeat(1000), '/'.repeat(50)],
      ['\u00ff\u00fe', '/tmp/\u0000ish'],
    ];
    for (const [session, dir] of inputs) {
      const key = CacheKeys.GIT_STATUS(session, dir);
      assert.ok(!key.includes('/'), `key for ${JSON.stringify([session, dir])} must not contain /`);
      assert.ok(!key.includes('+'), `key for ${JSON.stringify([session, dir])} must not contain +`);
    }
  });
});
