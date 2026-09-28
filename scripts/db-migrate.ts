/**
 * 数据库迁移，在 Vercel 构建前执行（vercel.json 的 buildCommand）。
 * - 没有 DATABASE_URL（GitHub Actions、本地）→ 跳过
 * - 正式环境 → 迁移主库；预览环境 → Neon 集成为每个预览部署建了独立分支，DATABASE_URL 指向分支库
 * 迁移只做加法（加表、加列、加索引），保证旧代码在新表结构上照常运行。
 */
import { neonDb } from '../server/db.js'
import { migrate } from '../server/migrate.js'
import { readMigrations } from '../server/migrations-fs.js'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.log('[db] 没有 DATABASE_URL，跳过迁移')
    return
  }
  const host = new URL(url).host
  console.log(`[db] 环境 ${process.env.VERCEL_ENV ?? '本地'}，数据库 ${host}`)
  const applied = await migrate(neonDb(url), readMigrations())
  console.log(applied.length ? `[db] 已执行迁移：${applied.join('、')}` : '[db] 没有新的迁移')
}

main().catch((err) => {
  console.error('[db] 迁移失败', err)
  process.exit(1)
})
