#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# ---------- 后端：虚拟环境 + 依赖 ----------
if [ ! -x "backend/.venv/bin/python" ]; then
  echo "==> 创建 Python 虚拟环境并安装依赖…"
  rm -rf backend/.venv
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install --upgrade pip
  backend/.venv/bin/pip install -r backend/requirements.txt
fi

# ---------- 前端：依赖 + 构建 ----------
if [ ! -e "frontend/node_modules/.bin/vite" ]; then
  echo "==> 安装前端依赖…"
  rm -rf frontend/node_modules
  (cd frontend && npm install)
fi
echo "==> 构建前端…"
(cd frontend && npm run build)

echo ""
echo "LitNote 已启动：http://localhost:8000"
echo "（按 Ctrl+C 停止）"
echo ""

# ---------- 服务就绪后自动打开浏览器 ----------
open_browser() {
  sleep 2
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:8000" >/dev/null 2>&1
  elif command -v open >/dev/null 2>&1; then
    open "http://localhost:8000" >/dev/null 2>&1
  elif command -v explorer.exe >/dev/null 2>&1; then
    explorer.exe "http://localhost:8000" >/dev/null 2>&1
  fi
}
open_browser &

cd backend
exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
