import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/mia-chat-[hash].js',
        chunkFileNames: 'assets/mia-chat-[hash].js',
        assetFileNames: 'assets/mia-chat-[hash].[ext]',
      },
    },
  },
});
