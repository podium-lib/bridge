import type { PodiumBridge } from '@podium/bridge';

declare global {
	interface PodiumGlobal {
		bridge: PodiumBridge;
	}

	interface Window {
		podium: PodiumGlobal;
	}
}
