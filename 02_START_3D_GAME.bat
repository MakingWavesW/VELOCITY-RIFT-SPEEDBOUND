@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title VELOCITY RIFT - 3D Game

echo ===================================================
echo        VELOCITY RIFT: SPEEDBOUND - 3D GAME
echo ===================================================
echo.
echo Please start 01_START_MULTIPLAYER_SERVER.bat first.
echo Keep BOTH windows open while playing.
echo.

where node.exe >nul 2>&1
if errorlevel 1 goto NO_NODE
where npm.cmd >nul 2>&1
if errorlevel 1 goto NO_NODE
for /f %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR goto NO_NODE
if %NODE_MAJOR% LSS 24 goto OLD_NODE

if not exist "node_modules\.bin\vite.cmd" (
  echo First launch: installing required Node packages...
  echo This needs internet ONCE; game source and media
  echo are already included.
  call npm ci
  if errorlevel 1 goto INSTALL_FAILED
)
echo Opening http://localhost:5173/
echo If the page opens early, refresh it when Vite says ready.
echo.
start "" "http://localhost:5173/"
call npm run dev
echo.
echo The 3D game frontend stopped.
pause
exit /b 0

:NO_NODE
echo ERROR: Node.js 24 or newer and npm are required.
echo Install Node.js 24 LTS from https://nodejs.org/
pause
exit /b 1

:OLD_NODE
echo ERROR: Node.js %NODE_MAJOR% detected. This version needs Node 24+.
pause
exit /b 1

:INSTALL_FAILED
echo ERROR: npm ci failed. Check your internet connection
echo and run this script again.
pause
exit /b 1