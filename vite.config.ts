import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  // Electron loads the production UI from file://, so asset URLs must be relative.
  base: './',
  plugins: [react(), tailwindcss()],
});

