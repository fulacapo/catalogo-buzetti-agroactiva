@echo off
title Cerrar Catalogo
echo Cerrando el catalogo y el servidor...
taskkill /F /IM node.exe >/dev/null 2>&1
taskkill /F /IM chrome.exe >/dev/null 2>&1
echo Listo.
ping 127.0.0.1 -n 2 >/dev/null
exit
