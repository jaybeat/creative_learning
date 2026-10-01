// 评测机自检：安装时在服务器上跑，也可以在自己电脑上对公网地址跑。
//   JUDGE_URL=http://<IP>:8443 JUDGE_SECRET=... node judge/smoke.mjs            功能与安全检查
//   JUDGE_URL=... JUDGE_SECRET=... node judge/smoke.mjs --bench 200            连续评测 200 次，统计成功率与延迟
// 无第三方依赖，兼容 Node 18。
import { randomBytes } from 'node:crypto'
import { signRequest, verifyResponse } from './protocol.mjs'

const URL_BASE = (process.env.JUDGE_URL ?? '').replace(/\/+$/, '')
const SECRET = process.env.JUDGE_SECRET ?? ''
if (!URL_BASE || !SECRET) {
  console.error('需要环境变量 JUDGE_URL 与 JUDGE_SECRET')
  process.exit(2)
}

/** 签名调用 /judge；over 用来构造攻击请求 */
async function call(payload, over = {}) {
  const body = JSON.stringify(payload)
  const signed = signRequest(SECRET, { method: 'POST', path: over.signPath ?? '/judge', body, now: over.now ?? Date.now() })
  const headers = { 'content-type': 'application/json', ...signed.headers, ...over.headers }
  const res = await fetch(URL_BASE + '/judge', { method: 'POST', headers, body: over.body ?? body, signal: AbortSignal.timeout(20_000) })
  const text = await res.text()
  const h = { 'x-judge-ts': res.headers.get('x-judge-ts'), 'x-judge-sig': res.headers.get('x-judge-sig') }
  const sigErr = res.status === 401 ? null : verifyResponse(SECRET, { status: res.status, nonce: signed.nonce, headers: h, body: text })
  return { status: res.status, json: JSON.parse(text), sigErr, headers, rawBody: over.body ?? body }
}

const key = () => 'smoke-' + randomBytes(6).toString('hex')
const judge = (code, inputs = ['']) => call({ key: key(), code, inputs })

const CASES = [
  {
    name: '编译运行：A+B',
    code: '#include <stdio.h>\nint main(void){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}',
    inputs: ['1 2', '-5 5'],
    check: (r) => r.compile.ok && r.runs[0].stdout === '3\n' && r.runs[1].stdout === '0\n',
  },
  {
    name: '编译错误有信息且不含沙箱路径',
    code: 'int main(void){ return x; }',
    check: (r) => !r.compile.ok && /error/.test(r.compile.message) && !r.compile.message.includes('/w/'),
  },
  { name: '死循环 → 超时', code: 'int main(void){ for(;;); }', check: (r) => r.runs[0].status === 'time_limit' },
  {
    name: '申请 1 GB 内存 → 超内存',
    // 每次 1 MB、逐页写入并参与输出，防止 -O2 把整段分配优化掉
    code:
      '#include <stdio.h>\n#include <stdlib.h>\nint main(void){ long s=0; for(int i=0;i<1024;i++){ char*p=malloc(1<<20);' +
      ' if(!p){ printf("null at %d\\n", i); return 0; } for(int k=0;k<(1<<20);k+=4096) p[k]=(char)i; s+=p[0]; } printf("%ld\\n", s); return 0; }',
    // 限制 128 MB：被杀（超内存 / 运行出错），或者 malloc 在 128 MB 之前就返回 NULL
    check: (r) => ['memory_limit', 'runtime_error'].includes(r.runs[0].status) || /^null at (\d|[1-9]\d|1[0-2]\d)\n$/.test(r.runs[0].stdout),
  },
  { name: '空指针 → 运行出错', code: 'int main(void){ int *p=0; *p=1; return 0; }', check: (r) => r.runs[0].status === 'runtime_error' },
  {
    name: '禁止联网',
    code:
      '#include <stdio.h>\n#include <sys/socket.h>\n#include <netinet/in.h>\n#include <arpa/inet.h>\n' +
      'int main(void){ int s=socket(AF_INET,SOCK_STREAM,0); if(s<0){puts("blocked");return 0;}' +
      ' struct sockaddr_in a={0}; a.sin_family=AF_INET; a.sin_port=htons(80); inet_pton(AF_INET,"223.5.5.5",&a.sin_addr);' +
      ' puts(connect(s,(struct sockaddr*)&a,sizeof a)<0?"blocked":"CONNECTED"); return 0; }',
    check: (r) => r.runs[0].stdout === 'blocked\n' || r.runs[0].status === 'runtime_error',
  },
  {
    name: '禁止开子进程（fork / system）',
    // -std=c11 下 unistd.h 不定义 pid_t，需要 _GNU_SOURCE
    code: '#define _GNU_SOURCE\n#include <stdio.h>\n#include <unistd.h>\nint main(void){ pid_t p=fork(); if(p<0) puts("blocked"); else if(p==0) _exit(0); else puts("FORKED"); return 0; }',
    check: (r) => r.runs[0].stdout === 'blocked\n' || r.runs[0].status === 'runtime_error',
  },
  {
    name: '读不到服务器上的密钥与系统文件',
    code: '#include <stdio.h>\nint main(void){ FILE*f=fopen("/opt/judge/.env","r"); FILE*g=fopen("/etc/shadow","r"); puts(f||g?"LEAK":"safe"); return 0; }',
    check: (r) => r.runs[0].stdout === 'safe\n',
  },
  {
    name: '写不了系统目录',
    code: '#include <stdio.h>\nint main(void){ FILE*f=fopen("/usr/bin/pwned","w"); puts(f?"WROTE":"safe"); return 0; }',
    check: (r) => r.runs[0].stdout === 'safe\n',
  },
  {
    name: '输出过多 → 输出超限',
    code: '#include <stdio.h>\nint main(void){ for(long i=0;i<10000000;i++) puts("xxxxxxxxxxxxxxxx"); return 0; }',
    check: (r) => ['output_limit', 'runtime_error', 'time_limit'].includes(r.runs[0].status),
  },
]

