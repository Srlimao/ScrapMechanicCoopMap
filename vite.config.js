import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    base: './',
    root: './',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        assetsDir: 'assets',
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html')
            }
        }
    },
    server: {
        port: 5173,
        strictPort: true
    }
});
