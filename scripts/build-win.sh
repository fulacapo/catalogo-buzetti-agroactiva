#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Empaqueta el catálogo como carpeta portable para Windows 7 (64 bits).
# Resultado: dist-win/Catalogo-Buzetti/  (doble clic en INICIAR_CATALOGO.bat)
#
# Uso:  bash scripts/build-win.sh
# Requiere: node/npm (para vite+esbuild) y conexión sólo la 1ª vez (baja node.exe).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

NODE_WIN_VER="13.14.0"   # última versión de Node compatible con Windows 7
ROOT="dist-win/Catalogo-Buzetti"

echo "==> 1/5  Compilando front (Vite)..."
./node_modules/.bin/vite build

echo "==> 2/5  Bundleando servidor autónomo (esbuild)..."
./node_modules/.bin/esbuild prod/server.ts \
  --bundle --platform=node --format=cjs --target=node12 --minify \
  --outfile=/tmp/server.cjs

echo "==> 3/5  Armando estructura de carpetas..."
rm -rf dist-win
mkdir -p "$ROOT/app/web" "$ROOT/app/data" "$ROOT/app/node"
cp /tmp/server.cjs "$ROOT/app/server.cjs"
rsync -a --exclude 'images_backup' dist/ "$ROOT/app/web/"
cp src/data/db.json src/data/db_jobuzetti.json src/data/db_abfrenos.json "$ROOT/app/data/"

echo "==> 4/5  Descargando Node $NODE_WIN_VER para Windows (x64)..."
if [ ! -f "/tmp/node-win-$NODE_WIN_VER.exe" ]; then
  curl -sL -o /tmp/node-win.zip "https://nodejs.org/dist/v$NODE_WIN_VER/node-v$NODE_WIN_VER-win-x64.zip"
  unzip -o -q /tmp/node-win.zip "node-v$NODE_WIN_VER-win-x64/node.exe" -d /tmp/nodeunzip
  cp "/tmp/nodeunzip/node-v$NODE_WIN_VER-win-x64/node.exe" "/tmp/node-win-$NODE_WIN_VER.exe"
fi
cp "/tmp/node-win-$NODE_WIN_VER.exe" "$ROOT/app/node/node.exe"

echo "==> 5/5  Copiando lanzadores (.bat) e instructivo..."
cp scripts/win/INICIAR_CATALOGO.bat "$ROOT/INICIAR_CATALOGO.bat"
cp scripts/win/CERRAR_CATALOGO.bat  "$ROOT/CERRAR_CATALOGO.bat"
cp scripts/win/LEEME.txt            "$ROOT/LEEME.txt"

echo "==> Comprimiendo ZIP..."
( cd dist-win && zip -qr "Catalogo-Buzetti-Win.zip" "Catalogo-Buzetti" )

echo "LISTO -> dist-win/Catalogo-Buzetti-Win.zip"
