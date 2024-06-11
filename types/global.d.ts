import type { PodiumBridge } from '@podium/bridge';

declare global {
	interface PodiumGlobal {
		bridge: PodiumBridge;
	}

	interface Window {
		/**
		 * Used by `@podium/browser`.
		 * You should probably not be using this directly.
		 * @see https://github.com/podium-lib/browser
		 */
		'@podium': PodiumGlobal;
	}
}
