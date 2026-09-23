import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatContextUsage, formatOverLimit, formatTokenCount, shouldShowOverLimit } from '../dist/index.js';

const SYM = '≈';

describe('formatContextUsage', () => {
  it('prefers used_percentage', () => {
    assert.strictEqual(formatContextUsage({ used_percentage: 25.4 }, SYM), ' ≈25%');
  });
  it('null used_percentage with no fallback renders nothing', () => {
    assert.strictEqual(formatContextUsage({ used_percentage: null }, SYM), '');
    assert.strictEqual(formatContextUsage(undefined, SYM), '');
  });
  it('computes from current_usage when percentages are null (docs formula: input-only)', () => {
    assert.strictEqual(formatContextUsage({
      used_percentage: null,
      context_window_size: 200000,
      current_usage: { input_tokens: 50000, output_tokens: 9000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    }, SYM), ' ≈25%'); // output_tokens excluded — used_percentage is input-only
  });
  it('falls back to remaining_percentage only when used_percentage absent', () => {
    assert.strictEqual(formatContextUsage({ remaining_percentage: 75 }, SYM), ' ≈25%');
  });
});

describe('formatOverLimit', () => {
  it('renders the symbol only when exceeded', () => {
    assert.strictEqual(formatOverLimit(true, '!!'), '!!');
    assert.strictEqual(formatOverLimit(false, '!!'), '');
    assert.strictEqual(formatOverLimit(undefined, '!!'), '');
  });
});

describe('shouldShowOverLimit', () => {
  // Docs: exceeds_200k_tokens is a fixed 200k threshold regardless of window size,
  // so in 'auto' mode it is only meaningful where crossing 200k means nearly full.
  it('auto: renders on a standard 200k window', () => {
    assert.strictEqual(shouldShowOverLimit(true, 200000, 'auto'), true);
  });
  it('auto: suppresses on an extended 1M window (flag fires at ~20% there)', () => {
    assert.strictEqual(shouldShowOverLimit(true, 1000000, 'auto'), false);
  });
  it('auto: renders when window size is unknown (flag predates context_window_size)', () => {
    assert.strictEqual(shouldShowOverLimit(true, undefined, 'auto'), true);
  });
  it('any mode: never renders when the flag is not set', () => {
    assert.strictEqual(shouldShowOverLimit(false, 200000, 'auto'), false);
    assert.strictEqual(shouldShowOverLimit(undefined, 200000, 'auto'), false);
    assert.strictEqual(shouldShowOverLimit(undefined, 1000000, 'always'), false);
  });
  it('always: renders the raw flag even on extended windows', () => {
    assert.strictEqual(shouldShowOverLimit(true, 1000000, 'always'), true);
  });
  it('never: suppresses even on standard windows', () => {
    assert.strictEqual(shouldShowOverLimit(true, 200000, 'never'), false);
  });
});

describe('formatTokenCount + contextTokens opt-in', () => {
  it('formats absolute counts', () => {
    assert.strictEqual(formatTokenCount(41234), '~41k');
    assert.strictEqual(formatTokenCount(undefined), '');
  });
  it('contextTokens opt-in appends ~used/total', () => {
    assert.strictEqual(
      formatContextUsage({ used_percentage: 25, context_window_size: 200000 }, SYM, { contextTokens: true }),
      ' ≈25% ~50k/200k',
    );
  });
});
