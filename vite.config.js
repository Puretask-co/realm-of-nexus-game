import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
            output: {
                // Vite 8 / Rollup 4 only accept the function form of
                // manualChunks (the object form throws at build time).
                manualChunks(id) {
                    if (id.includes('node_modules/phaser')) return 'phaser';
                }
            }
        }
    },
    server: {
        port: 3000,
        open: false
    },
    optimizeDeps: {
        entries: ['index.html']
    }
});
