import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
	const env = loadEnv(mode, process.cwd(), '')
	console.log(env.VITE_OFFLINE_VERSION === 'true' ? '/' : '/ViralWasm-Epi/')
	return {
		base: env.VITE_OFFLINE_VERSION === 'true' ? '/' : '/ViralWasm-Epi/',
		plugins: [react()],
		build: {
			sourcemap: true,
		},
		optimizeDeps: {
			exclude: ['pyodide']
		}
	}
})