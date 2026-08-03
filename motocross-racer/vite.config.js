import { defineConfig } from 'vite';

export default defineConfig({
  resolve: { alias: { three: 'three' } },
  server: { port: 3000, host: true },
});
