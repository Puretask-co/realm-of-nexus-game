import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    }
  },
  server: {
    port: 8080,
    open: true,
    watch: {
      // Ensure Vite watches data files for hot reload
      include: ['src/data/**/*.json']
    }
  },
  // Allow importing JSON files with HMR support
  json: {
    stringify: false
  }
});
