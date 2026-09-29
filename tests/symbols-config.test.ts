import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ConfigSchema } from '../dist/core/config.js';
import { detectSymbols } from '../dist/ui/symbols.js';

describe('worktree symbol override', () => {
  it('symbols.worktree override is accepted and used in Nerd Font set', async () => {
    const config = ConfigSchema.parse({ symbols: { worktree: 'X' }, nerdFont: true });
    assert.strictEqual(config.symbols.worktree, 'X');
    const symbols = await detectSymbols(config);
    assert.strictEqual(symbols.worktree, 'X');
  });

  it('asciiSymbols.worktree override is accepted and used in ASCII set', async () => {
    const config = ConfigSchema.parse({ asciiSymbols: { worktree: 'X' } });
    assert.strictEqual(config.asciiSymbols.worktree, 'X');
    const symbols = await detectSymbols(config);
    assert.strictEqual(symbols.worktree, 'X');
  });

  it('omitting worktree yields the preset defaults', async () => {
    const ascii = await detectSymbols(ConfigSchema.parse({}));
    assert.strictEqual(ascii.worktree, '·wt:');
    const nerd = await detectSymbols(ConfigSchema.parse({ nerdFont: true }));
    assert.strictEqual(nerd.worktree, '\u{F504}');
  });
});
