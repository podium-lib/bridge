export function uid() {
	if (
		typeof crypto !== 'undefined' &&
		typeof crypto.randomUUID !== 'undefined'
	) {
		return crypto.randomUUID();
	}
	return `${pseudorandom()}-${pseudorandom()}-${pseudorandom()}-${pseudorandom()}`;
}

/**
 * Get a random whole number between 0 and 100 represented as a base 32 value.
 * @returns {string} Pseudorandom string
 */
export function pseudorandom() {
	return Math.round(Math.random() * 100).toString(32);
}

const DEFAULT_TIMEOUT = 1000;

/**
 * @template T
 * @typedef {(response: RpcRequest<T> | RpcResponse<T>) => void} EventHandler
 */

/**
 * @template T
 * @typedef {object} RpcRequest
 * @property {string} [jsonrpc="2.0"]
 * @property {string} method
 * @property {T} params
 * @property {string | number} [id]
 */

/**
 * @template T
 * @typedef {object} RpcResponse
 * @property {string} jsonrpc JSON-RPC version, ex `"2.0"`
 * @property {string | number | null} [id] Unique request ID. If not provided one will be generated for you.
 * @property {T} [result]
 * @property {object} [error]
 * @property {number} error.code
 * @property {string} error.message
 * @property {unknown} [error.data]
 */

export class PodiumBridge {
	/**
	 * Keeps track of registered event handlers.
	 *
	 * For users, this is where their registered method event handlers are stored,
	 * which will be called when we receive JSON-RPC notifications from the native side of the bridge.
	 *
	 * We also keep track of outgoing RPC requests sent from us to the native side of the bridge using this map.
	 * The key is the request ID prefixed with _internal:, which we use to match responses to requests.
	 *
	 * @type {Record<string, EventHandler<any>[]>}
	 */
	#handlers = {};

	constructor() {
		if (typeof window !== 'undefined') {
			window.addEventListener('rpcbridge', this.#receiveMessage.bind(this));
		}
	}

	/**
	 * Call a method on the native side of the bridge and wait for a response.
	 *
	 * @template T
	 * @template Y
	 * @param {RpcRequest<Y>} request
	 * @param {number} [timeout=1000] Milliseconds to wait for a response before rejecting the promise. For long-running requests, use a {@link notification} and register a listener for a separate response notification sent by the native side.
	 * @returns {Promise<RpcResponse<T>>}
	 *
	 * @example Use call for quick request/response methods
	 *
	 * ```js
	 * const response = await bridge.call({ "method": "subtract", "params": {"subtrahend": 23, "minuend": 42}, "id": 3 });
	 * ```
	 *
	 * @example Use notification for long-running tasks
	 * ```js
	 * bridge.on("document/longRunning", (response) => {
	 *  console.log("Received a long running response", response);
	 * });
	 *
	 * bridge.notification({ "method": "document/longRunning", "params": { "status": "start" } });
	 * ```
	 */
	call(request, timeout = DEFAULT_TIMEOUT) {
		const promise = new Promise((resolve, reject) => {
			try {
				if (typeof timeout !== 'number')
					throw new TypeError('timeout must be a number');

				if (typeof request.method !== 'string')
					throw new TypeError('request.method must be a string');

				if (typeof request.id === 'undefined') request.id = uid();

				let timedout = false;
				const timer = setTimeout(() => {
					timedout = true;
					reject(new Error(`${request.method} timed out after ${timeout}ms`));
				}, timeout);
				const done = (args) => {
					clearTimeout(timer);
					if (args.errors) reject(new Error(JSON.stringify(args.errors)));
					else if (!timedout) resolve(args);
				};

				this.once(`_internal:${request.id}`, done);
				this.#sendMessage(request);
			} catch (err) {
				reject(err);
			}
		});
		return promise;
	}

	/**
	 * Emits a JSON-RPC notification to the native bridge.
	 * Pair with {@link on} to listen for responses for long-running tasks,
	 * or use {@link call} for quick request/response methods.
	 *
	 * @template T
	 * @param {RpcRequest<T>} notification
	 * @returns {void}
	 *
	 * @example Use notification for long-running tasks
	 * ```js
	 * bridge.on("document/longRunning", (response) => {
	 *  console.log("Received a long running response", response);
	 * });
	 *
	 * bridge.notification({ "method": "document/longRunning", "params": { "status": "start" } });
	 * ```
	 *
	 * @example Use call for quick request/response methods
	 *
	 * ```js
	 * const response = await bridge.call({ "method": "subtract", "params": {"subtrahend": 23, "minuend": 42}, "id": 3 });
	 * ```
	 */
	notification(notification) {
		if (typeof notification.id !== 'undefined')
			throw new Error(
				'Notifications cannot have an id. Use call for requests with an ID.',
			);

		this.#sendMessage(notification);
	}

	/**
	 * Register a handler for a JSON-RPC method.
	 * @template T
	 * @param {string} method
	 * @param {EventHandler<T>} eventHandler
	 */
	on(method, eventHandler) {
		if (typeof method !== 'string' && typeof method !== 'number')
			throw new Error('Request ID must be a string or number');

		if (typeof eventHandler !== 'function')
			throw new Error('Event handler must be a function');

		(this.#handlers[method] = this.#handlers[method] || []).push(eventHandler);
	}

	/**
	 * Unregisters a handler for a JSON-RPC method.
	 *
	 * @template T
	 * @param {string} method JSON-RPC 2.0 method name
	 * @param {EventHandler<T>} eventHandler
	 */
	off(method, eventHandler) {
		if (typeof method !== 'string') throw new Error('method must be a string');

		this.#handlers[method] = (this.#handlers[method] || []).filter(
			(fn) => eventHandler && fn !== eventHandler,
		);
	}

	/**
	 * Registers a once-off event handler for a JSON-RPC method.
	 * @template T
	 * @param {string} method JSON-RPC 2.0 method name
	 * @param {EventHandler<T>} handler
	 */
	once(method, handler) {
		if (typeof method !== 'string') throw new Error('method must be a string');
		if (typeof handler !== 'function')
			throw new Error('Handler must be of type function');

		/**
		 * @type {EventHandler<T>}
		 */
		const newHandler = (args) => {
			this.off(method, newHandler);
			handler(args);
		};

		this.on(method, newHandler);
	}

	/**
	 * Sends messages from the web view to the native side of the bridge.
	 * @param {RpcRequest<unknown>} message
	 * @returns {void}
	 */
	#sendMessage(message) {
		if (typeof message !== 'object')
			throw new Error('message must be an object');

		if (!message.jsonrpc) {
			message.jsonrpc = '2.0';
		}

		// @ts-ignore
		if (window.webkit && window.webkit.messageHandlers) {
			// @ts-ignore
			window.webkit.messageHandlers.nativebridgeiOS.postMessage(message);
			// @ts-ignore
		} else if (window.NativeBridgeAndroid) {
			// @ts-ignore
			window.NativeBridgeAndroid.send(JSON.stringify(message));
		} else {
			// Not in a hybrid setting. No-op.
		}
	}

