import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Tách Firebase thành chunk riêng để cache lâu dài
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/analytics'],
          // Thư viện chart nặng
          recharts: ['recharts'],
          // Thư viện xử lý file (chỉ dùng trong admin form)
          xlsx: ['xlsx'],
          mammoth: ['mammoth'],
          'pdfjs-dist': ['pdfjs-dist'],
          // Vendor React core
          vendor: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})