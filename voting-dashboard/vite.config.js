import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
	plugins: [
		nodePolyfills({
			protocolImports: true,
		}),
	],

	define: {
		global: 'globalThis',
	},
	server: {
				allowedHosts: ['counter.emit-aut.ir'],
			},
});
