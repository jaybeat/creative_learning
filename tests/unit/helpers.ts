import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const FIXTURES = path.resolve(fileURLToPath(new URL('../fixtures', import.meta.url)))

export function fixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8')
}
