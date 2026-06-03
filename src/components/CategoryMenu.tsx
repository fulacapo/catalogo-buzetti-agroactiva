import { useEffect, useRef, useState } from 'react';
import { cn, pointInEl } from '../lib/utils';
import { Droplets, Filter, Cog, Gauge, ArrowRight } from 'lucide-react';

export interface Category {
  name: string;
  count: number;
  image: string | null;
}

interface CategoryMenuProps {
  categories: Category[];
  handPos: { x: number; y: number } | null;
  /** Increments on every PINCH — used to "click" the hovered card. */
  pinchCount: number;
  onSelect: (name: string) => void;
  visible: boolean;
}

// Pick a representative icon from the category name.
function iconFor(name: string) {
  const n = name.toLowerCase();
  if (n.includes('filtro')) return Filter;
  if (n.includes('cebador')) return Gauge;
  if (n.includes('bomba')) return Droplets;
  return Cog;
}

export function CategoryMenu({ categories, handPos, pinchCount, onSelect, visible }: CategoryMenuProps) {
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);

  // Map the (mirrored) hand position to whichever card it sits over.
  useEffect(() => {
    if (!visible || !handPos) {
      setHovered(null);
      return;
    }
    const px = (1 - handPos.x) * window.innerWidth;
    const py = handPos.y * window.innerHeight;

    let found: number | null = null;
    cardRefs.current.forEach((el, i) => {
      if (pointInEl(el, px, py)) found = i;
    });
    setHovered(found);
  }, [handPos, visible]);

  // A pinch selects the currently hovered card.
  const lastPinch = useRef(pinchCount);
  useEffect(() => {
    if (pinchCount === lastPinch.current) return;
    lastPinch.current = pinchCount;
    if (visible && hovered !== null && categories[hovered]) {
      onSelect(categories[hovered].name);
    }
  }, [pinchCount, visible, hovered, categories, onSelect]);

  return (
    <div className={cn(
      'absolute inset-0 z-30 flex flex-col items-center justify-center px-10 py-24 transition-all duration-500',
      // Solid opaque backdrop — critical for outdoor/sunlight readability so the
      // 3D carousel never bleeds through the text.
      'bg-[#05080d]/97',
      visible ? 'opacity-100' : 'opacity-0 pointer-events-none scale-[0.98]'
    )}>
      <div className="text-center mb-7 shrink-0">
        <p className="text-sm font-mono uppercase tracking-[0.35em] text-cyan-300 mb-2 font-bold">Índice del Catálogo</p>
        <h2 className="text-5xl font-display font-extrabold text-white tracking-tight drop-shadow-lg">
          Elija una <span className="text-cyan-300">categoría</span>
        </h2>
        <p className="text-base text-slate-200 mt-3 font-mono font-semibold">
          Apunte con la mano y pellizque · o use el teclado
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-5xl overflow-y-auto scrollbar-hide">
        {categories.map((cat, i) => {
          const Icon = iconFor(cat.name);
          const isHover = hovered === i;
          return (
            <button
              key={cat.name}
              ref={(el) => { cardRefs.current[i] = el; }}
              onClick={() => onSelect(cat.name)}
              className={cn(
                'group relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-300 border-2',
                isHover
                  ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_40px_-2px_rgba(0,180,216,0.8)] scale-[1.05]'
                  : 'bg-[#0f2032] border-white/15 hover:border-cyan-400/60'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
                  isHover ? 'bg-[#06121f] text-cyan-300' : 'bg-cyan-400/15 text-cyan-300'
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    'text-base font-display font-extrabold leading-tight truncate',
                    isHover ? 'text-[#06121f]' : 'text-white'
                  )}>{cat.name}</h3>
                  <p className={cn(
                    'text-xs font-mono mt-0.5 uppercase tracking-wider font-bold',
                    isHover ? 'text-[#06121f]/80' : 'text-slate-300'
                  )}>
                    {cat.count} {cat.count === 1 ? 'pieza' : 'piezas'}
                  </p>
                </div>
                <ArrowRight className={cn(
                  'w-5 h-5 shrink-0 transition-all',
                  isHover ? 'text-[#06121f] translate-x-1' : 'text-slate-500'
                )} />
              </div>

              {/* subtle cyan sheen on hover */}
              <div className={cn(
                'absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-cyan-400/10 blur-2xl transition-opacity',
                isHover ? 'opacity-100' : 'opacity-0'
              )} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
