/// <reference types="vite/client" />

// 独立部署产物：原生运行态脚本以 ?raw 文本形式导入（避免被 Vite 当作模块编译）
declare module '*.js?raw' {
  const src: string
  export default src
}
