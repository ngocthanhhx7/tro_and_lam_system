import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const frontendPort = Number(process.env.FRONTEND_PORT || 5173);
const apiProxyTarget = process.env.API_PROXY_TARGET || `http://localhost:${process.env.PORT || 5000}`;

export default defineConfig({
  plugins: [react()],
  server: { port: frontendPort, strictPort: true, proxy: { '/api': apiProxyTarget, '/media': apiProxyTarget } }
});
