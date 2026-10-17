import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, TX_STATUS } from '../src/modules/food/orders/services/finance.service.js';

test('allowed payment status transitions', () => {
    assert.ok(canTransition('pending', 'authorized'));
    assert.ok(canTransition('pending', 'captured'));
    assert.ok(canTransition('pending', 'failed'));
    assert.ok(canTransition('authorized', 'captured'));
    assert.ok(canTransition('captured', 'refunded'));
    assert.ok(canTransition('failed', 'captured')); // late gateway capture
});

test('forbidden payment status transitions', () => {
    assert.ok(!canTransition('refunded', 'captured'));
    assert.ok(!canTransition('refunded', 'pending'));
    assert.ok(!canTransition('captured', 'pending'));
    assert.ok(!canTransition('captured', 'failed'));
    assert.ok(!canTransition('pending', 'refunded')); // nothing to refund yet
    assert.ok(!canTransition('failed', 'refunded'));
    assert.ok(!canTransition('nonsense', 'captured'));
});

test('status constants are exactly the supported set', () => {
    assert.deepEqual(Object.values(TX_STATUS).sort(), ['authorized', 'captured', 'failed', 'pending', 'refunded']);
});
