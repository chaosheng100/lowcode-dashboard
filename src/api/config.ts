// 默认同源 /api，由 Vite 代理转发到后端；局域网访问无需改成局域网 IP。
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
