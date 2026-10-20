import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('.', import.meta.url))
  const env = loadEnv(mode, envDir, 'API_URL')
  return {
    envDir,
    define: { 'import.meta.env.API_URL': JSON.stringify(env.API_URL || '') },
    plugins: [react(), tailwindcss()],
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  }
})