async function functional() {
  let failed = 0
  const ok = (name, pass, detail = '') => {
    console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : '  ' + detail}`)
    if (!pass) failed++
  }
  for (const c of CASES) {
    try {
      const r = await judge(c.code, c.inputs)
      // 用例代码本身编译不过，是自检脚本的问题：单独报出来，别误判成沙箱有漏洞
      if (r.status === 200 && r.json.compile && !r.json.compile.ok && !c.name.includes('编译错误')) {
        ok(c.name, false, '自检代码编译失败：' + r.json.compile.message.slice(0, 300))
        continue
      }
      ok(c.name, r.status === 200 && !r.sigErr && c.check(r.json), JSON.stringify({ status: r.status, sigErr: r.sigErr, body: r.json }).slice(0, 600))
    } catch (e) {
      ok(c.name, false, String(e))
    }
  }

  const payload = { key: key(), code: 'int main(void){return 0;}', inputs: [''] }
  const expired = await call(payload, { now: Date.now() - 5 * 60_000 })
  ok('过期请求被拒', expired.status === 401 && expired.json.error === 'expired', JSON.stringify(expired.json))
  const tampered = await call(payload, { body: JSON.stringify({ ...payload, code: 'int main(void){for(;;);}' }) })
  ok('篡改请求体被拒', tampered.status === 401 && tampered.json.error === 'bad_sig', JSON.stringify(tampered.json))
  const wrongPath = await call(payload, { signPath: '/other' })
  ok('签名路径不符被拒', wrongPath.status === 401, JSON.stringify(wrongPath.json))
  const first = await call({ ...payload, key: key() })
  const replay = await fetch(URL_BASE + '/judge', { method: 'POST', headers: first.headers, body: first.rawBody })
  ok('原样重放被拒', replay.status === 401 && (await replay.json()).error === 'replay')
  const unsigned = await fetch(URL_BASE + '/judge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  ok('不带签名被拒', unsigned.status === 401)

  console.log(failed ? `\n${failed} 项未通过` : '\n全部通过')
  process.exit(failed ? 1 : 0)
}

async function bench(n) {
  const code = '#include <stdio.h>\nint main(void){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}'
  const times = []
  let fail = 0
  for (let i = 0; i < n; i++) {
    const t = Date.now()
    try {
      const r = await judge(code, ['1 2', '3 4', '5 6'])
      if (r.status === 200 && !r.sigErr && r.json.runs?.[2]?.stdout === '11\n') times.push(Date.now() - t)
      else fail++
    } catch {
      fail++
    }
    if ((i + 1) % 20 === 0) process.stdout.write(`${i + 1}/${n} `)
  }
  times.sort((a, b) => a - b)
  const q = (p) => times[Math.min(times.length - 1, Math.floor(p * times.length))] ?? NaN
  console.log(`\n成功 ${times.length}/${n}（单次，不含重试），P50 ${q(0.5)} ms，P95 ${q(0.95)} ms，最慢 ${times.at(-1)} ms`)
}

const i = process.argv.indexOf('--bench')
if (i >= 0) await bench(Number(process.argv[i + 1]) || 100)
else await functional()
