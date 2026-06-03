@echo off
title Catalogo Buzetti - MODO DEBUG
chcp 65001 >/dev/null
cd /d "%~dp0app"

echo ============================================================
echo    MODO DEBUG - se abre la consola (F12) para ver errores
echo    F11 = salir de pantalla completa  |  Alt+F4 = cerrar
echo ============================================================
echo.

taskkill /F /IM node.exe >/dev/null 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a >/dev/null 2>&1

start "Servidor Catalogo" /min "%~dp0app\node\node.exe" "%~dp0app\server.cjs"
ping 127.0.0.1 -n 4 >/dev/null

set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if defined CHROME (
  start "" "%CHROME%" --start-fullscreen --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required --auto-open-devtools-for-tabs --user-data-dir="%~dp0chrome-debug" "http://localhost:3000"
) else (
  start "" "http://localhost:3000"
)
exit
