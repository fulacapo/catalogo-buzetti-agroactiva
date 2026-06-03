@echo off
title Catalogo Interactivo Buzetti
chcp 65001 >/dev/null
cd /d "%~dp0app"

echo ============================================================
echo    CATALOGO INTERACTIVO - AUTOPARTES JULIO O. BUZETTI S.A.
echo ============================================================
echo.
echo  Iniciando... no cierre esta ventana mientras usa el catalogo.
echo.

REM --- 0) Cerrar procesos previos para evitar conflictos de puerto 3000 ---
echo  Limpiando procesos anteriores...
taskkill /F /IM node.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a >nul 2>&1

REM --- 1) Levantar el servidor local (ventana minimizada aparte) ---
start "Servidor Catalogo" /min "%~dp0app\node\node.exe" "%~dp0app\server.cjs"

REM --- 2) Esperar a que el servidor este listo (aprox 3 seg) ---
ping 127.0.0.1 -n 4 >/dev/null

REM --- 3) Buscar Google Chrome ---
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

REM --- 4) Abrir en pantalla completa con la camara ya autorizada ---
if defined CHROME (
  start "" "%CHROME%" --kiosk --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required --ignore-gpu-blocklist --ignore-gpu-blacklist --enable-gpu-rasterization --enable-zero-copy --disable-gpu-sandbox --disk-cache-size=1 --media-cache-size=1 --user-data-dir="%~dp0chrome-perfil" "http://localhost:3000"
) else (
  echo  No se encontro Google Chrome. Abriendo navegador por defecto...
  echo  IMPORTANTE: para gestos se recomienda Google Chrome.
  start "" "http://localhost:3000"
)

exit
