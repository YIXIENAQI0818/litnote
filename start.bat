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

rem 检测 Windows 可用的 python.exe（而非仅目录存在），兼容跨平台残留的 venv
if not exist "backend\.venv\Scripts\python.exe" (
  echo ==^> 创建 Python 虚拟环境并安装依赖…
  if exist "backend\.venv" rmdir /s /q "backend\.venv"
  python -m venv backend\.venv
  backend\.venv\Scripts\python.exe -m pip install --upgrade pip
  backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
)

rem ---------- 前端：依赖 + 构建 ----------
rem 检测 Windows 的 .cmd 标记（而非仅目录存在），兼容跨平台残留的 node_modules
if not exist "frontend\node_modules\.bin\vite.cmd" (
  echo ==^> 安装前端依赖…
  if exist "frontend\node_modules" rmdir /s /q "frontend\node_modules"
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

rem ---------- 服务就绪后自动打开浏览器 ----------
start "" /min powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:8000'"

cd backend
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
pause
