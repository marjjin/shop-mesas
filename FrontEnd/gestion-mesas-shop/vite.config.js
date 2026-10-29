import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import { resolveApiUrl } from './src/shared/utils/apiUrl.js'

// https://vite.dev/config/
export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiUrl = resolveApiUrl({ configuredUrl: env.VITE_API_URL, production: command === 'build' || isPreview === true })
  const apiTarget = new URL(apiUrl)
  return {
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl) },
    server: {
      proxy: {
        '/api': {
          target: apiTarget.origin,
          changeOrigin: true,
          rewrite: (path) => apiTarget.pathname + path.slice('/api'.length),
        },
      },
    },
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] })
    ],
  }
})
