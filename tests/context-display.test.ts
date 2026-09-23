import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatContextUsage, formatOverLimit } from '../dist/index.js';

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
