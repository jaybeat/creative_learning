import { neon } from '@neondatabase/serverless'

/** 最小的数据库接口：生产用 Neon HTTP 驱动，测试与本地开发用 PGlite（见 db-pglite.ts） */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>
}

export function neonDb(url: string): Db {
  const sql = neon(url)
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.query(text, params)) as T[]
    },
  }
}

/** 唯一约束冲突（两种驱动都把 SQLSTATE 放在 error.code 上） */
export function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: unknown }).code === '23505'
}
