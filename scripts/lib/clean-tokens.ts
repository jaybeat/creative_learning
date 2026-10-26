// 质感层的色值只写在这里：课程播放器、分镜墙（scripts/lib/clean.ts）和网站外壳（scripts/build-brand.ts → generated/brand.css）共用。
// 网站上加 --cl- 前缀，避免和 VitePress 的变量重名。

/** 浅色（课程画面只有这一套）。--ink-x 是对比页"正文颜色"开关切到纯黑时用的 */
export const TOKENS: Record<string, string> = {
  '--page': '#faf8f4', // 页面暖奶油
  '--stage': '#fdfdfd', // 舞台
  '--paper': '#ffffff', // 卡片、格子里面
  '--ink-strong': '#0a0a0a', // 标题
  '--ink': '#1f1f1f', // 正文
  '--mute': '#5f5f5f', // 注释
  '--faint': '#8a8a8a', // 下标、箭头
  '--line': '#e0dfe2', // 卡片、行
  '--line-soft': '#ececec', // 胶囊
  '--line-cell': '#cfcfd3', // 格子、编辑器：数据结构的主图形，比卡片深一档
  '--dash': '#d4d4d4', // 虚线占位
  '--c1-soft': '#e4ecf6', '--c1': '#0e3061', '--c1-line': '#b9c9e2', // 蓝标签 / 正在讲的
  '--c2-soft': '#e5f5f2', '--c2': '#0f6e5a', // 绿标签
  '--warm-soft': '#fbebe3', '--warm': '#97412a', // 练习、问题小标签
  '--ok': '#1d8a66', // 勾
  '--off': '#9b9b9b', // 错：变灰加划线
  '--caret': '#2f6bd8', // 编辑器光标
  '--btn': '#ececee',
  '--track': '#e9e5da', // 播放器进度条底轨（Gauth 的米色）
}

/** 代码卡（c-editor）的语法高亮色，照网站代码块的 github-light；只在用到代码卡的页面里输出 */
export const CODE_TOKENS: Record<string, string> = {
  '--shiki-foreground': '#24292e',
  '--shiki-token-keyword': '#d73a49',
  '--shiki-token-constant': '#005cc5',
  '--shiki-token-string': '#032f62',
  '--shiki-token-string-expression': '#032f62',
  '--shiki-token-comment': '#6a737d',
  '--shiki-token-function': '#6f42c1',
  '--shiki-token-parameter': '#24292e',
  '--shiki-token-punctuation': '#24292e',
  '--shiki-token-link': '#032f62',
  '--code-cur': '#f3f6fb', // 当前行底带
}

/** 深色：只给网站外壳用（网站有深色模式，课程画面没有）。同样是"字亮线淡、底深字浅的标签" */
export const DARK_TOKENS: Record<string, string> = {
  '--page': '#1b1b1f',
  '--stage': '#1e1e22',
  '--paper': '#222227',
  '--ink-strong': '#f4f4f2',
  '--ink': '#dfdfd8',
  '--mute': '#a3a3a8',
  '--faint': '#7c7c84',
  '--line': '#36363d',
  '--line-soft': '#2f2f35',
  '--line-cell': '#4a4a52',
  '--dash': '#46464d',
  '--c1-soft': '#1f2b3e', '--c1': '#b4cbef', '--c1-line': '#3a5684',
  '--c2-soft': '#17302b', '--c2': '#86d4c1',
  '--warm-soft': '#3a251d', '--warm': '#f0ae93',
  '--ok': '#4fc499',
  '--off': '#6e6e6e',
  '--caret': '#6c9cf0',
  '--btn': '#2f2f35',
  '--track': '#3a3832',
}

/** 字体栈：宋体标题、黑体正文。课程里字体是内嵌子集（CleanSerif/CleanSans），网站上宋体是 BrandSerif 子集 */
export const SERIF = `"CleanSerif","Songti SC","SimSun",serif`
export const SANS = `"CleanSans","Microsoft YaHei","PingFang SC",sans-serif`
export const MONO = `"CleanMono",Consolas,monospace`
