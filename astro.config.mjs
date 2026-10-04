import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  devToolbar: { enabled: false },
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        '/api/v1/fuse-bead': 'http://127.0.0.1:8100',
      },
    },
  },
});
