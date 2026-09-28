// 单独启动本地 API（npm run dev 已经会自动启动它，一般不需要单独跑）
import { startApiDev } from './lib/api-server.js'

startApiDev().catch((err) => {
  console.error('[api] 启动失败', err)
  process.exit(1)
})
