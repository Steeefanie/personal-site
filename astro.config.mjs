import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://steeefanie.top',
  output: 'static',
  devToolbar: { enabled: false },
  integrations: [mdx()],
  markdown: {
    shikiConfig: {
      themes: {
        light: 'light-plus',
        dark: 'dark-plus',
      },
    },
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api/v1/fuse-bead': 'http://127.0.0.1:8100',
        '/api/v1/four-elements': 'http://127.0.0.1:8101',
        '/api/v1/seven-traits': 'http://127.0.0.1:8101',
      },
    },
    preview: {
      host: '0.0.0.0',
      proxy: { '/api/v1/four-elements': 'http://127.0.0.1:8101', '/api/v1/seven-traits': 'http://127.0.0.1:8101' },
    },
  },
});
