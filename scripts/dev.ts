import { spawn } from 'node:child_process'
import chokidar from 'chokidar'
import { BOOK_DIR, ROOT } from './lib/paths'
import { runBuildFont } from './build-font'
import { runBuildContent } from './build-content'

async function rebuild(reason: string): Promise<void> {
  const t0 = Date.now()
  try {
    await runBuildFont()
    runBuildContent()
    console.log(`[dev] 重新生成完成（${reason}，${Date.now() - t0} ms）`)
  } catch (err) {
    console.error(`[dev] 生成失败：${err instanceof Error ? err.message : err}`)
  }
}

async function main(): Promise<void> {
  // 首次必须成功，否则 VitePress 缺少 generated/ 会起不来
  await runBuildFont()
  runBuildContent()

  let timer: NodeJS.Timeout | undefined
  chokidar.watch(BOOK_DIR, { ignoreInitial: true }).on('all', (event, file) => {
    clearTimeout(timer)
    timer = setTimeout(() => void rebuild(`${event} ${file}`), 300)
  })
  console.log(`[dev] 正在监听 ${BOOK_DIR}`)

  const child = spawn('npx vitepress dev site', { cwd: ROOT, stdio: 'inherit', shell: true })
  child.on('exit', (code) => process.exit(code ?? 0))
}

main().catch((err) => {
  console.error(`[dev] ${err instanceof Error ? err.message : err}`)
  process.exit(1)
})
