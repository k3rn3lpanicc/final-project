import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';

export default defineConfig({
	plugins: [
		nodePolyfills({
			protocolImports: true,
		}),
	],

	define: {
		global: 'globalThis',
	},
	
	build: {
		rollupOptions: {
			input: {
				main: resolve(__dirname, 'index.html'),
				login: resolve(__dirname, 'login.html'),
			},
		},
	},
});
