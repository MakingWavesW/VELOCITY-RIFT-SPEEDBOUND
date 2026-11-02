@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title VELOCITY RIFT - SPEEDBOUND - Launcher
color 0B

echo.
echo ===============================================================
echo   VELOCITY RIFT: SPEEDBOUND - Windows Game Launcher
echo   Multiplayer + Smooth Movement + 77 Trails
echo ===============================================================
echo.

if not exist "package.json" (
  echo ERROR: package.json not found. Please extract the entire GitHub ZIP first.
  goto :error
)
where node.exe >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not on PATH.
  echo Install Node.js 22.12 or newer from https://nodejs.org/
  echo Then CLOSE this window and launch the game again.
  goto :error
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found. Repair or reinstall Node.js.
  goto :error
)
node -e "const v=process.versions.node.split('.').map(Number); process.exit(v[0]>22||(v[0]===22&&v[1]>=12)?0:1)"
if errorlevel 1 (
  echo ERROR: Node.js 22.12 or newer is required.
  node --version
  echo Get the current LTS version from https://nodejs.org/
  goto :error
)

echo Node version:
node --version

if not exist "node_modules\.bin\vite.cmd" goto :install
if not exist "node_modules\.bin\tsx.cmd" goto :install
goto :start

:install
echo.
echo Installing game dependencies with npm ci...
echo This requires internet access on first launch.
call npm ci
if errorlevel 1 (
  echo ERROR: Dependency installation failed. Read the errors above.
  goto :error
)

:start
echo.
echo Starting the multiplayer backend on port 2567...
start "Velocity Rift - Multiplayer Server" /D "%CD%" cmd /k npm run server
if errorlevel 1 goto :error

echo Starting the browser game on port 5173...
start "Velocity Rift - Browser Game" /D "%CD%" cmd /k npm run dev -- --port 5173 --strictPort
if errorlevel 1 goto :error

echo.
echo Checking that both game services are responding...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; for($i=0;$i -lt 50;$i++){ try { $a=Invoke-WebRequest -Uri 'http://127.0.0.1:2567/health' -UseBasicParsing -TimeoutSec 2; $b=Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 2; if($a.StatusCode -eq 200 -and $b.StatusCode -eq 200){$ok=$true;break} }catch{}; Start-Sleep -Seconds 1 }; if($ok){exit 0}else{exit 1}"
if errorlevel 1 (
  echo.
  echo The game did not answer on both local ports.
  echo Look for errors in the two new terminal windows.
  echo Check if another app uses ports 2567 or 5173.
  echo You can try http://127.0.0.1:5173/ manually.
  goto :error
)

echo.
echo SUCCESS: Opening VELOCITY RIFT in your browser!
echo Open the same address in another tab to test multiplayer.
echo Keep both server windows open while playing.
start "" "http://127.0.0.1:5173/"
echo.
echo You may close this launcher window now. Keep the other two open.
pause >nul
exit /b 0

:error
echo.
echo Startup was not completed. This window will stay open for diagnosis.
pause
exit /b 1
