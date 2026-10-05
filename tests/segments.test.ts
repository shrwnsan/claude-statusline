import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatCost, formatEffortSuffix, formatModes, formatPrBadge, formatRateLimit } from '../dist/index.js';

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

describe('formatModes', () => {
  it('renders compact tokens for present fields only', () => {
    assert.strictEqual(formatModes({ effort: { level: 'high' }, thinking: { enabled: true } }), ' [hgh·thk]');
    assert.strictEqual(formatModes({ vim: { mode: 'INSERT' }, fast_mode: true }), ' [I·fast]');
    assert.strictEqual(formatModes({ agent: { name: 'reviewer' } }), ' [@reviewer]');
  });
  it('maps effort levels', () => {
    assert.strictEqual(formatModes({ effort: { level: 'low' } }), ' [lo]');
    assert.strictEqual(formatModes({ effort: { level: 'xhigh' } }), ' [xh]');
    assert.strictEqual(formatModes({ effort: { level: 'max' } }), ' [mx]');
  });
  it('output_style renders only when not default', () => {
    assert.strictEqual(formatModes({ output_style: { name: 'default' } }), '');
    assert.strictEqual(formatModes({ output_style: { name: 'Explanatory' } }), ' [Explanatory]');
  });
  it('returns empty when nothing present', () => {
    assert.strictEqual(formatModes({}), '');
  });
  it('empty vim.mode renders no orphan bracket', () => {
    assert.strictEqual(formatModes({ vim: { mode: '' } }), '');
    assert.strictEqual(formatModes({ vim: { mode: '' }, effort: { level: 'high' } }), ' [hgh]');
  });
});

describe('formatEffortSuffix', () => {
  it('renders ·<level> for the raw payload value', () => {
    assert.strictEqual(formatEffortSuffix({ level: 'low' }), '·low');
    assert.strictEqual(formatEffortSuffix({ level: 'medium' }), '·medium');
    assert.strictEqual(formatEffortSuffix({ level: 'high' }), '·high');
    assert.strictEqual(formatEffortSuffix({ level: 'xhigh' }), '·xhigh');
    assert.strictEqual(formatEffortSuffix({ level: 'max' }), '·max');
  });
  it('passes unknown levels through verbatim', () => {
    assert.strictEqual(formatEffortSuffix({ level: 'ultra' }), '·ultra');
  });
  it('returns empty when absent, empty object, or empty level', () => {
    assert.strictEqual(formatEffortSuffix(undefined), '');
    assert.strictEqual(formatEffortSuffix({}), '');
    assert.strictEqual(formatEffortSuffix({ level: '' }), '');
  });
});

describe('formatModes PRD-005 dedupe contract', () => {
  it('renders no effort token when the call site strips effort', () => {
    const modes = { effort: { level: 'high' }, thinking: { enabled: true } };
    assert.strictEqual(formatModes({ ...modes, effort: undefined }), ' [thk]');
  });
});
