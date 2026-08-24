import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'; // Memanggil kompiler inti Tailwind v4

// https://vitejs.dev
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
