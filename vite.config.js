import { defineConfig } from 'vite';

export default defineConfig({
  build: { rollupOptions: { input: { portal: 'index.html', display: 'display.html', admin: 'admin.html' } } },
});
