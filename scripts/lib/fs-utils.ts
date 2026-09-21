import fs from 'node:fs'
import path from 'node:path'

/**
 * 内容没变就不写盘。VitePress 把 generated/*.json 当作配置依赖，
 * 每次改写都会触发整站重启；只在内容真的变化时写，dev 模式下改一处正文只走热更新。
 */
export function writeIfChanged(file: string, content: string | Buffer): boolean {
  if (fs.existsSync(file)) {
    const old = fs.readFileSync(file)
    if (typeof content === 'string' ? old.toString('utf8') === content : old.equals(content)) return false
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  return true
}