	/**
	 * Handles messages coming in from the native side of the bridge.
	 *
	 * @param {CustomEvent} event
	 * @returns {void}
	 */
	#receiveMessage(event) {
		const message = /** @type {RpcRequest<unknown> | RpcResponse<unknown>} */ (
			event.detail
		);
		if (typeof message !== 'object')
			throw new Error('message must be an object');

		if (typeof message.jsonrpc !== 'string' || message.jsonrpc !== '2.0')
			throw new Error(`JSON-RPC version ${message.jsonrpc} is unsupported`);

		const request = /** @type {RpcRequest<unknown>} */ (message);
		if (typeof request.method === 'string') {
			this.#receiveRequest(request);
			return;
		}

		const response = /** @type {RpcResponse<unknown>} */ (message);
		if (response.error && response.id === null) {
			throw new Error(
				`The native web view got an invalid request. Response: ${JSON.stringify(
					response,
				)}`,
			);
		}

		const responseHandlerKey = `_internal:${response.id}`;
		const listeners = this.#handlers[responseHandlerKey] || [];
		for (const listener of listeners) {
			listener(response);
		}
	}

	/**
	 * The native side of the bridge has sent a request to the web view.
	 * We only support notifications, meaning the requests we receive can't have an ID.
	 *
	 * @param {RpcRequest<unknown>} message
	 * @returns {void}
	 */
	#receiveRequest(message) {
		if (message.id)
			throw new Error(
				`Native requests must be notifications. They cannot have an ID, but got ${JSON.stringify(
					message,
				)}`,
			);

		const listeners = this.#handlers[message.method] || [];
		for (const listener of listeners) {
			listener(message);
		}
	}

	destroy() {
		for (const topic of Object.keys(this.#handlers)) {
			this.#handlers[topic] = [];
		}
		if (typeof window !== 'undefined') {
			window.removeEventListener('nativebridge', this.#receiveMessage);
		}
	}
}

if (typeof window !== 'undefined') {
	window['@podium'] = window['@podium'] || {};
	window['@podium'].bridge = new PodiumBridge();
}
