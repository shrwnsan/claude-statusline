import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatProjectSlot, resolveBranch, splitProjectSlot, applySmartTruncation } from '../dist/index.js';

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

  it('empty-string repo.name falls back to dirname (no empty slot)', () => {
    assert.strictEqual(
      formatProjectSlot({ repoName: '', currentDir: '/x/claude-statusline', worktreeName: undefined, wtSymbol: '·wt:' }),
      'claude-statusline',
    );
    assert.strictEqual(
      formatProjectSlot({ repoName: '', currentDir: '/x/cs-wt-demo', worktreeName: 'cs-wt-demo', wtSymbol: '·wt:' }),
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
  it('empty-string worktree.branch is treated as absent (no empty branch slot)', () => {
    assert.strictEqual(resolveBranch({ gitBranch: 'main', worktreeBranch: '' }), 'main');
  });
});

describe('detectSymbols NF worktree glyph', () => {
  it('NF preset worktree glyph is U+F504 (oct-project_symlink)', async () => {
    // Codepoint assertion via escape — never paste raw PUA bytes into source
    const { detectSymbols } = await import('../dist/ui/symbols.js');
    const { defaultConfig } = await import('../dist/core/config.js');
    const symbols = await detectSymbols({ ...defaultConfig, nerdFont: true });
    assert.strictEqual(symbols.worktree.codePointAt(0), 0xf504);
  });
  it('ASCII preset worktree tag is ·wt:', async () => {
    const { detectSymbols } = await import('../dist/ui/symbols.js');
    const { defaultConfig } = await import('../dist/core/config.js');
    const symbols = await detectSymbols({ ...defaultConfig, nerdFont: false });
    assert.strictEqual(symbols.worktree, '·wt:');
  });
});

describe('splitProjectSlot', () => {
  it('splits name from tag at the worktree marker', () => {
    assert.deepStrictEqual(
      splitProjectSlot('claude-statusline ·wt:cs-wt-demo', '·wt:'),
      { name: 'claude-statusline', tag: '·wt:cs-wt-demo' },
    );
  });
  it('returns the slot untouched when no tag present', () => {
    assert.deepStrictEqual(splitProjectSlot('claude-statusline', '·wt:'), { name: 'claude-statusline', tag: '' });
  });
  it('handles the NF glyph marker', () => {
    assert.deepStrictEqual(
      splitProjectSlot('r \u{F504}w', '\u{F504}'),
      { name: 'r', tag: '\u{F504}w' },
    );
  });
});

describe('applySmartTruncation: truncation-atomic worktree tag', () => {
  const symbols = { worktree: '·wt:' };
  const config = { rightMargin: 0, truncate: true, noSoftWrap: true };
  const slot = 'claude-statusline ·wt:cs-wt-demo'; // width 31 (16 + 1 + 14)
  const git = ' [main]'; // width 7

  it('drops the tag whole when it does not fit; name renders intact', () => {
    // maxLen 30: slot+git (38) cannot fit, name+git (24) can
    const out = applySmartTruncation({
      statusline: `${slot}${git} OpusModel`,
      projectName: slot,
      gitStatus: git,
      modelString: 'OpusModel',
      terminalWidth: 30,
      config,
      symbols,
    });
    assert.strictEqual(out, 'claude-statusline [main] Opu..');
    assert.ok(!out.includes('wt:'), 'tag must not be partially sliced');
  });

  it('name alone truncates atomically when even the name cannot fit', () => {
    // maxLen floor 30 with a wide git segment: name+git (31) does not fit either;
    // the name truncates and the tag must never appear sliced
    const wideGit = ' [main+tags?!]'; // width 14
    const out = applySmartTruncation({
      statusline: `${slot}${wideGit} OpusModel`,
      projectName: slot,
      gitStatus: wideGit,
      modelString: 'OpusModel',
      terminalWidth: 30,
      config,
      symbols,
    });
    assert.strictEqual(out, 'claude-statusl.. [main+tags?!]');
    assert.ok(!out.includes('wt:'), 'tag must be dropped, never sliced');
  });

  it('keeps the tag whole when project+git fits and only the model overflows', () => {
    // maxLen 45: slot+git (39, middle dot is width 2) fits; model truncated instead
    const out = applySmartTruncation({
      statusline: `${slot}${git} OpusModel`,
      projectName: slot,
      gitStatus: git,
      modelString: 'OpusModel',
      terminalWidth: 45,
      config,
      symbols,
    });
    assert.strictEqual(out, `${slot}${git} Opu..`);
  });
});
