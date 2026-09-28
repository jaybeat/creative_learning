import { PGlite } from '@electric-sql/pglite'
import type { Db } from './db.js'

/** 进程内 Postgres：单元测试用内存库，本地开发可传目录持久化。不会被 api/ 引用，不进生产包。 */
export async function pgliteDb(dataDir?: string): Promise<Db & { close(): Promise<void> }> {
  const pg = await PGlite.create(dataDir)
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await pg.query<T>(text, params)).rows
    },
    close: () => pg.close(),
  }
}
