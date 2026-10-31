// Configuración de Vite, el servidor de desarrollo y compilador del frontend.
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import { resolveApiUrl } from './src/shared/utils/apiUrl.js'

// https://vite.dev/config/
export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Valida la URL de la API. Si un build de producción apunta a localhost, falla acá.
  const apiUrl = resolveApiUrl({ configuredUrl: env.VITE_API_URL, production: command === 'build' || isPreview === true })
  const apiTarget = new URL(apiUrl)
  return {
    // Reemplaza el valor en el código compilado: por eso cambiar la URL exige recompilar.
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl) },
    server: {
      // Proxy de desarrollo: Vite reenvía /api al backend y el navegador no necesita CORS.
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
