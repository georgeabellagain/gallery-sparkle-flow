import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import {resolve} from 'node:path';
export default defineConfig({plugins:[react(),tailwind()],resolve:{alias:{'@':resolve(process.cwd(),'src')}},server:{host:'127.0.0.1',port:5173}});
