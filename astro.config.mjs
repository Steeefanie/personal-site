import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://steeefanie.top',
  output: 'static',
  devToolbar: { enabled: false },
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api/v1/fuse-bead': 'http://127.0.0.1:8100',
      },
    },
    preview: {
      host: '0.0.0.0',
    },
  },
});
