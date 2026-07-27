import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 关闭自动清空输出目录：当前环境的 safe-delete 钩子会将 rm 拦截为 trash 并失败，
// 构建前用 `rm -rf dist` 手动清理即可。
export default defineConfig({
  plugins: [react()],
  build: { emptyOutDir: false },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true }
})
