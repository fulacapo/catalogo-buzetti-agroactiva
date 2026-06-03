import { cn } from '../lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Carrusel de productos en HTML/CSS (sin WebGL/Three.js).
// Motivo: en la PC del stand (Windows 7 + Intel HD viejo) Chrome suele tener la
// aceleración por GPU deshabilitada, y las texturas de WebGL no cargan. Con <img>
// normales las imágenes cargan siempre. Mantiene el look "showroom oscuro".
//
// Totalmente usable con mouse/touch: tocar una pieza al costado la trae al centro;
// tocar la pieza activa abre/cierra su ficha.
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  products: any[];
  activeIndex: number;
  /** Atenúa todo el carrusel (cuando hay un menú encima). */
  dimmed?: boolean;
  /** Clic en una tarjeta del costado → traerla al centro. */
  onSelect?: (index: number) => void;
  /** Clic en la tarjeta activa → abrir/cerrar la ficha. */
  onOpenActive?: () => void;
}

export function CarouselDOM({ products, activeIndex, dimmed = false, onSelect, onOpenActive }: Props) {
  // Sólo renderizar una ventana alrededor de la activa (rendimiento).
  const WINDOW = 3;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {/* Resplandor central detrás de la tarjeta activa */}
      <div
        className={cn(
          'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/15 blur-[120px] transition-opacity duration-500',
          dimmed ? 'opacity-0' : 'opacity-100'
        )}
        style={{ width: '46vw', height: '60vh' }}
      />

      <div className="absolute inset-0 flex items-center justify-center">
        {products.map((product, index) => {
          const offset = index - activeIndex;
          if (Math.abs(offset) > WINDOW) return null;
          const isActive = offset === 0;

          // posición/escala tipo "coverflow"
          const spacing = 30; // vw entre tarjetas
          const tx = offset * spacing;
          const scale = isActive ? 1 : 0.78;
          const cardOpacity = dimmed ? 0.25 : Math.abs(offset) >= 3 ? 0 : isActive ? 1 : 0.5;

          return (
            <button
              key={product.codigo ?? index}
              onClick={() => {
                if (dimmed) return;
                if (isActive) onOpenActive?.();
                else onSelect?.(index);
              }}
              className="absolute transition-all duration-500 ease-out will-change-transform cursor-pointer focus:outline-none"
              style={{
                transform: `translateX(${tx}vw) scale(${scale})`,
                opacity: cardOpacity,
                zIndex: 100 - Math.abs(offset),
                pointerEvents: dimmed || Math.abs(offset) > WINDOW ? 'none' : 'auto',
              }}
            >
              <Card product={product} isActive={isActive && !dimmed} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Card({ product, isActive }: { product: any; isActive: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-3xl border-2 overflow-hidden shadow-2xl transition-all duration-500 text-left',
        'bg-[#142438]',
        isActive
          ? 'border-cyan-300 shadow-[0_0_70px_-10px_rgba(0,180,216,0.8)]'
          : 'border-white/10'
      )}
      style={{ width: 'min(34vw, 460px)', height: 'min(72vh, 760px)' }}
    >
      {/* Marco de imagen (vitrina) */}
      <div className="flex-1 m-4 mb-2 rounded-2xl bg-[#eef4fa] flex items-center justify-center overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.descripcion || product.codigo}
            className="w-full h-full object-contain"
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="w-16 h-16 rounded-full border-2 border-slate-300" />
            <span className="text-sm font-mono">Sin imagen</span>
          </div>
        )}
      </div>

      {/* Texto */}
      <div className="px-5 pb-5 pt-1 text-center shrink-0">
        <h3 className="text-3xl font-display font-extrabold text-white leading-tight">
          Ref. {product.codigo}
        </h3>
        <p className="text-base font-mono font-bold text-cyan-300 mt-1 uppercase tracking-wide truncate">
          {product.categoria || product.linea || 'Repuesto'}
        </p>
        <p className="text-base text-slate-100 font-medium mt-1.5 leading-snug line-clamp-2">
          {product.descripcion}
        </p>
        {isActive && (
          <p className="text-sm font-mono font-bold text-cyan-400 mt-3">
            TOCÁ PARA VER LA FICHA
          </p>
        )}
      </div>
    </div>
  );
}
