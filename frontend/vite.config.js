import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  // ============================================================
  // DEVELOPMENT SERVER CONFIGURATION
  // ============================================================
  // This configuration is ONLY used in development (npm run dev)
  // In production, the frontend is built and served by the backend
  server: {
    port: 5173,
    proxy: {
      // Proxy API requests to backend during development
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Generate manifest for easier integration
    manifest: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/mia-chat-[hash].js',
        chunkFileNames: 'assets/mia-chat-[hash].js',
        assetFileNames: (assetInfo) => {
          // CSS files get a simpler name for easier reference in PrestaShop
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/mia-chat.css';
          }
          return 'assets/mia-chat-[hash].[ext]';
        },
      },
    },
  },
});
