@echo off
title Cliente Catalogo - Conectar a Servidor Mac
chcp 65001 >/dev/null

echo ============================================================
2:   CATALOGO INTERACTIVO - MODO CLIENTE (RED LOCAL)
3:   Autopartes Julio O. Buzetti S.A. - AgroActiva 2026
4: ============================================================
echo.
echo  Este script conecta esta PC al servidor que corre en la Mac.
echo  Asegúrese de estar en la misma red local (Wi-Fi o cable).
echo.

REM --- 1) Solicitar la IP de la Mac ---
:ask_ip
set "MAC_IP="
set /p MAC_IP= Ingrese la dirección IP de la Mac (ej. 192.168.1.50): 
if "%MAC_IP%"=="" (
    echo.
    echo  [!] Debe ingresar una dirección IP válida.
    goto ask_ip
)

echo.
echo  Conectando a http://%MAC_IP%:3000 ...
echo.

REM --- 2) Buscar Google Chrome ---
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

REM --- 3) Iniciar Chrome con perfil aislado y flags de seguridad omitidos ---
if defined CHROME (
  start "" "%CHROME%" ^
    --kiosk ^
    --use-fake-ui-for-media-stream ^
    --autoplay-policy=no-user-gesture-required ^
    --ignore-gpu-blocklist ^
    --ignore-gpu-blacklist ^
    --enable-gpu-rasterization ^
    --enable-zero-copy ^
    --disable-gpu-sandbox ^
    --disk-cache-size=1 ^
    --media-cache-size=1 ^
    --user-data-dir="%~dp0chrome-perfil-cliente" ^
    --unsafely-treat-insecure-origin-as-secure="http://%MAC_IP%:3000" ^
    "http://%MAC_IP%:3000"
) else (
  echo  [Error] No se encontró Google Chrome instalado en esta PC.
  echo  Instale Chrome e intente nuevamente.
  pause
)

exit
