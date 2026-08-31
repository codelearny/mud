import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: './',
  // 生产构建不注册 Vue DevTools 钩子：部署游戏无需扩展挂载，
  // 也避免第三方 DevTools 扩展在劫持响应式更新时抛错（如 reportAllChanges 读 undefined.startTime）
  define: {
    __VUE_PROD_DEVTOOLS__: false,
  },
})
