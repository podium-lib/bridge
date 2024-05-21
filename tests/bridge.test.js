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

test('invokes a registered listener when a message is received', (t, done) => {
	assert.ok(
		globalThis.window['@podium'].bridge,
		'Expected to find the Podium bridge on globalThis',
	);

	const rpcRequest = {
		method: 'foo/bar',
		params: ['Hello', 'World!'],
		jsonrpc: '2.0',
	};

	/** @type {import("../lib/bridge.js").PodiumBridge} */
	const bridge = globalThis.window['@podium'].bridge;
	bridge.on('foo/bar', (message) => {
		const request =
			/** @type {import("../lib/bridge.js").RpcRequest<string[]>} */ (message);
		assert.deepStrictEqual(request, rpcRequest);
		done();
	});

	globalThis.window.dispatchEvent(
		new globalThis.window.CustomEvent('rpcbridge', {
			detail: rpcRequest,
		}),
	);
});

test('unsubscribe should remove subscribed listener', () => {
	assert.ok(
		globalThis.window['@podium'].bridge,
		'Expected to find the Podium bridge on globalThis',
	);

	/** @type {import("../lib/bridge.js").PodiumBridge} */
	const bridge = globalThis.window['@podium'].bridge;

	let counter = 0;
	/** @type {import("../lib/bridge.js").EventHandler<unknown>} */
	const listener = () => {
		counter += 1;
	};
	bridge.on('bar/baz', listener);

	const event = new globalThis.window.CustomEvent('rpcbridge', {
		detail: {
			method: 'bar/baz',
			params: ['Hello', 'World!'],
			jsonrpc: '2.0',
		},
	});

	globalThis.window.dispatchEvent(event);
	globalThis.window.dispatchEvent(event);

	assert.equal(counter, 2);

	bridge.off('bar/baz', listener);

	globalThis.window.dispatchEvent(event);

	assert.equal(counter, 2);
});
