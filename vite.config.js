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
  // The unit tests are pure logic — money, dates, filters. They must never build
  // a real Supabase client: once a local .env exists, vitest picks the keys up,
  // supabaseClient.js constructs a live client, and its realtime socket fails on
  // Node 20, taking six unrelated test files down with it. Blanking the keys for
  // the test run keeps the suite identical whether or not a developer has a .env.
  test: {
    env: {
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_PUBLISHABLE_KEY: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
  },
})
