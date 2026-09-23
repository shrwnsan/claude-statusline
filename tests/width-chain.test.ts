import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { getTerminalWidth } from '../dist/ui/width.js';
import { loadConfig } from '../dist/core/config.js';

const origCols = process.env.COLUMNS;
afterEach(() => {
  if (origCols === undefined) delete process.env.COLUMNS; else process.env.COLUMNS = origCols;
});

describe('getTerminalWidth chain', () => {
  it('forceWidth wins over everything', async () => {
    process.env.COLUMNS = '120';
    const w = await getTerminalWidth({ ...loadConfig(), forceWidth: 55 });
    assert.strictEqual(w, 55);
  });

  it('COLUMNS is honored when set (Claude Code provides it since 2.1.153)', async () => {
    process.env.COLUMNS = '97';
    const w = await getTerminalWidth({ ...loadConfig() });
    assert.strictEqual(w, 97);
  });

  it('falls back to fixed 80 when nothing is available — never shells out', async () => {
    delete process.env.COLUMNS;
    const w = await getTerminalWidth({ ...loadConfig() });
    assert.strictEqual(w, 80);
  });
});
