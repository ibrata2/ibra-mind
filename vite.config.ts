import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  // Electron loads the production UI from file://, so asset URLs must be relative.
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@supabase/')) return 'cloud';
          if (id.includes('@xyflow/') || id.includes('d3-') || id.includes('zustand')) return 'canvas-engine';
          if (id.includes('pdfjs-dist')) return 'pdf-reader';
          if (id.includes('mammoth') || id.includes('read-excel-file') || id.includes('jszip')) return 'document-readers';
          if (id.includes('jspdf')) return 'pdf-export';
          if (id.includes('html2canvas')) return 'canvas-export';
          if (id.includes('react-dom') || id.includes('/react/')) return 'react-vendor';
          if (id.includes('framer-motion')) return 'motion';
        },
      },
    },
  },
});
