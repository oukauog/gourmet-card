import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Allow access from phones on the same LAN (prints http://192.168.x.x:5173)
    host: true,
    port: 5173,
    strictPort: true,
  },
})
