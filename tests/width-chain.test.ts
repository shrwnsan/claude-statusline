import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { getTerminalWidth } from '../dist/ui/width.js';
import { loadConfig } from '../dist/core/config.js';

const origCols = process.env.COLUMNS;
const origTermProgram = process.env.TERM_PROGRAM;
const origTerm = process.env.TERM;
afterEach(() => {
  if (origCols === undefined) delete process.env.COLUMNS; else process.env.COLUMNS = origCols;
  if (origTermProgram === undefined) delete process.env.TERM_PROGRAM; else process.env.TERM_PROGRAM = origTermProgram;
  if (origTerm === undefined) delete process.env.TERM; else process.env.TERM = origTerm;
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
    // Discriminator against the deleted sniffing chain: with TERM unset,
    // tput/stty cannot answer (and the old chain ran them before the TERM
    // table), so the old table returned 120 for TERM_PROGRAM=ghostty here.
    // The honest chain must still return 80.
    delete process.env.TERM;
    process.env.TERM_PROGRAM = 'ghostty';
    const w = await getTerminalWidth({ ...loadConfig() });
    assert.strictEqual(w, 80);
  });
});
