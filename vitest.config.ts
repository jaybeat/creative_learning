import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    // 服务端测试的第一个用例要建内存 Postgres（PGlite），并行时可能要十几秒
    testTimeout: 60_000,
    // 每个服务端测试文件各建一个 PGlite（几百 MB）：并发太高时本机内存不够，V8 会 OOM 崩溃
    maxWorkers: 4,
  },
})
