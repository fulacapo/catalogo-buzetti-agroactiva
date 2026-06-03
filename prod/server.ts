// ─────────────────────────────────────────────────────────────────────────────
// SERVIDOR DE PRODUCCIÓN AUTÓNOMO — Catálogo Interactivo Buzetti
//
// Pensado para empaquetarse en un único archivo (esbuild --bundle, sin
// --packages=external) de modo que NO necesite node_modules. Sólo requiere
// un node.exe (versión compatible con Windows 7) al lado.
//
// Estructura esperada junto a este archivo (server.cjs):
//   server.cjs
//   web/        -> build de Vite (index.html, assets, images, models, mediapipe)
//   data/       -> db.json, db_jobuzetti.json, db_abfrenos.json
//
// 100% offline: no usa internet, ni Vite, ni Gemini.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import path from 'path';
import fs from 'fs';

const PORT = Number(process.env.PORT) || 3000;

// Carpeta base = donde vive este archivo (server.cjs). Robusto sin importar
// desde dónde se ejecute el .bat.
const BASE = __dirname;
const WEB_DIR = path.join(BASE, 'web');
const DATA_DIR = path.join(BASE, 'data');
const IMAGES_DIR = path.join(WEB_DIR, 'images');

const app = express();
app.use(express.json());
app.use('/images', express.static(IMAGES_DIR));

// ── Medición de dimensiones de imagen (PNG y JPEG), sin dependencias ──────────
function getImageDimensions(filePath: string): { width: number; height: number } | null {
  try {
    const buffer = fs.readFileSync(filePath);
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47 && buffer.readUInt32BE(4) === 0x0d0a1a0a) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    // JPEG: empieza con FF D8; recorrer marcadores SOF para sacar tamaño
    if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let off = 2;
      while (off < buffer.length) {
        if (buffer[off] !== 0xff) { off++; continue; }
        const marker = buffer[off + 1];
        // Marcadores SOF (excepto DHT/DAC/RST)
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          const height = buffer.readUInt16BE(off + 5);
          const width = buffer.readUInt16BE(off + 7);
          return { width, height };
        }
        const len = buffer.readUInt16BE(off + 2);
        off += 2 + len;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function readJson(file: string): any | null {
  try {
    const p = path.join(DATA_DIR, file);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    console.error(`Error leyendo ${file}:`, err);
  }
  return null;
}

function listImages(dir: string): string[] {
  try {
    if (fs.existsSync(dir)) return fs.readdirSync(dir);
  } catch {
    /* ignore */
  }
  return [];
}

// ── /api/products — Inyección Diésel (matching por nombre de archivo) ─────────
app.get('/api/products', (_req, res) => {
  const dbDiesel = readJson('db.json');
  if (!dbDiesel) return res.status(404).json({ error: 'Catálogo diésel no encontrado' });

  const availableImages = listImages(IMAGES_DIR);
  const toCanonical = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

  const products = Object.values(dbDiesel.productos).map((product: any) => {
    const productCanon = toCanonical(product.codigo || '');
    const matchedFile = availableImages.find((file) => {
      const ext = path.extname(file);
      const baseName = path.basename(file, ext).toLowerCase();
      if (toCanonical(baseName) === productCanon) return true;
      const codeLower = (product.codigo || '').toLowerCase();
      if (baseName.startsWith(codeLower)) {
        const nextChar = baseName.slice(codeLower.length)[0];
        if (!nextChar || /[^a-z0-9]/.test(nextChar)) return true;
      }
      return false;
    });
    let width = 864, height = 1238;
    if (matchedFile) {
      const dims = getImageDimensions(path.join(IMAGES_DIR, matchedFile));
      if (dims) { width = dims.width; height = dims.height; }
    }
    return { ...product, imageUrl: matchedFile ? `/images/${matchedFile}` : null, imageWidth: width, imageHeight: height };
  });

  res.json({ metadata: dbDiesel.metadata, products });
});

// ── Helper para catálogos con imageUrl explícito (JOBUZETTI y A.B. Frenos) ────
function serveExplicitCatalog(res: express.Response, dbFile: string, subdir: string) {
  const db = readJson(dbFile);
  if (!db) return res.status(404).json({ error: `Catálogo ${dbFile} no encontrado` });

  const dir = path.join(IMAGES_DIR, subdir);
  const available = listImages(dir);

  const products = Object.values(db.productos).map((product: any) => {
    let imageUrl = product.imageUrl || null;
    if (imageUrl && !available.includes(path.basename(imageUrl))) imageUrl = null;

    let width = product.imageWidth || 1000, height = product.imageHeight || 1000;
    if (imageUrl) {
      const dims = getImageDimensions(path.join(dir, path.basename(imageUrl)));
      if (dims) { width = dims.width; height = dims.height; }
    }
    return { ...product, imageUrl, imageWidth: width, imageHeight: height };
  });

  // Sólo piezas con imagen real — nada de placeholders en la feria.
  res.json({ metadata: db.metadata, products: products.filter((p: any) => p.imageUrl !== null) });
}

app.get('/api/jobuzetti', (_req, res) => serveExplicitCatalog(res, 'db_jobuzetti.json', 'jobuzetti'));
app.get('/api/abfrenos', (_req, res) => serveExplicitCatalog(res, 'db_abfrenos.json', 'abfrenos'));

// ── Estáticos del front + fallback SPA ────────────────────────────────────────
app.use(express.static(WEB_DIR));
app.get('*', (_req, res) => res.sendFile(path.join(WEB_DIR, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log('   CATÁLOGO INTERACTIVO BUZETTI — servidor activo');
  console.log(`   Abrí el navegador en:  http://localhost:${PORT}`);
  console.log('   (Para cerrar, cerrá esta ventana negra)');
  console.log('====================================================');
});
