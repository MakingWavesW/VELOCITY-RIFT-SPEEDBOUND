@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title VELOCITY RIFT - Multiplayer Server

echo ===================================================
echo       VELOCITY RIFT: SPEEDBOUND - SERVER
echo ===================================================
echo.
echo This window runs the real multiplayer game server.
echo Keep it open while playing.
echo.

where node.exe >nul 2>&1
if errorlevel 1 goto NO_NODE
where npm.cmd >nul 2>&1
if errorlevel 1 goto NO_NODE

for /f %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR goto NO_NODE
if %NODE_MAJOR% LSS 24 goto OLD_NODE

if not exist "node_modules\.bin\tsx.cmd" (
  echo First launch: installing required Node packages...
  echo This needs internet ONCE. The complete game source and media
  echo are already included in this ZIP.
  call npm ci
  if errorlevel 1 goto INSTALL_FAILED
)

if not exist ".data" mkdir ".data"
set "RIFT_PROFILE_DB=%CD%\.data\profiles.sqlite"
set "PORT=2567"

echo Starting server on port %PORT%...
echo Player saves: %RIFT_PROFILE_DB%
echo.
echo Next, open 02_START_3D_GAME.bat in another window.
echo.
call npm run server
echo.
echo The multiplayer server stopped.
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
echo ERROR: npm ci failed. Check your internet connection,
echo then run this script again.
pause
exit /b 1