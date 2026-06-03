import { useEffect, useRef, useState } from 'react';
import { cn, pointInEl, HIT_PAD } from '../lib/utils';
import { X, Plus, Hand } from 'lucide-react';
import type { GestureType } from '../hooks/useHandTracking';

// ─────────────────────────────────────────────────────────────────────────────
// Explorador interactivo del combo guardabarros + soporte (estilo "HUD Stark").
// Apuntás a un punto caliente (omegas / caño / guardabarros) y al pellizcar se
// hace zoom holográfico a esa parte con su descripción.
//
// Las posiciones de los hotspots son % relativos a la imagen (combo-hero.jpg).
// Ajustables a mano si hiciera falta afinar la puntería.
// ─────────────────────────────────────────────────────────────────────────────
const HERO = '/images/featured/combo-hero.jpg';

interface Hotspot {
  label: string;
  fab: string;        // quién lo fabrica
  desc: string;
  x: number;          // % horizontal sobre la imagen
  y: number;          // % vertical sobre la imagen
  zoom: number;       // factor de acercamiento
  installationImage?: string;
  installationLabel?: string;
}

const HOTSPOTS: Hotspot[] = [
  {
    label: 'Caño del soporte',
    fab: 'JOBUZETTI',
    desc: 'Caño estructural que cruza el guardabarros de lado a lado y lo vincula al chasis del acoplado.',
    x: 46, y: 23, zoom: 2.6,
    installationImage: '/images/featured/combo-instalado-3.jpg',
    installationLabel: 'Caño instalado en el camión'
  },
  {
    label: 'Omegas',
    fab: 'JOBUZETTI',
    desc: 'Abrazaderas en forma de omega que sujetan el caño al guardabarros con tornillería pasante.',
    x: 24, y: 27, zoom: 3.0,
    installationImage: '/images/featured/combo-instalado-2.jpg',
    installationLabel: 'Base sujeta al chasis'
  },
  {
    label: 'Guardabarros',
    fab: 'CLIMATIC',
    desc: 'Cuerpo plástico de alto impacto, resistente a la intemperie y a los golpes del camino.',
    x: 40, y: 46, zoom: 2.0,
    installationImage: '/images/featured/combo-instalado-1.jpg',
    installationLabel: 'Conjunto completo instalado'
  },
];

interface Props {
  visible: boolean;
  handPos: { x: number; y: number } | null;
  pinchCount: number;
  gesture: GestureType;
  onClose: () => void;
}

