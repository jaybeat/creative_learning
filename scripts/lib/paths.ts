import { fileURLToPath } from 'node:url'
import path from 'node:path'

/** 仓库根目录（scripts/lib 的上两级）。 */
export const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
export const BOOK_DIR = path.join(ROOT, 'book')
export const BOOK_YML = path.join(BOOK_DIR, 'book.yml')
export const CHAPTERS_DIR = path.join(BOOK_DIR, 'chapters')
/** 首页文案（可选）：frontmatter 里一句定位，正文每个 ## 是一张理念卡片 */
export const HOME_MD = path.join(BOOK_DIR, 'home.md')
export const SITE_DIR = path.join(ROOT, 'site')
export const GENERATED_DIR = path.join(SITE_DIR, '.vitepress', 'generated')
export const FONTS_OUT_DIR = path.join(SITE_DIR, 'public', 'fonts')
export const FONT_SRC = path.join(ROOT, 'tools', 'fonts', 'SarasaFixedSC-Regular.ttf')
