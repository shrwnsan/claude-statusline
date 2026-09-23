import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatCost, formatPrBadge, formatRateLimit } from '../dist/index.js';

describe('formatPrBadge', () => {
  it('renders number + state token', () => {
    assert.strictEqual(formatPrBadge({ number: 27, url: 'u', review_state: 'approved' }), ' #27[A]');
    assert.strictEqual(formatPrBadge({ number: 27, url: 'u', review_state: 'pending' }), ' #27*');
    assert.strictEqual(formatPrBadge({ number: 27, url: 'u', review_state: 'changes_requested' }), ' #27x');
    assert.strictEqual(formatPrBadge({ number: 27, url: 'u', review_state: 'draft' }), ' #27-');
  });
  it('renders number only when review_state is absent', () => {
    assert.strictEqual(formatPrBadge({ number: 5, url: 'u' }), ' #5');
  });
  it('returns empty for absent PR', () => {
    assert.strictEqual(formatPrBadge(undefined), '');
  });
});

describe('formatCost', () => {
  it('prefixes ~ to mark the client-side estimate', () => {
    assert.strictEqual(formatCost(1.2344), ' ~$1.23');
    assert.strictEqual(formatCost(0), ' ~$0.00');
  });
  it('returns empty when absent or negative', () => {
    assert.strictEqual(formatCost(undefined), '');
    assert.strictEqual(formatCost(-1), '');
  });
});

describe('formatRateLimit', () => {
  it('renders only windows that are present', () => {
    assert.strictEqual(formatRateLimit({ five_hour: { used_percentage: 42 } }), ' 5h:42%');
    assert.strictEqual(formatRateLimit({ five_hour: { used_percentage: 42 }, seven_day: { used_percentage: 12 } }), ' 5h:42% 7d:12%');
  });
  it('rounds fractional percentages', () => {
    assert.strictEqual(formatRateLimit({ five_hour: { used_percentage: 42.6 } }), ' 5h:43%');
  });
  it('renders >100 verbatim (docs: spend_limit may exceed 100)', () => {
    assert.strictEqual(formatRateLimit({ spend_limit: { used_percentage: 137 } }), ' spl:137%');
  });
  it('returns empty when absent or empty', () => {
    assert.strictEqual(formatRateLimit(undefined), '');
    assert.strictEqual(formatRateLimit({}), '');
  });
});
