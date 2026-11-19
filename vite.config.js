import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 这个插件让 Vite 看得懂 JSX
export default defineConfig({
  plugins: [react()],
});
