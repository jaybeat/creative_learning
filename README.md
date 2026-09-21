# 《数据结构》在线阅读站

把 `book/chapters/` 下的 Markdown 书稿自动切成按节阅读的静态网站。技术方案与验收标准见 [HANDOFF.md](HANDOFF.md)。

## 作者的日常流程

只需要碰 `book/` 目录。

1. 把新章节存为 `book/chapters/chNN.md`（`NN` 是两位章号，如 `ch03.md`）。文件内第一行必须是 `# 第N章 标题`，章号要与文件名一致。Markdown 写法不需要为网站做任何改变。
2. 在 `book/book.yml` 的 `chapters` 里加一行：

   ```yaml
   - file: ch03.md
     draft: false      # 还没写完想先占个位，就写 true：不生成页面，目录里灰显「即将发布」
   ```

3. `git push`。GitHub Actions 会自动测试、构建、发布，几分钟后网站更新。

## 本地预览

需要 Node ≥ 20。

```bash
npm install
```

```bash
npm run dev
```

然后打开终端里打印的地址。改动 `book/` 下的文件会自动重新切页并热更新。

其他命令：

| 命令 | 作用 |
|---|---|
| `npm run build` | 完整构建：字体子集化 → 切页 → VitePress，产物在 `site/.vitepress/dist/` |
| `npm run preview` | 本地预览构建产物（`http://localhost:4173`） |
| `npm test` | 单元测试（切页、导航、字宽校验等） |
| `npm run test:e2e` | 浏览器验收（需先 `npm run build`，首次先 `npx playwright install chromium webkit`） |

## 构建失败时最常见的两种报错

**1. 章号与文件名不一致**

```
文件名 ch03.md 与文件内的「第4章」不一致，应命名为 ch04.md
```

把文件改名，或改文件里的 `# 第N章`。

**2. 图示里出现了字体不支持的字符**

```
字体校验失败：以下 1 个字符在 Sarasa Fixed SC 里缺字形或字宽不对，图示会歪。
  ch03.md:128  「🙂」 U+1F642  字体里没有这个字符的字形
```

书里的字符画要求「中文占 2 列、其他一切字符占 1 列」，网站为此下发了一个等宽字体子集。如果在代码块或图示里用了这个字体没有的符号，或者它在字体里是全宽的，构建会当场报出来，并指出源文件与行号。换一个等价的符号即可（常用的 `─│┌┐└┘├┤┬┴┼╱► ▼ ▲ ◄ ●→←↑↓…` 都是支持的）。

## 目录结构

```
book/                 作者维护：book.yml + chapters/chNN.md
scripts/              构建脚本：build-font（字体）、build-content（切页）、dev（监听）
scripts/lib/          可单测的纯函数
site/                 VitePress 站点（.vitepress/generated、public/fonts、chNN/ 为构建产物）
tools/fonts/          Sarasa Fixed SC Regular 源文件（SIL OFL 1.1）
tests/unit、tests/e2e  vitest 单元测试、Playwright 浏览器验收
```

## 部署

push 到 `main` 触发 `.github/workflows/deploy.yml`。GitHub Pages 项目站的路径前缀 `/<repo>/` 自动推断；如果绑定了自定义域名，在仓库 Settings → Secrets and variables → Actions → Variables 里新建 `SITE_BASE`，值为 `/`。
