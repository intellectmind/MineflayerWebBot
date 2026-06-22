@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Mineflayer Web Bot 1.0.0

set "APP_VERSION=1.0.0"
set "NODE_VERSION=22.23.0"
set "WEB_PORT=15666"
set "RUNTIME_DIR=%CD%\.runtime"
set "NODE_ARCH=x64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "NODE_ARCH=arm64"
if /I "%PROCESSOR_ARCHITEW6432%"=="ARM64" set "NODE_ARCH=arm64"
set "NODE_FOLDER=node-v%NODE_VERSION%-win-%NODE_ARCH%"
set "NODE_DIR=%RUNTIME_DIR%\%NODE_FOLDER%"
set "NODE_ZIP=%RUNTIME_DIR%\%NODE_FOLDER%.zip"
set "NODE_URL_CN=https://npmmirror.com/mirrors/node/v%NODE_VERSION%/%NODE_FOLDER%.zip"
set "NODE_URL_OFFICIAL=https://nodejs.org/dist/v%NODE_VERSION%/%NODE_FOLDER%.zip"
set "NPM_REGISTRY_CN=https://registry.npmmirror.com"
set "NPM_REGISTRY_OFFICIAL=https://registry.npmjs.org"
set "NPM_REGISTRY=%NPM_REGISTRY_CN%"
set "NODE_EXE=node"
set "NPM_CMD=npm.cmd"
set "ACTION="
set "RESET_DEPS=0"

cls
echo ========================================
echo   Mineflayer Web Bot %APP_VERSION%
echo ========================================
echo.
echo  Enter    : start
echo  r        : reset dependencies then start
echo  n        : use official npm registry for this run
echo  c        : remove portable Node runtime
echo  q        : quit
echo.
set /p "ACTION=Select: "

if /I "%ACTION%"=="q" exit /b 0
if /I "%ACTION%"=="c" goto CLEAN_RUNTIME
if /I "%ACTION%"=="n" set "NPM_REGISTRY=%NPM_REGISTRY_OFFICIAL%"
if /I "%ACTION%"=="r" set "RESET_DEPS=1"

echo.
echo [1/5] Checking Node.js 22+ ...
where node >nul 2>nul
if not errorlevel 1 (
  set "NODE_MAJOR="
  for /f "delims=" %%v in ('node -p "process.versions.node.split('.')[0]" 2^>nul') do set "NODE_MAJOR=%%v"
  if defined NODE_MAJOR (
    if !NODE_MAJOR! GEQ 22 (
      set "NODE_EXE=node"
      set "NPM_CMD=npm.cmd"
      for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_TEXT=%%v"
      echo [OK] Using system Node: !NODE_TEXT!
      goto NODE_READY
    )
  )
)

if exist "%NODE_DIR%\node.exe" (
  set "NODE_EXE=%NODE_DIR%\node.exe"
  set "NPM_CMD=%NODE_DIR%\npm.cmd"
  set "PATH=%NODE_DIR%;%NODE_DIR%\node_modules\npm\bin;%PATH%"
  echo [OK] Using portable Node: %NODE_DIR%
  goto NODE_READY
)

echo [INFO] Node.js 22+ was not found. Downloading portable Node %NODE_VERSION% ...
if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%"
echo [DOWNLOAD] %NODE_URL_CN%
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri '%NODE_URL_CN%' -OutFile '%NODE_ZIP%'"
if errorlevel 1 (
  echo [WARN] China mirror failed. Trying official Node.js source ...
  echo [DOWNLOAD] %NODE_URL_OFFICIAL%
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri '%NODE_URL_OFFICIAL%' -OutFile '%NODE_ZIP%'"
  if errorlevel 1 goto FAILED
)

echo [INFO] Extracting Node ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Expand-Archive -Force '%NODE_ZIP%' '%RUNTIME_DIR%'"
if not exist "%NODE_DIR%\node.exe" (
  echo [ERROR] Portable Node extraction failed.
  goto FAILED
)
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_CMD=%NODE_DIR%\npm.cmd"
set "PATH=%NODE_DIR%;%NODE_DIR%\node_modules\npm\bin;%PATH%"
"%NODE_EXE%" -v

:NODE_READY
echo.
echo [2/5] Preparing config ...
if not exist "config" mkdir "config"
if not exist "config\app.json" (
  "%NODE_EXE%" scripts\init-config.js
  if errorlevel 1 goto FAILED
) else (
  echo [OK] config\app.json exists.
)

echo.
echo [3/5] npm registry: %NPM_REGISTRY%
call "%NPM_CMD%" config set registry "%NPM_REGISTRY%"
if errorlevel 1 goto FAILED
call "%NPM_CMD%" config set fund false >nul 2>nul
call "%NPM_CMD%" config set audit false >nul 2>nul

if "%RESET_DEPS%"=="1" (
  echo.
  echo [RESET] Removing node_modules and package-lock.json ...
  if exist "node_modules" rmdir /s /q "node_modules"
  if exist "package-lock.json" del /f /q "package-lock.json"
)

echo.
echo [4/5] Checking runtime dependencies and bundled plugins ...
if not exist "node_modules" (
  echo [INFO] Installing runtime dependencies and bundled plugins. First run may take several minutes.
  call "%NPM_CMD%" install --omit=dev --include=optional --legacy-peer-deps --no-audit --no-fund --registry "%NPM_REGISTRY%"
  if errorlevel 1 goto FAILED
) else (
  echo [OK] node_modules exists.
)
"%NODE_EXE%" scripts\check-runtime-deps.js
if errorlevel 1 (
  echo [INFO] Runtime dependency or bundled plugin check failed. Repairing dependencies ...
  call "%NPM_CMD%" install --omit=dev --include=optional --legacy-peer-deps --no-audit --no-fund --registry "%NPM_REGISTRY%"
  if errorlevel 1 goto FAILED
  "%NODE_EXE%" scripts\check-runtime-deps.js
  if errorlevel 1 goto FAILED
)

echo.
echo [5/5] Checking prebuilt web UI and starting server ...
if not exist "client\dist\index.html" (
  echo [ERROR] client\dist\index.html is missing. Please unzip the official release package again.
  goto FAILED
)
for /f "delims=" %%u in ('"%NODE_EXE%" scripts\print-url.js') do set "ACCESS_URL=%%u"
echo.
echo Access URL:
echo %ACCESS_URL%
echo.
echo Login information:
"%NODE_EXE%" scripts\print-access.js
if defined ACCESS_URL start "" "%ACCESS_URL%"
echo.
echo [START] Server is running. Close this window to stop it.
echo.
call "%NPM_CMD%" start
if errorlevel 1 goto FAILED
exit /b 0

:CLEAN_RUNTIME
echo [CLEAN] Removing .runtime portable Node ...
if exist ".runtime" rmdir /s /q ".runtime"
echo [OK] Done.
pause
exit /b 0

:FAILED
echo.
echo [ERROR] Startup failed. Please send this full window log.
pause
exit /b 1
