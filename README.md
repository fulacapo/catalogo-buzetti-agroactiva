# Catálogo Interactivo — Autopartes Julio O. Buzetti S.A.

Catálogo de productos **controlado por gestos** (cámara web) para exponer en ferias
como **Agroactiva**. Pensado para una pantalla grande con una PC; funciona **100%
offline** (no necesita internet).

Incluye 3 catálogos: **JOBUZETTI** (fabricación propia), **Inyección Diésel** y
**A.B. Frenos**, además del combo destacado **Guardabarros + Soporte** con un
explorador interactivo de sus partes.

---

## ▶️ Usarlo en la PC del stand (Windows 7, sin instalar nada)

**No hace falta clonar ni compilar.** Descargá el paquete listo para usar:

1. Andá a la pestaña **[Releases](../../releases)** de este repo.
2. Descargá el archivo **`Catalogo-Buzetti-Win.zip`**.
3. Descomprimilo en la PC (escritorio, por ejemplo).
4. Doble clic en **`INICIAR_CATALOGO.bat`**.
   - Se abre una ventana negra (servidor) — **no la cierres**.
   - A los pocos segundos se abre Chrome en pantalla completa con la cámara lista.
5. Para salir: `Alt + F4` cierra Chrome y `CERRAR_CATALOGO.bat` apaga el servidor.

Requisitos: Google Chrome instalado + una webcam. Nada más. **Sin internet.**

### Controles
- **Gestos:** mover la mano (apuntar), pellizcar (seleccionar / ver ficha),
  abrir la mano (cerrar). Arrastrar de un lado a otro de la pantalla = cambiar pieza.
- **Teclado (respaldo):** `1` / `2` / `3` elegir catálogo · `←` `→` cambiar pieza ·
  `Enter` ficha · `Esc` volver.

---

## 🛠️ Desarrollo (para programar / modificar)

```bash
npm install
npm run dev        # http://localhost:3000  (recarga automática)
```

### Regenerar el ejecutable de Windows
```bash
npm run build:win  # genera dist-win/Catalogo-Buzetti-Win.zip
```
El script compila el front, empaqueta un servidor Node autónomo y arma una carpeta
portable con un Node 13.14 (última versión compatible con Windows 7).

### Stack
- React + Vite + Three.js (carrusel 3D)
- MediaPipe Hand Landmarker (gestos, WASM + modelo locales)
- Express (servidor de catálogo)

Optimizado para hardware modesto (i5 de 5ª gen + GPU integrada): tarjetas 3D
virtualizadas, sin HDRI remoto, fuentes locales, inferencia de gestos a 30 fps.
