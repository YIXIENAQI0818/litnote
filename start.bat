@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

rem ---------- 后端：虚拟环境 + 依赖 ----------
where python >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 python 命令，请先安装 Python 3.12+ 并勾选 "Add to PATH"
  pause
  exit /b 1
)

if not exist "backend\.venv" (
  echo ==^> 创建 Python 虚拟环境并安装依赖…
  python -m venv backend\.venv
  backend\.venv\Scripts\python.exe -m pip install --upgrade pip
  backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
)

rem ---------- 前端：依赖 + 构建 ----------
if not exist "frontend\node_modules" (
  echo ==^> 安装前端依赖…
  pushd frontend
  call npm install
  popd
)
echo ==^> 构建前端…
pushd frontend
call npm run build
popd

echo.
echo LitNote 已启动：http://localhost:8000
echo （按 Ctrl+C 停止）
echo.

cd backend
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
