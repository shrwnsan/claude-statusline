import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatProjectSlot, resolveBranch } from '../dist/index.js';

describe('formatProjectSlot', () => {
  it('plain main checkout: unchanged dirname, no tag', () => {
    assert.strictEqual(
      formatProjectSlot({ repoName: undefined, currentDir: '/x/claude-statusline', worktreeName: undefined, wtSymbol: '·wt:' }),
      'claude-statusline',
    );
  });

  it('linked worktree cwd: repo identity + ·wt: tag', () => {
    assert.strictEqual(
      formatProjectSlot({ repoName: 'claude-statusline', currentDir: '/x/cs-wt-demo', worktreeName: 'cs-wt-demo', wtSymbol: '·wt:' }),
      'claude-statusline ·wt:cs-wt-demo',
    );
  });

  it('repo.name ≠ dirname: project slot comes from workspace.repo.name', () => {
    assert.strictEqual(
      formatProjectSlot({ repoName: 'my-repo', currentDir: '/x/wt-clone', worktreeName: 'wt-clone', wtSymbol: '·wt:' }),
      'my-repo ·wt:wt-clone',
    );
  });

  it('no repo field but inside linked worktree: dirname + tag', () => {
    assert.strictEqual(
      formatProjectSlot({ repoName: undefined, currentDir: '/x/cs-wt-demo', worktreeName: 'cs-wt-demo', wtSymbol: '·wt:' }),
      'cs-wt-demo ·wt:cs-wt-demo',
    );
  });

  it('nerd symbol renders glyph adjacent to the name', () => {
    // U+F421 via escape — never paste raw PUA bytes into source (they do
    // not survive transmission and break byte-verified diffs)
    assert.strictEqual(
      formatProjectSlot({ repoName: 'r', currentDir: '/x/w', worktreeName: 'w', wtSymbol: '\u{F421}' }),
      'r \u{F421}w',
    );
  });
});

describe('resolveBranch', () => {
  it('worktree.branch wins in managed sessions', () => {
    assert.strictEqual(resolveBranch({ gitBranch: 'git-says-x', worktreeBranch: 'worktree-demo' }), 'worktree-demo');
  });
  it('git branch is used otherwise', () => {
    assert.strictEqual(resolveBranch({ gitBranch: 'main', worktreeBranch: undefined }), 'main');
  });
});
