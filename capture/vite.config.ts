import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import {resolve} from 'node:path';
export default defineConfig({
  plugins:[react(),tailwind()],
  resolve:{alias:[
    // The worker `?url` import is not transformed outside the main app config; point it at a plain URL module.
    {find:/^pdfjs-dist\/build\/pdf\.worker\.min\.mjs\?url$/,replacement:resolve(process.cwd(),'capture/worker-url.ts')},
    {find:'@',replacement:resolve(process.cwd(),'src')},
  ]},
  optimizeDeps:{exclude:['pdfjs-dist']},
  server:{host:'127.0.0.1',port:5173},
});
