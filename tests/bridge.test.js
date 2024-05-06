import { test } from 'node:test';
import assert from 'node:assert';
import { uid, pseudorandom } from '../lib/bridge.js';

test('uid using crypto.randomUUID() API generates a string', () => {
    const a = uid();
    assert.strictEqual(typeof a, 'string');

    const b = uid();
    assert.strictEqual(typeof b, 'string');

    assert.notEqual(a, b);
});

test('psedurandom fallback generates a unique string', () => {
    const a = pseudorandom();
    assert.strictEqual(typeof a, 'string');

    const b = pseudorandom();
    assert.strictEqual(typeof b, 'string');

    assert.notEqual(a, b);
});
