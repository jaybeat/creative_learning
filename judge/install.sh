#!/usr/bin/env bash
# 评测机一键安装（Ubuntu 24.04，root 执行）。可重复执行：已有的密钥不会被覆盖。
#   用法：bash /opt/judge/install.sh
# 不用 Docker：国内服务器拉不到 Docker Hub 镜像；go-judge 是单个二进制文件，gcc 与 Node 从 apt（阿里云镜像）安装。
set -euo pipefail

GJ_VERSION=1.13.0
GJ_FILE=go-judge_${GJ_VERSION}_linux_amd64
GJ_SHA256=700d0ba6a6c02cce777e8761a5851b3d8d3e198e120887cda8e9134eb62efbce
DIR=/opt/judge

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m[错误] %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "请用 root 执行"
[ -f "$DIR/gateway.mjs" ] || die "请先把仓库里的 judge 目录上传到 $DIR（见 README）"
[ "$(uname -m)" = x86_64 ] || die "只支持 x86_64 机器"

say "1/6 SSH：只允许密钥登录"
if [ -s /root/.ssh/authorized_keys ]; then
  cat > /etc/ssh/sshd_config.d/99-judge.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
  sshd -t && systemctl reload ssh
  echo "已关闭密码登录。"
else
  echo "⚠ /root/.ssh/authorized_keys 是空的：为避免把你锁在外面，这次没有关闭密码登录。"
  echo "  请在阿里云控制台给实例绑定 SSH 密钥对后，再执行一次本脚本。"
fi

say "2/6 安装 gcc、Node.js"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q gcc libc6-dev curl ca-certificates xz-utils
# Ubuntu 24.04 的 apt 自带 Node 18；22.04 只有 Node 12，改从国内镜像装官方二进制（校验 SHA-256）
if apt-cache policy nodejs | grep -qE 'Candidate: (1[89]|2[0-9])\.'; then
  apt-get install -y -q nodejs
elif ! { command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]; }; then
  NODE_V=v22.12.0
  NODE_SHA256=22982235e1b71fa8850f82edd09cdae7e3f32df1764a9ec298c72d25ef2c164f
  curl -sSfL --connect-timeout 15 --max-time 300 -o /tmp/node.tar.xz "https://npmmirror.com/mirrors/node/$NODE_V/node-$NODE_V-linux-x64.tar.xz" \
    || die "Node.js 下载失败，请稍后重试"
  echo "$NODE_SHA256  /tmp/node.tar.xz" | sha256sum -c - || die "Node.js 文件校验失败"
  tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 && rm -f /tmp/node.tar.xz
  ln -sf /usr/local/bin/node /usr/bin/node
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js 版本太低（$(node -v)），需要 18 以上"
gcc --version | head -1
echo "node $(node -v)"

say "3/6 安装 go-judge v$GJ_VERSION"
mkdir -p "$DIR/bin"
if [ -f "$DIR/$GJ_FILE" ]; then
  echo "使用已上传的 $DIR/$GJ_FILE"
  cp "$DIR/$GJ_FILE" "$DIR/bin/go-judge.new"
else
  # GitHub 在国内可能很慢：失败时按 README 从自己电脑上传这个文件，再执行一次本脚本
  URL=${GH_PROXY:-}https://github.com/criyle/go-judge/releases/download/v$GJ_VERSION/$GJ_FILE
  echo "下载 $URL"
  curl -sSfL --connect-timeout 15 --max-time 600 -o "$DIR/bin/go-judge.new" "$URL" \
    || die "下载失败。请按 README「下载不动时」一节从自己电脑上传 $GJ_FILE 到 $DIR/ 后重试"
fi
echo "$GJ_SHA256  $DIR/bin/go-judge.new" | sha256sum -c - || { rm -f "$DIR/bin/go-judge.new"; die "go-judge 文件校验失败（不完整或被篡改）"; }
chmod 755 "$DIR/bin/go-judge.new"
mv "$DIR/bin/go-judge.new" "$DIR/bin/go-judge"

say "4/6 生成密钥"
if [ ! -f "$DIR/.env" ]; then
  printf 'JUDGE_SECRET=%s\nPORT=8443\n' "$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')" > "$DIR/.env"
  echo "已生成新密钥。"
else
  echo "沿用已有密钥。"
fi
chmod 600 "$DIR/.env"
chown root:root "$DIR/.env"

say "5/6 启动服务"
cp "$DIR/go-judge.service" "$DIR/judge-gateway.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now go-judge.service
systemctl restart go-judge.service
sleep 1
systemctl enable --now judge-gateway.service
systemctl restart judge-gateway.service
sleep 2
systemctl is-active --quiet go-judge.service || { journalctl -u go-judge -n 30 --no-pager; die "go-judge 没有启动"; }
systemctl is-active --quiet judge-gateway.service || { journalctl -u judge-gateway -n 30 --no-pager; die "gateway 没有启动"; }

say "6/6 自检（本机调用：编译运行、超时、禁止联网等）"
set -a; . "$DIR/.env"; set +a
JUDGE_URL=http://127.0.0.1:8443 node "$DIR/smoke.mjs"

IP=$(curl -s --max-time 3 http://100.100.100.200/latest/meta-data/eipv4 || true)
[ -n "$IP" ] || IP=$(curl -s --max-time 3 http://100.100.100.200/latest/meta-data/public-ipv4 || true)
say "安装完成。把下面两行填到 Vercel 项目的环境变量（Production 与 Preview 都要）："
echo
echo "  JUDGE_URL=http://${IP:-<服务器公网IP>}:8443"
echo "  JUDGE_SECRET=$JUDGE_SECRET"
echo
echo "密钥只在这台服务器和 Vercel 上保存，不要发到聊天、邮件或仓库里。"
