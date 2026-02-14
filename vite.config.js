import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

/**
 * Vite plugin that watches JSON data files and sends custom HMR events
 * to the running game. When a data file in src/data/ changes, it parses
 * the JSON and pushes a 'verdance:data-update' event so the HotReloadSystem
 * can apply changes instantly without a full page reload.
 */
function verdanceHotReloadPlugin() {
  // Map file paths to data keys based on filename
  const dataDir = 'src/data/';

  return {
    name: 'verdance-hot-reload',
    handleHotUpdate({ file, server }) {
      // Only handle JSON files in the data directory
      if (!file.endsWith('.json')) return;

      const normalizedFile = file.replace(/\\/g, '/');
      const dataIndex = normalizedFile.indexOf(dataDir);
      if (dataIndex === -1) return;

      const relativePath = normalizedFile.slice(dataIndex);
      // Derive the data key from filename (e.g. 'src/data/spells.json' → 'spells')
      const filename = relativePath.split('/').pop();
      const key = filename.replace('.json', '');

      try {
        const content = readFileSync(file, 'utf-8');
        const data = JSON.parse(content);

        server.hot.send({
          type: 'custom',
          event: 'verdance:data-update',
          data: {
            key,
            data,
            path: '/' + relativePath,
            timestamp: Date.now()
          }
        });

        console.log(`[verdance-hot-reload] Sent update for '${key}' (${relativePath})`);
      } catch (err) {
        console.error(`[verdance-hot-reload] Failed to parse ${file}:`, err.message);
      }

      // Return empty array to prevent default HMR behavior for these files
      return [];
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [verdanceHotReloadPlugin()],
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
