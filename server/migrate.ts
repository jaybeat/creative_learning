import type { Db } from './db.js'

export interface Migration {
  /** 文件名，如 001_init.sql；按名字排序执行 */
  name: string
  sql: string
}

/** 按语句拆分：迁移文件里只有 DDL，不含函数体，以行尾分号为界即可（Neon HTTP 驱动一次只能执行一条语句） */
export function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*$/m)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean)
}

/** 执行尚未执行过的迁移，返回本次执行的文件名 */
export async function migrate(db: Db, migrations: Migration[]): Promise<string[]> {
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
  const done = new Set((await db.query<{ name: string }>('SELECT name FROM schema_migrations')).map((r) => r.name))
  const applied: string[] = []
  for (const m of [...migrations].sort((a, b) => a.name.localeCompare(b.name))) {
    if (done.has(m.name)) continue
    for (const stmt of splitStatements(m.sql)) await db.query(stmt)
    await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [m.name])
    applied.push(m.name)
  }
  return applied
}
