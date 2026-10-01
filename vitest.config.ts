import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    // 服务端测试的第一个用例要建内存 Postgres（PGlite），并行时可能要十几秒
    testTimeout: 60_000,
  },
})
