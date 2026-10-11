# 评测机部署（作者操作）

评测机负责编译、运行读者提交的 C 代码。它只做「编译 + 按输入运行 + 返回输出」，题目与测试数据都在网站这边。

```
Vercel 函数 ──HMAC 签名的 HTTP──▶ 评测机 :8443  gateway（验签）──▶ 127.0.0.1:5050 go-judge（沙箱）+ gcc
```

- 不用 Docker（国内服务器拉不到 Docker Hub）；go-judge 是一个二进制文件，gcc、Node 从 apt 装。
- 沙箱：每次运行在独立容器里，没有网络、只允许 1 个进程、限时限内存，看不到服务器上的文件。
- 对外只开 8443，每个请求都要用共享密钥签名（带时间戳和随机数，防伪造、防重放），响应也签名。

## 1. 买服务器（约 10 分钟）

1. 阿里云控制台 →「99 计划」活动页 → **经济型 e 实例 2 核 2G，99 元/年**（新购、续费同价，下单前在活动页确认规则）。
   - 地域：**华南 1（深圳）** 或华南 2（河源）/华南 3（广州）——离 Vercel 新加坡最近。
   - 镜像：**Ubuntu 24.04 或 22.04 64 位**。
   - 登录方式：选 **密钥对**（没有就当场创建一个，私钥 `.pem` 下载后保存好，丢了就登不上）。
2. 实例的**安全组**入方向只保留两条：
   - `22/22`，来源 `0.0.0.0/0`（SSH；安装脚本会关闭密码登录）
   - `8443/8443`，来源 `0.0.0.0/0`（评测接口；Vercel 的出口 IP 不固定，没法限制来源，靠签名防护）
   - 其他默认规则（如 80、443、3389）删掉。
3. 记下实例的**公网 IP**。

## 2. 安装（约 5 分钟）

在自己电脑的仓库根目录执行（Git Bash；`key.pem` 换成你的私钥路径，`IP` 换成公网 IP）：

```bash
scp -i key.pem -r judge root@IP:/opt/
```

```bash
ssh -i key.pem root@IP "bash /opt/judge/install.sh"
```

脚本会：关闭 SSH 密码登录 → 装 gcc、Node → 下载并校验 go-judge → 生成密钥 → 启动两个服务 → 自检。最后打印两行：

```
  JUDGE_URL=http://<IP>:8443
  JUDGE_SECRET=<一串 64 位十六进制>
```

自检里每一项都应是 ✓。有 ✗ 就把整段输出发给维护者（**先删掉 JUDGE_SECRET 那行**）。

### 下载不动时

GitHub 在国内有时很慢。在自己电脑上下载 [go-judge_1.13.0_linux_amd64](https://github.com/criyle/go-judge/releases/download/v1.13.0/go-judge_1.13.0_linux_amd64)（约 23 MB），然后：

```bash
scp -i key.pem go-judge_1.13.0_linux_amd64 root@IP:/opt/judge/
```

再执行一次安装命令。脚本会校验文件的 SHA-256，不对就拒绝使用。

## 3. 填到 Vercel

Vercel → 项目 creative-learning → Settings → Environment Variables，添加 `JUDGE_URL`、`JUDGE_SECRET` 两个变量，勾选 **Production** 和 **Preview**。密钥只放在服务器和 Vercel 上，不要发到聊天、邮件或仓库里。

## 日常维护

| 要做的事 | 命令（ssh 登录后执行） |
|---|---|
| 看服务状态 | `systemctl status go-judge judge-gateway` |
| 看最近的日志 | `journalctl -u judge-gateway -n 100` |
| 重新自检 | `set -a; . /opt/judge/.env; set +a; JUDGE_URL=http://127.0.0.1:8443 node /opt/judge/smoke.mjs` |
| 更新网关代码 | 重新 `scp -r judge` 后执行 `install.sh`（密钥不变） |
| 换密钥 | 删掉 `/opt/judge/.env` 后执行 `install.sh`，把新密钥填回 Vercel 并重新部署 |

服务器重启后两个服务会自动启动。系统安全更新：`apt-get update && apt-get upgrade -y`，每月一次即可。
