# 《数据结构》在线阅读站

把 `book/chapters/` 下的 Markdown 书稿自动切成按节阅读的静态网站。技术方案与验收标准见 [HANDOFF.md](HANDOFF.md)。

## 作者的日常流程

只需要碰 `book/` 目录。

1. 把新章节存为 `book/chapters/chNN.md`（`NN` 是两位章号，如 `ch03.md`）。文件内第一行必须是 `# 第N章 标题`，章号要与文件名一致。Markdown 写法不需要为网站做任何改变。
2. 在 `book/book.yml` 的 `chapters` 里加一行：

   ```yaml
   - file: ch03.md
     draft: false      # 还没写完想先占个位，就写 true：完全隐藏，不生成页面、不进目录，但会提前校验图示字符
   ```

3. `git push`。Vercel 会自动构建并发布，几分钟后网站更新；GitHub Actions 同时跑一遍测试与浏览器验收作为质量门禁。

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

## 读者能用到的功能

- **搜索**：导航栏搜索框或 `Ctrl K`，中文按词片段匹配，也能搜 `malloc` 这类标识符。
- **阅读进度**：读到一节的页底即记为已读，目录里显示 ✓；首页和章首页有「继续阅读」，回到上次的位置。记录只存在本机浏览器里，首页可一键清除。
- **字号**：导航栏右侧「小 / 中 / 大」，正文与代码一起缩放，记住选择。
- **键盘**：`←` `→` 翻到上一节 / 下一节（焦点在输入框或搜索框时不触发）。
- **长代码折叠**：超过 40 行的代码块默认只露出前 20 行，点「展开全部」看完整。阈值在 `scripts/lib/md-plugins.ts` 的 `FOLD_THRESHOLD` 里改。
- **分享具体小节**：鼠标移到标题上出现 `#`，点击即得到带锚点的链接，如 `/ch02/2-8#2-8-1`。

## 书稿里的两种自动处理

- **交叉引用**：正文里的「2.6节」「2.4.3节」「第3章」会自动变成链接（只认带「节」字或「第N章」的写法，「编辑器2.2」这类版本号不会被误链）。目标章节还不存在时保持纯文本，构建日志末尾会列出清单，例如：

  ```
  [xref] 未解析的交叉引用 8 处（目标章节尚不存在，已保持为纯文本）：
    第1章  ← ch02.md:5, ch02.md:13, ch02.md:36 …
    2.13节  ← ch02.md:1412
  ```

  这份清单也顺带能查出写错的节号。
- **里程碑卡片**：以 `> **到这里你有了**：…` 开头的引用块渲染成卡片，每行「**标签**：内容」一行。已知标签有对应图标（到这里你有了 ✓、下一步 →、还没解决的 !），新标签自动走默认样式，不用改代码。

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

- **托管：Vercel。** 配置在 `vercel.json`（构建命令 `npm run build`，输出目录 `site/.vitepress/dist`，`cleanUrls` 与 VitePress 保持一致）。首次接入：在 Vercel 里 Import 这个仓库，其余设置会自动从 `vercel.json` 读取，不需要手填。自定义域名在 Vercel 项目的 Domains 里添加，然后按提示在域名 DNS 加一条 CNAME 记录。
- **路径前缀。** 站点默认部署在域名根（`SITE_BASE` 为 `/`）。如果将来要放到某个子路径下，在 Vercel 项目的 Environment Variables 里设置 `SITE_BASE`，值形如 `/ds/`。
- **质量门禁：GitHub Actions。** push 到 `main` 或提 PR 会触发 `.github/workflows/ci.yml`：单元测试 → 构建 → Playwright 浏览器验收。它不负责发布，失败了也不会阻止 Vercel 部署，但会在 GitHub 上标红提醒。
