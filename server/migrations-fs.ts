import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Migration } from './migrate.js'

export const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../db/migrations')

export function readMigrations(dir = MIGRATIONS_DIR): Migration[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((name) => ({ name, sql: fs.readFileSync(path.join(dir, name), 'utf8') }))
}
