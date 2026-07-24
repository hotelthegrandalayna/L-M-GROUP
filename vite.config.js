import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'
import { join } from 'path'

// Unique stamp per build. Baked into the app AND written to dist/version.json
// so a running tab can detect when a newer version has been deployed and
// auto-reload itself — no computer stays stuck on an old, unsafe version.
const BUILD_VERSION = String(Date.now())

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'write-version-json',
      closeBundle() {
        try {
          writeFileSync(join(process.cwd(), 'dist', 'version.json'), JSON.stringify({ v: BUILD_VERSION }))
        } catch (err) {
          console.error('Failed to write version.json:', err)
        }
      },
    },
  ],
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
})
