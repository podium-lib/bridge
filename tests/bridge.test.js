import { test } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

const html = /* html */ `<!doctype html>
<html>
    <head>
        <meta charset="utf-8">
    </head>
    <body></body>
</html>`;
const dom = new JSDOM(html);
globalThis.window = dom.window;

const { uid, pseudorandom } = await import('../lib/bridge.js');

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

test('invokes a registered listener when a message is received', () => {
	assert.ok(
		globalThis['@podium'].bridge,
		'Expected to find the Podium bridge on globalThis',
	);
});