export function FeaturedExplorer({ visible, handPos, pinchCount, gesture, onClose }: Props) {
  const [zoom, setZoom] = useState<number | null>(null);   // hotspot activo (zoom)
  const [hovered, setHovered] = useState<number | null>(null);
  const [closeHover, setCloseHover] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const hotspotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const hoveredRef = useRef<number | null>(null);
  const closeHoverRef = useRef(false);
  const zoomRef = useRef<number | null>(null);
  zoomRef.current = zoom;

  // Reset al abrir/cerrar
  useEffect(() => {
    if (!visible) {
      setZoom(null);
      setHovered(null);
      setExpandedImage(null);
    }
  }, [visible]);

  // Hover por posición de mano (espejada)
  useEffect(() => {
    if (!visible || !handPos) {
      setHovered(null); hoveredRef.current = null;
      setCloseHover(false); closeHoverRef.current = false;
      return;
    }
    const px = (1 - handPos.x) * window.innerWidth;
    const py = handPos.y * window.innerHeight;

    const c = pointInEl(closeRef.current, px, py);
    setCloseHover(c); closeHoverRef.current = c;

    if (zoomRef.current === null && !c) {
      // Como los hotspots son chicos y con tolerancia se solapan, elegimos el
      // más cercano al centro entre los que caen dentro del área ampliada.
      let found: number | null = null;
      let best = Infinity;
      hotspotRefs.current.forEach((el, i) => {
        if (!pointInEl(el, px, py, HIT_PAD + 15)) return;
        const r = el!.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const d = (px - cx) ** 2 + (py - cy) ** 2;
        if (d < best) { best = d; found = i; }
      });
      setHovered(found); hoveredRef.current = found;
    } else {
      setHovered(null); hoveredRef.current = null;
    }
  }, [handPos, visible]);

  // Pellizco: entra/sale del zoom o cierra
  const lastPinch = useRef(pinchCount);
  useEffect(() => {
    if (pinchCount === lastPinch.current) return;
    lastPinch.current = pinchCount;
    if (!visible) return;
    if (closeHoverRef.current) { onClose(); return; }
    if (zoomRef.current !== null) { setZoom(null); return; }      // alejar
    if (hoveredRef.current !== null) setZoom(hoveredRef.current);  // acercar
  }, [pinchCount, visible, onClose]);

  // Abrir la mano: aleja si está en zoom o cierra la imagen expandida
  useEffect(() => {
    if (visible && gesture === 'OPEN_HAND') {
      if (expandedImage) {
        setExpandedImage(null);
      } else if (zoomRef.current !== null) {
        setZoom(null);
      }
    }
  }, [gesture, visible, expandedImage]);

  // Teclado fallback: 1/2/3 acerca, 0/Esc aleja
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= HOTSPOTS.length) setZoom(n - 1);
      else if (e.key === '0') setZoom(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  const active = zoom !== null ? HOTSPOTS[zoom] : null;

  return (
    <div className={cn(
      'absolute inset-0 z-50 flex flex-col bg-[#04070c] transition-all duration-300',
      visible ? 'opacity-100' : 'opacity-0 pointer-events-none scale-[0.99]'
    )}>
      {/* rejilla holográfica de fondo */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'linear-gradient(#00b4d8 1px, transparent 1px), linear-gradient(90deg, #00b4d8 1px, transparent 1px)', backgroundSize: '46px 46px' }} />

      {/* barra superior */}
      <div className="relative flex items-center justify-between px-8 pt-7 pb-3 shrink-0">
        <div className="flex flex-col">
          <span className="text-xs font-mono uppercase tracking-[0.35em] text-cyan-300 font-bold">Exploración interactiva</span>
          <h2 className="text-3xl font-display font-extrabold text-white tracking-tight">Guardabarros + Soporte</h2>
        </div>
        <button
          ref={closeRef}
          onClick={onClose}
          className={cn(
            'flex items-center gap-2 h-12 px-5 rounded-2xl border-2 text-sm font-mono font-bold uppercase tracking-widest transition-all',
            closeHover
              ? 'border-cyan-300 bg-cyan-400/20 text-white scale-105 shadow-[0_0_30px_-4px_rgba(0,180,216,0.8)]'
              : 'border-white/20 bg-white/[0.06] text-slate-200 hover:bg-white/10'
          )}
        >
          <X className="w-5 h-5" /> Volver
        </button>
      </div>

      {/* escenario */}
      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center px-8 pb-8">
        {/* corchetes de esquina HUD */}
        <Corner className="top-0 left-0 border-t-2 border-l-2 rounded-tl-2xl" />
        <Corner className="top-0 right-0 border-t-2 border-r-2 rounded-tr-2xl" />
        <Corner className="bottom-0 left-0 border-b-2 border-l-2 rounded-bl-2xl" />
        <Corner className="bottom-0 right-0 border-b-2 border-r-2 rounded-br-2xl" />

        <div className="w-full h-full flex items-center justify-center gap-8 transition-all duration-500">
          
          {/* COLUMNA IZQUIERDA: Imagen de instalación real */}
          <div 
            onClick={() => active && active.installationImage && setExpandedImage(active.installationImage)}
            className={cn(
              "relative h-full max-h-[72vh] aspect-[4/3] rounded-3xl overflow-hidden border-2 border-cyan-500/40 bg-[#0a1626]/50 shadow-[0_0_40px_-5px_rgba(0,180,216,0.3)] transition-all duration-500 flex items-center justify-center cursor-pointer group",
              active ? "w-[36%] opacity-100 scale-100 translate-x-0" : "w-0 opacity-0 scale-95 -translate-x-8 pointer-events-none"
            )}
          >
            {active && active.installationImage && (
              <>
                <img 
                  src={active.installationImage} 
                  alt={active.installationLabel} 
                  className="w-full h-full object-cover select-none transition-transform duration-500 group-hover:scale-105"
                />
                {/* HUD Overlay en la foto de instalación */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5">
                  <span className="text-xs font-mono uppercase tracking-wider text-cyan-300 font-bold block mb-1">
                    Instalación Real
                  </span>
                  <h4 className="text-lg font-display font-bold text-white flex items-center gap-2">
                    {active.installationLabel}
                    <span className="text-[10px] text-cyan-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity font-normal">
                      (Click para ampliar)
                    </span>
                  </h4>
                </div>
              </>
            )}
          </div>

          {/* COLUMNA CENTRAL: Visor de imagen (con zoom) */}
          <div className={cn(
            "relative h-full max-h-[72vh] transition-all duration-500 flex items-center justify-center overflow-hidden",
            active ? "w-[34%]" : "w-full"
          )}>
            <div
              className="relative transition-transform duration-700 ease-out flex items-center justify-center"
              style={{
                transform: active ? `scale(${active.zoom})` : 'scale(1)',
                transformOrigin: active ? `${active.x}% ${active.y}%` : 'center',
              }}
            >
              <img src={HERO} alt="Combo guardabarros con soporte"
                className="max-h-[72vh] w-auto object-contain select-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]" />

              {/* hotspots (sólo en vista completa) */}
              {HOTSPOTS.map((h, i) => (
                <button
                  key={h.label}
                  ref={(el) => { hotspotRefs.current[i] = el; }}
                  onClick={() => setZoom(i)}
                  style={{ left: `${h.x}%`, top: `${h.y}%` }}
                  className={cn(
                    'absolute -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300',
                    active ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  )}
                >
                  {/* anillo pulsante */}
                  <span className={cn(
                    'absolute -inset-5 rounded-full border-2 animate-ping',
                    hovered === i ? 'border-cyan-300' : 'border-cyan-400/50'
                  )} />
                  <span className={cn(
                    'relative flex items-center justify-center w-11 h-11 rounded-full border-2 backdrop-blur-sm transition-all',
                    hovered === i
                      ? 'border-cyan-300 bg-cyan-400 text-[#04070c] scale-125 shadow-[0_0_30px_-2px_rgba(0,180,216,0.9)]'
                      : 'border-cyan-300/80 bg-[#04070c]/70 text-cyan-200'
                  )}>
                    <Plus className="w-5 h-5" />
                  </span>
                  {/* etiqueta */}
                  <span className={cn(
                    'absolute left-1/2 -translate-x-1/2 top-12 whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase tracking-wider transition-all',
                    hovered === i ? 'bg-cyan-400 text-[#04070c]' : 'bg-[#04070c]/80 text-cyan-200 border border-cyan-400/40'
                  )}>{h.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* COLUMNA DERECHA: Panel HUD de la parte activa */}
          <div className={cn(
            "relative h-full max-h-[72vh] transition-all duration-500 flex items-center justify-center",
            active ? "w-[30%] opacity-100 translate-x-0" : "w-0 opacity-0 translate-x-8 pointer-events-none"
          )}>
            {active && (
              <div className="w-full max-h-full overflow-y-auto rounded-3xl border-2 border-cyan-400/50 bg-[#0a1626]/95 p-6 shadow-[0_0_50px_-10px_rgba(0,180,216,0.6)] flex flex-col gap-4">
                <div className="self-start inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-400 text-[#04070c] text-xs font-mono font-extrabold uppercase tracking-widest">
                  {active.fab}
                </div>
                <h3 className="text-3xl font-display font-extrabold text-white leading-tight">{active.label}</h3>
                <p className="text-lg text-slate-200 font-medium leading-relaxed">{active.desc}</p>
                
                <div className="mt-auto pt-4 border-t border-white/10 flex items-center gap-2 text-sm font-mono text-cyan-300 font-bold">
                  <Hand className="w-4 h-4" /> Abra la mano para alejar
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* pie de ayuda */}
      <div className="relative shrink-0 pb-6 text-center">
        <p className="text-base font-mono text-slate-300 font-semibold">
          {active
            ? 'Pellizque o abra la mano para volver a la vista completa'
            : 'Apunte a un punto y pellizque para acercar · teclas 1 / 2 / 3'}
        </p>
      </div>

      {/* Fullscreen expanded image modal */}
      {expandedImage && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md transition-all duration-300 animate-fadeIn">
          <button 
            onClick={() => setExpandedImage(null)}
            className="absolute top-6 right-6 flex items-center gap-2 h-12 px-5 rounded-2xl border-2 border-white/20 bg-[#0a1626]/90 hover:bg-white/10 text-slate-200 hover:text-white text-sm font-mono font-bold uppercase tracking-widest transition-all cursor-pointer shadow-lg"
          >
            <X className="w-5 h-5" /> Cerrar
          </button>
          
          <div className="relative max-w-[85vw] max-h-[75vh] rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)]">
            <img 
              src={expandedImage} 
              alt="Instalación real ampliada" 
              className="w-auto max-h-[75vh] object-contain select-none"
            />
          </div>
          
          <p className="mt-6 text-sm font-mono text-cyan-300 font-bold flex items-center gap-2">
            <Hand className="w-4 h-4 animate-pulse" /> Abra la mano para cerrar la vista
          </p>
        </div>
      )}
    </div>
  );
}

function Corner({ className }: { className: string }) {
  return <span className={cn('pointer-events-none absolute w-16 h-16 m-6 border-cyan-400/40', className)} />;
}
