import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@supabase/')) return 'supabase';
          if (id.includes('node_modules/lucide-react/')) return 'icons';
          if (id.includes('node_modules/@google/genai')) return 'genai';
        },
      },
    },
  },
})
