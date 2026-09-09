#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  printf '数据库初始化需要 Node.js，请先安装项目所需的 Node.js。\n' >&2
  exit 1
fi

exec node "$SCRIPT_DIR/init.cjs" "$@"
