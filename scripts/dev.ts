import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import chokidar from 'chokidar'
import { BOOK_DIR, GENERATED_DIR, ROOT, SITE_DIR } from './lib/paths'
import { runBuildFont } from './build-font'
import { runBuildContent } from './build-content'
import { startApiDev } from './lib/api-server'

const CONFIG_FILE = path.join(SITE_DIR, '.vitepress', 'config.ts')

/** generated/ 下各文件的修改时间，用来判断这次重新生成有没有改动配置依赖 */
function generatedStamp(): string {
  if (!fs.existsSync(GENERATED_DIR)) return ''
  return fs
    .readdirSync(GENERATED_DIR)
    .map((f) => `${f}:${fs.statSync(path.join(GENERATED_DIR, f)).mtimeMs}`)
    .join('|')
}

let settleTimer: NodeJS.Timeout | undefined

/**
 * 一次重新生成会接连改写好几个 generated/*.json（侧栏、目录、交叉引用、字体），VitePress 每改一个就重启一次。
 * 几次重启挤在同一秒里时，最后一次可能读到还没写完的状态，侧栏停在旧标题上（2026-10 实测）。
 * 所以等改写停下来之后，再碰一下 config.ts，让 VitePress 按最终的文件再重启一次。
 */
function settleRestart(): void {
  clearTimeout(settleTimer)
  settleTimer = setTimeout(() => {
    const now = new Date()
    fs.utimesSync(CONFIG_FILE, now, now)
  }, 1500)
}

async function rebuild(reason: string): Promise<void> {
  const t0 = Date.now()
  const before = generatedStamp()
  try {
    await runBuildFont()
    runBuildContent()
    console.log(`[dev] 重新生成完成（${reason}，${Date.now() - t0} ms）`)
  } catch (err) {
    console.error(`[dev] 生成失败：${err instanceof Error ? err.message : err}`)
  }
  if (generatedStamp() !== before) settleRestart()
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

  // 评论与登录的本地 API（PGlite + 验证码打印在终端），VitePress 把 /api 代理过去
  await startApiDev()

  const child = spawn('npx vitepress dev site', { cwd: ROOT, stdio: 'inherit', shell: true })
  child.on('exit', (code) => process.exit(code ?? 0))
}

main().catch((err) => {
  console.error(`[dev] ${err instanceof Error ? err.message : err}`)
  process.exit(1)
})
