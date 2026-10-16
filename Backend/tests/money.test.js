import test from 'node:test';
import assert from 'node:assert/strict';
import { toPaise, fromPaise, round2, addMoney, subMoney, percentOf, eqMoney, gtMoney, gteMoney, isPositiveMoney } from '../src/utils/money.js';

test('toPaise handles floating-point edge cases', () => {
    assert.equal(toPaise(1.005), 101);
    assert.equal(toPaise(19.99), 1999);
    assert.equal(toPaise(0.1 + 0.2), 30);
    assert.equal(toPaise('12.50'), 1250);
    assert.equal(toPaise(undefined), 0);
    assert.equal(toPaise(NaN), 0);
});

test('addMoney / subMoney never drift', () => {
    assert.equal(addMoney(0.1, 0.2), 0.3);
    assert.equal(addMoney(10.1, 20.2, 30.3), 60.6);
    assert.equal(subMoney(100, 33.33), 66.67);
    assert.equal(subMoney(0.3, 0.1), 0.2);
});

test('round2 and percentOf round to paise', () => {
    assert.equal(round2(2.675), 2.68);
    assert.equal(percentOf(199, 18), 35.82);
    assert.equal(percentOf(0, 50), 0);
});

test('comparisons are paise-exact', () => {
    assert.ok(eqMoney(0.1 + 0.2, 0.3));
    assert.ok(gtMoney(10.01, 10));
    assert.ok(gteMoney(10, 10.0));
    assert.ok(!gtMoney(0.1 + 0.2, 0.3));
    assert.ok(isPositiveMoney(0.01));
    assert.ok(!isPositiveMoney(0));
    assert.equal(fromPaise(12345), 123.45);
});
