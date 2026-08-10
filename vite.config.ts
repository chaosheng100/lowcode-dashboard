import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 统一同源代理：局域网设备访问 http://<本机IP>:5173 时，
// API/SSE/WebSocket 都走 5173 转发，不再依赖设备自身的 localhost。
const proxyTargets = {
  '/api': { target: 'http://localhost:3000', changeOrigin: true },
  '/socket.io': { target: 'http://localhost:3000', changeOrigin: true, ws: true },
  '/proxy': { target: 'http://localhost:5175', changeOrigin: true },
  '/health': { target: 'http://localhost:5175', changeOrigin: true },
  '/stream': { target: 'http://localhost:5175', changeOrigin: true, ws: true },
}

// 关闭自动清空输出目录：当前环境的 safe-delete 钩子会将 rm 拦截为 trash 并失败，
// 构建前用 `rm -rf dist` 手动清理即可。
export default defineConfig({
  plugins: [react()],
  build: { emptyOutDir: false },
  server: { port: 5173, host: true, proxy: proxyTargets },
  preview: { port: 4173, host: true, proxy: proxyTargets }
})
