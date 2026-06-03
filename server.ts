import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import db from './src/data/db.json';

dotenv.config();

const app = express();
let PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use('/images', express.static(path.join(process.cwd(), 'public', 'images')));

// Initialize Gemini Client Lazy to avoid startup crashes if key is missing
let ai: GoogleGenAI | null = null;
function getAI() {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY NOT SET - Enrich feature will return placeholders.");
      return null;
    }
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

// API Route to fetch enriched data via Gemini + Google Search
app.post('/api/enrich', async (req, res) => {
  try {
    const { productName, code } = req.body;
    if (!productName) {
      return res.status(400).json({ error: 'Product name required' });
    }

    const aiClient = getAI();
    if (!aiClient) {
      return res.json({ 
        info: "Información adicional no disponible. Configure la API Key de Gemini para activar la búsqueda en vivo.",
        sources: [] 
      });
    }

    // Proactive debugging: Ensure we catch API errors gracefully.
    const prompt = `Busca información técnica real en internet sobre el siguiente repuesto de inyección diesel: "${productName}" (Código de referencia: ${code || 'N/A'}).
Responde con un párrafo conciso (máximo 3 oraciones) describiendo su función principal en motores y en qué contextos es crítico su mantenimiento. 
No repitas que es un repuesto, ve directo a lo técnico.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }], // Enable grounding via Google Search
        temperature: 0.3,
      }
    });

    const text = response.text || "No se encontró información técnica detallada.";
    
    // Extract search chunks/uris if available (metadata mapping depends on exact SDK response structure, keeping it safe)
    res.json({ info: text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    let errorMessage = "Error de conexión al buscar información adicional.";
    if (error.status === 429 || (error.message && error.message.includes("429")) || (error.message && error.message.includes("quota"))) {
      errorMessage = "La API de Inteligencia Artificial está saturada en este momento (Límite de cuota excedido). La búsqueda dinámica se reactivará pronto.";
    }
    // Return graceful fallback info instead of 500 so UI displays it nicely
    res.status(200).json({ info: errorMessage });
  }
});

// Helper to read PNG dimensions from IHDR chunk (extremely fast, zero-dependency)
function getPngDimensions(filePath: string): { width: number; height: number } | null {
  try {
    const buffer = fs.readFileSync(filePath);
    // Verify PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504E47 && buffer.readUInt32BE(4) === 0x0D0A1A0A) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }
  } catch (err) {
    console.error("Error reading image dimensions:", err);
  }
  return null;
}

// API Route to fetch product catalog (diesel injection - Buzetti)
app.get('/api/products', (req, res) => {
  const imagesDir = path.join(process.cwd(), 'public', 'images');
  let availableImages: string[] = [];
  try {
    if (fs.existsSync(imagesDir)) {
      availableImages = fs.readdirSync(imagesDir);
    }
  } catch (err) {
    console.error("Error reading images directory:", err);
  }

  let currentDb: any = db;
  try {
    const dbPath = path.join(process.cwd(), 'src', 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      currentDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
  } catch (err) {
    console.error("Error reading db.json dynamically:", err);
  }

  const productArray = Object.values(currentDb.productos).map((product: any) => {
    const toCanonical = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const productCanon = toCanonical(product.codigo || '');
    const matchedFile = availableImages.find(file => {
      const ext = path.extname(file);
      const baseName = path.basename(file, ext).toLowerCase();
      const fileCanon = toCanonical(baseName);
      if (fileCanon === productCanon) return true;
      const codeLower = (product.codigo || '').toLowerCase();
      if (baseName.startsWith(codeLower)) {
        const nextChar = baseName.slice(codeLower.length)[0];
        if (!nextChar || /[^a-z0-9]/.test(nextChar)) return true;
      }
      return false;
    });
    let width = 864, height = 1238;
    if (matchedFile) {
      const dims = getPngDimensions(path.join(imagesDir, matchedFile));
      if (dims) { width = dims.width; height = dims.height; }
    }
    return { ...product, imageUrl: matchedFile ? `/images/${matchedFile}` : null, imageWidth: width, imageHeight: height };
  });

  res.json({ metadata: currentDb.metadata, products: productArray });
});

// API Route to fetch JOBUZETTI catalog (bodywork hardware - manufactured by Buzetti)
app.get('/api/jobuzetti', (req, res) => {
  const imagesDir = path.join(process.cwd(), 'public', 'images', 'jobuzetti');

  let jbDb: any = null;
  try {
    const dbPath = path.join(process.cwd(), 'src', 'data', 'db_jobuzetti.json');
    if (fs.existsSync(dbPath)) {
      jbDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
  } catch (err) {
    console.error("Error reading db_jobuzetti.json:", err);
    return res.status(500).json({ error: 'Failed to load JOBUZETTI catalog' });
  }

  if (!jbDb) return res.status(404).json({ error: 'JOBUZETTI catalog not found' });

  let availableImages: string[] = [];
  try {
    if (fs.existsSync(imagesDir)) availableImages = fs.readdirSync(imagesDir);
  } catch {}

  const productArray = Object.values(jbDb.productos).map((product: any) => {
    // Products from db_jobuzetti already have imageUrl set during build — just verify the file exists.
    let imageUrl = product.imageUrl || null;
    if (imageUrl) {
      const fname = path.basename(imageUrl);
      if (!availableImages.includes(fname)) imageUrl = null;
    }

    let width = 800, height = 800;
    if (imageUrl) {
      const filePath = path.join(imagesDir, path.basename(imageUrl));
      const dims = getPngDimensions(filePath);
      if (dims) { width = dims.width; height = dims.height; }
    }

    return { ...product, imageUrl, imageWidth: width, imageHeight: height };
  });

  // Only expose products that have a real image — no placeholders in the booth.
  const withImages = productArray.filter((p: any) => p.imageUrl !== null);
  res.json({ metadata: jbDb.metadata, products: withImages });
});

app.get('/api/abfrenos', (req, res) => {
  const imagesDir = path.join(process.cwd(), 'public', 'images', 'abfrenos');

  let abDb: any = null;
  try {
    const dbPath = path.join(process.cwd(), 'src', 'data', 'db_abfrenos.json');
    if (fs.existsSync(dbPath)) abDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (err) {
    console.error("Error reading db_abfrenos.json:", err);
    return res.status(500).json({ error: 'Failed to load A.B. Frenos catalog' });
  }

  if (!abDb) return res.status(404).json({ error: 'A.B. Frenos catalog not found' });

  let availableImages: string[] = [];
  try {
    if (fs.existsSync(imagesDir)) availableImages = fs.readdirSync(imagesDir);
  } catch {}

  const productArray = Object.values(abDb.productos).map((product: any) => {
    let imageUrl = product.imageUrl || null;
    if (imageUrl && !availableImages.includes(path.basename(imageUrl))) imageUrl = null;

    // Keep declared dimensions from the JSON (images are JPG; the PNG reader
    // can't measure them). Fall back to PNG dims only if a PNG happens to exist.
    let width = product.imageWidth || 1000, height = product.imageHeight || 1000;
    if (imageUrl) {
      const dims = getPngDimensions(path.join(imagesDir, path.basename(imageUrl)));
      if (dims) { width = dims.width; height = dims.height; }
    }

    return { ...product, imageUrl, imageWidth: width, imageHeight: height };
  });

  const withImages = productArray.filter((p: any) => p.imageUrl !== null);
  res.json({ metadata: abDb.metadata, products: withImages });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`Port ${PORT} is in use, trying ${PORT + 1}...`);
      PORT++;
      server.listen(PORT, '0.0.0.0');
    } else {
      console.error(e);
    }
  });
}

startServer();
