import React, { useState, useEffect, Suspense, useRef, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { Scene } from './components/Scene';
import { CategoryMenu, Category } from './components/CategoryMenu';
import { FeaturedExplorer } from './components/FeaturedExplorer';
import { useHandTracking } from './hooks/useHandTracking';
import { cn, pointInEl } from './lib/utils';
import { Hand, ArrowLeftRight, Minimize, ChevronLeft, ChevronRight, Info, LayoutGrid, ArrowLeft, Sparkles, VideoOff } from 'lucide-react';

// Producto estrella: combo guardabarros (Climatic) + soporte con omegas (JOBUZETTI).
// Es lo que físicamente sostiene la pantalla en el stand, así que tiene su propio
// tratamiento destacado con animación e interacción especial.
const FEATURED = {
  hero: '/images/featured/combo-hero.jpg',
  instalado: [
    '/images/featured/combo-instalado-1.jpg',
    '/images/featured/combo-instalado-2.jpg',
    '/images/featured/combo-instalado-3.jpg',
  ],
};

type View = 'brand' | 'menu' | 'catalog';
type Brand = 'jobuzetti' | 'diesel' | 'abfrenos';

function checkWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

export default function App() {
  const [products, setProducts] = useState<any[]>([]);
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    setWebglSupported(checkWebGL());
  }, []);
  const [metadata, setMetadata] = useState<any>(null);
  const [view, setView] = useState<View>('brand');
  const [brand, setBrand] = useState<Brand>('jobuzetti');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [pinchCount, setPinchCount] = useState(0);
  const [showFeatured, setShowFeatured] = useState(false); // overlay del producto estrella
  const lastActivityRef = useRef<number>(Date.now());

  const [cameraEnabled, setCameraEnabled] = useState(true);
  const cursorRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { videoRef, gesture, isInitializing, error, handPos } = useHandTracking(cursorRef, cameraEnabled);

  // Load products whenever the brand changes
  useEffect(() => {
    const endpoint = brand === 'jobuzetti' ? '/api/jobuzetti'
      : brand === 'abfrenos' ? '/api/abfrenos'
      : '/api/products';
    fetch(endpoint)
      .then(r => r.json())
      .then(data => {
        setProducts(data.products || []);
        setMetadata(data.metadata || {});
        setActiveIndex(0);
        setShowDetails(false);
        setSelectedCat(null);
      })
      .catch(err => console.error('Failed to load products:', err));
  }, [brand]);

  // Category index derived from loaded products
  const categories: Category[] = useMemo(() => {
    const map = new Map<string, Category>();
    products.forEach(p => {
      const c = p.categoria || p.linea || 'Otros';
      if (!map.has(c)) map.set(c, { name: c, count: 0, image: p.imageUrl });
      const e = map.get(c)!;
      e.count++;
      if (!e.image && p.imageUrl) e.image = p.imageUrl;
    });
    return [...map.values()];
  }, [products]);

  const displayProducts = useMemo(() => {
    if (view === 'catalog' && selectedCat)
      return products.filter(p => (p.categoria || p.linea) === selectedCat);
    return products;
  }, [view, selectedCat, products]);

  const currentProduct = displayProducts[activeIndex];

  // ----- Navigation handlers -----
  const touch = () => { lastActivityRef.current = Date.now(); };

  const goNext = useCallback(() => {
    touch();
    setIsIdle(false);
    setActiveIndex(prev => Math.min(prev + 1, displayProducts.length - 1));
    setShowDetails(false);
  }, [displayProducts.length]);

  const goPrev = useCallback(() => {
    touch();
    setIsIdle(false);
    setActiveIndex(prev => Math.max(prev - 1, 0));
    setShowDetails(false);
  }, []);

  const openDetails = useCallback(() => { touch(); setShowDetails(true); }, []);
  const closeDetails = useCallback(() => { touch(); setShowDetails(false); }, []);
  const toggleFicha = useCallback(() => { touch(); setIsIdle(false); setShowDetails(s => !s); }, []);

  const selectCategory = useCallback((name: string) => {
    touch();
    setSelectedCat(name);
    setActiveIndex(0);
    setShowDetails(false);
    setView('catalog');
  }, []);

  const goToMenu = useCallback(() => {
    touch();
    setShowDetails(false);
    setActiveIndex(0);
    // A.B. Frenos has no category index — the "menu" button returns to the
    // brand selector instead.
    setView(brand === 'abfrenos' ? 'brand' : 'menu');
  }, [brand]);

  const selectBrand = useCallback((b: Brand) => {
    touch();
    setIsIdle(false);
    setBrand(b);
    // A.B. Frenos has few products — skip the category index and go straight
    // to the carousel showing every piece together.
    setView(b === 'abfrenos' ? 'catalog' : 'menu');
    setActiveIndex(0);
    setShowDetails(false);
    setSelectedCat(null);
  }, []);

  const openFeatured = useCallback(() => { touch(); setIsIdle(false); setShowFeatured(true); }, []);
  const closeFeatured = useCallback(() => { touch(); setShowFeatured(false); }, []);

  // Hand scroll inside spec sheet
  useEffect(() => {
    if (!showDetails || !handPos || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const minRange = 0.25, maxRange = 0.75;
    const factor = (Math.max(minRange, Math.min(maxRange, handPos.y)) - minRange) / (maxRange - minRange);
    const maxScroll = container.scrollHeight - container.clientHeight;
    if (maxScroll > 0) container.scrollTop = factor * maxScroll;
  }, [handPos, showDetails]);

  // Gesture dispatch
  const lastProcessed = useRef('');
  useEffect(() => {
    if (products.length === 0) return;
    if (gesture === lastProcessed.current) return;
    lastProcessed.current = gesture;
    touch();
    if (gesture === 'PINCH') setPinchCount(c => c + 1);
    if (view !== 'catalog') return;
    if (gesture === 'SWIPE_LEFT') goNext();
    else if (gesture === 'SWIPE_RIGHT') goPrev();
    // Only pinch-to-open when the hand is over the card, not a nav button —
    // otherwise the nav-button pinch handler also runs and they conflict.
    else if (gesture === 'PINCH' && !showDetails && navHoveredRef.current === null) openDetails();
    else if (gesture === 'OPEN_HAND' && showDetails) closeDetails();
  }, [gesture, view, showDetails, products.length, goNext, goPrev, openDetails, closeDetails]);

  // Keyboard fallback
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      touch();
      // Con el explorador abierto: Esc/Backspace cierra; las teclas de zoom
      // (1/2/3/0) las maneja el propio FeaturedExplorer.
      if (showFeatured) {
        if (e.key === 'Escape' || e.key === 'Backspace') closeFeatured();
        return;
      }
      if (isIdle) { setIsIdle(false); setView('brand'); return; }
      if (view === 'brand') {
        if (e.key === '1') selectBrand('jobuzetti');
        else if (e.key === '2') selectBrand('diesel');
        else if (e.key === '3') selectBrand('abfrenos');
        else if (e.key === '0' || e.key === 'Enter' || e.key === ' ') openFeatured();
        return;
      }
      if (view === 'menu') {
        const n = parseInt(e.key, 10);
        if (!isNaN(n) && categories[n - 1]) selectCategory(categories[n - 1].name);
        else if (e.key === 'Enter' && categories[0]) selectCategory(categories[0].name);
        else if (e.key === 'Escape' || e.key === 'Backspace') setView('brand');
        return;
      }
      switch (e.key) {
        case 'ArrowRight': goNext(); break;
        case 'ArrowLeft': goPrev(); break;
        case 'Enter': case ' ': openDetails(); break;
        case 'Escape': showDetails ? closeDetails() : goToMenu(); break;
        case 'Backspace': goToMenu(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, showDetails, isIdle, categories, goNext, goPrev, openDetails, closeDetails, selectCategory, selectBrand, goToMenu, showFeatured, openFeatured, closeFeatured]);

  // Hand activity wakes idle screen
  useEffect(() => {
    if (!handPos) return;
    lastActivityRef.current = Date.now();
    if (isIdle) { setIsIdle(false); setView('brand'); setActiveIndex(0); setShowDetails(false); }
  }, [handPos, isIdle]);

  // Go idle after 20s
  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() - lastActivityRef.current > 20000) setIsIdle(true);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Refs siempre actualizados para leer dentro de intervalos sin re-crearlos.
  const productsRef = useRef(products);   productsRef.current = products;
  const activeIndexRef = useRef(activeIndex); activeIndexRef.current = activeIndex;

  // Idle showcase: recorre el catálogo en automático y, al terminar uno, salta
  // al siguiente — así simula la navegación mostrando "un poco de todo".
  useEffect(() => {
    if (!isIdle) return;
    const order: Brand[] = ['jobuzetti', 'diesel', 'abfrenos'];
    const t = setInterval(() => {
      const len = productsRef.current.length;
      if (len === 0) return;
      if (activeIndexRef.current + 1 >= len) {
        // Terminó este catálogo → pasar al siguiente y arrancar de cero.
        activeIndexRef.current = 0;
        setActiveIndex(0);
        setBrand((b) => order[(order.indexOf(b) + 1) % order.length]);
      } else {
        activeIndexRef.current += 1;
        setActiveIndex(activeIndexRef.current);
      }
    }, 3200);
    return () => clearInterval(t);
  }, [isIdle]);

  const progress = displayProducts.length > 0 ? ((activeIndex + 1) / displayProducts.length) * 100 : 0;
  const menuVisible = view === 'menu' && !isIdle;
  const brandVisible = view === 'brand' && !isIdle;

  // Logo del header según la marca/catálogo activo. En el selector de marca se
  // muestra el de Buzetti (la empresa anfitriona del stand).
  const BUZETTI_LOGO = '/images/Photoroom-20240731_095940.png';
  const headerLogo = view !== 'brand' && brand === 'abfrenos'
    ? '/images/abfrenos/logo-abfrenos.jpg'
    : BUZETTI_LOGO;

  const footerLabel = brand === 'jobuzetti' ? 'BISAGRAS Y CIERRES'
    : brand === 'abfrenos' ? 'FRENOS Y AIRE'
    : 'COMPONENTES DIÉSEL';

  // ----- Brand selector: hand hover detection -----
  // Same mechanism as CategoryMenu — track which card the hand is over,
  // then fire selectBrand on a new pinch.
  const brandCardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [brandHovered, setBrandHovered] = useState<number | null>(null);
  const BRANDS: Brand[] = ['jobuzetti', 'diesel', 'abfrenos'];

  useEffect(() => {
    if (!brandVisible || !handPos) { setBrandHovered(null); return; }
    const px = (1 - handPos.x) * window.innerWidth;
    const py = handPos.y * window.innerHeight;
    let found: number | null = null;
    brandCardRefs.current.forEach((el, i) => {
      if (pointInEl(el, px, py)) found = i;
    });
    setBrandHovered(found);
  }, [handPos, brandVisible]);

  // ----- Combo destacado: hero en el selector (abre el explorador) -----
  const heroRef = useRef<HTMLButtonElement | null>(null);
  const heroHoveredRef = useRef(false);
  const [heroHovered, setHeroHovered] = useState(false);

  useEffect(() => {
    if (!brandVisible || showFeatured || !handPos) {
      heroHoveredRef.current = false; setHeroHovered(false);
      return;
    }
    const px = (1 - handPos.x) * window.innerWidth;
    const py = handPos.y * window.innerHeight;
    const h = pointInEl(heroRef.current, px, py);
    heroHoveredRef.current = h; setHeroHovered(h);
  }, [handPos, showFeatured, brandVisible]);

  const lastBrandPinch = useRef(pinchCount);
  useEffect(() => {
    if (pinchCount === lastBrandPinch.current) return;
    lastBrandPinch.current = pinchCount;
    // Mientras el explorador está abierto, él maneja sus propios pinches.
    if (showFeatured) return;
    if (brandVisible && heroHoveredRef.current) { openFeatured(); return; }
    if (brandVisible && brandHovered !== null) selectBrand(BRANDS[brandHovered]);
  }, [pinchCount, brandVisible, brandHovered, selectBrand, showFeatured, openFeatured]);

  // ----- Nav bar buttons: hand hover + pinch-to-click -----
  // Same mechanism as the cards. Catalog bottom-nav has 4 targets (0=menú,
  // 1=anterior, 2=ficha, 3=siguiente); the menu view has 1 (cambiar catálogo).
  const navRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const navHoveredRef = useRef<number | null>(null);   // read synchronously on pinch
  const [navHovered, setNavHovered] = useState<number | null>(null);
  const menuBackRef = useRef<HTMLButtonElement | null>(null);
  const [menuBackHovered, setMenuBackHovered] = useState(false);

  useEffect(() => {
    if (!handPos || isIdle) {
      setNavHovered(null); navHoveredRef.current = null; setMenuBackHovered(false);
      return;
    }
    const px = (1 - handPos.x) * window.innerWidth;
    const py = handPos.y * window.innerHeight;
    const hit = (el: HTMLElement | null) => pointInEl(el, px, py);

    if (view === 'catalog') {
      let found: number | null = null;
      navRefs.current.forEach((el, i) => { if (hit(el)) found = i; });
      setNavHovered(found); navHoveredRef.current = found;
      setMenuBackHovered(false);
    } else if (view === 'menu') {
      setMenuBackHovered(hit(menuBackRef.current));
      setNavHovered(null); navHoveredRef.current = null;
    } else {
      setNavHovered(null); navHoveredRef.current = null; setMenuBackHovered(false);
    }
  }, [handPos, view, isIdle]);

  const lastNavPinch = useRef(pinchCount);
  useEffect(() => {
    if (pinchCount === lastNavPinch.current) return;
    lastNavPinch.current = pinchCount;
    if (view === 'catalog') {
      const idx = navHoveredRef.current;
      if (idx === 0) goToMenu();
      else if (idx === 1) goPrev();
      else if (idx === 2) toggleFicha();
      else if (idx === 3) goNext();
    } else if (view === 'menu' && menuBackHovered) {
      touch(); setView('brand');
    }
  }, [pinchCount, view, menuBackHovered, goToMenu, goPrev, goNext, toggleFicha]);

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans select-none bg-[radial-gradient(ellipse_at_50%_0%,_#16314d_0%,_#0a141f_55%,_#06090e_100%)]">

      {/* Watermark */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
        <img src="/images/Photoroom-20240731_095940.png" alt="" className="w-[60vw] h-auto object-contain invert" />
      </div>

      {/* 3D Canvas or 2D Fallback */}
      <div className="absolute inset-0 z-0">
        {webglSupported ? (
          <Canvas
            camera={{ position: [0, 0, 8], fov: 50 }}
            // Optimizado para GPU integrada (i5 5ª gen / Win7):
            // sin antialias, sin supersampling (dpr=1).
            gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
            dpr={1}
          >
            {/* Iluminación 100% local (sin HDRI de Environment, que además se baja
                de internet y carga la GPU). Más luces compensan el reflejo perdido. */}
            <ambientLight intensity={0.7} />
            <spotLight position={[6, 12, 8]} angle={0.3} penumbra={1} intensity={2.4} color="#ffffff" />
            <pointLight position={[-6, -2, 4]} intensity={2.0} color="#00b4d8" distance={20} />
            <pointLight position={[0, 0, 4]} intensity={1.5} color="#ffffff" distance={14} />
            <pointLight position={[4, 4, 6]} intensity={1.2} color="#ffffff" distance={18} />
            <Suspense fallback={null}>
              <Scene products={displayProducts} activeIndex={activeIndex} dimmed={menuVisible || brandVisible} />
              <ContactShadows resolution={256} scale={22} blur={3} opacity={0.45} far={10} color="#000000" />
            </Suspense>
          </Canvas>
        ) : (
          view === 'catalog' && currentProduct && (
            <div className={cn(
              "absolute inset-0 flex items-center justify-center p-4 transition-all duration-500",
              (menuVisible || brandVisible) ? "opacity-20 scale-[0.98] pointer-events-none" : "opacity-100 scale-100"
            )}>
              <div className="relative w-[380px] h-[520px] rounded-3xl p-6 border-2 border-cyan-400/50 bg-[#0f2032]/95 shadow-[0_0_50px_rgba(0,180,216,0.35)] flex flex-col items-center justify-between text-center">
                <div className="relative w-full h-[330px] rounded-2xl bg-[#eef4fa] overflow-hidden flex items-center justify-center p-4 border border-white/20">
                  {currentProduct.imageUrl ? (
                    <img 
                      src={currentProduct.imageUrl} 
                      alt={currentProduct.codigo} 
                      className="max-w-full max-h-full object-contain drop-shadow-md select-none pointer-events-none"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 text-cyan-700">
                      <div className="w-16 h-16 rounded-full border-4 border-cyan-500 border-dashed animate-spin flex items-center justify-center" />
                      <span className="font-mono text-sm font-bold text-cyan-600">SIN IMAGEN</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <h3 className="text-2xl font-display font-extrabold text-white">
                    Ref. {currentProduct.codigo}
                  </h3>
                  <span className="text-xs font-mono font-bold text-cyan-300 tracking-wider uppercase">
                    {currentProduct.categoria || 'Repuesto Inyección'}
                  </span>
                  <p className="text-sm font-sans text-slate-300 line-clamp-2 max-w-[320px] leading-relaxed font-semibold">
                    {currentProduct.descripcion}
                  </p>
                </div>
                <div className="text-[10px] font-mono text-cyan-400/80 font-bold uppercase tracking-widest mt-1">
                  PELLIZCA PARA DETALLES
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-6 z-10 flex justify-between items-center pointer-events-none">
        <div className="px-5 py-3 rounded-2xl flex items-center gap-4 pointer-events-auto border-2 border-white/15 bg-[#0a1626]/95 shadow-xl">
          <img src={headerLogo} alt="Logo" className="h-11 w-auto object-contain bg-white p-1 rounded-lg" />
          <div className="flex flex-col">
            <h1 className="text-base font-display font-bold tracking-tight text-white m-0 leading-tight">
              {metadata?.fabricante || 'AUTOPARTES JULIO O. BUZETTI S.A.'}
            </h1>
            <p className="text-[11px] font-mono text-cyan-300 mt-0.5 uppercase tracking-widest font-bold">
              {metadata?.descripcion || 'Catálogo Interactivo'}
            </p>
          </div>
        </div>

        {/* Camera indicator */}
        <button 
          onClick={() => setCameraEnabled(e => !e)}
          className={cn(
            "px-4 py-3 rounded-2xl flex items-center gap-3 border-2 transition-all pointer-events-auto cursor-pointer select-none",
            cameraEnabled 
              ? "border-cyan-400/30 bg-[#0a1626]/95 hover:bg-cyan-500/10 shadow-[0_0_20px_rgba(0,180,216,0.2)]" 
              : "border-white/10 bg-black/40 hover:bg-white/5 opacity-75"
          )}
        >
          <div className="relative w-12 h-12 overflow-hidden rounded-lg bg-black/40 shrink-0 ring-1 ring-cyan-400/30">
            {cameraEnabled ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-80" />
                {isInitializing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                    <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-500">
                <VideoOff className="w-5 h-5" />
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-[120px] text-left">
            <span className="text-[9px] font-mono text-cyan-400/80 uppercase tracking-widest font-bold">Cámara de Gestos</span>
            <span className={cn("text-xs font-mono font-bold tracking-wider mt-0.5",
              !cameraEnabled ? "text-slate-500" : gesture !== 'IDLE' ? "text-cyan-300 animate-pulse" : "text-slate-400")}>
              {!cameraEnabled ? 'DESACTIVADA' : isInitializing ? 'INICIANDO…' : error ? 'CÁMARA REQUERIDA' : gesture.replace('_', ' ')}
            </span>
            <span className="text-[8px] font-mono text-slate-500 mt-0.5 uppercase">Click para {cameraEnabled ? 'apagar' : 'encender'}</span>
          </div>
        </button>
      </header>

      {/* ════ BRAND SELECTOR ════ */}
      <div className={cn(
        'absolute inset-0 z-30 flex flex-col items-center justify-center gap-7 px-10 py-12 overflow-y-auto scrollbar-hide transition-all duration-500',
        'bg-[#05080d]/97',
        brandVisible ? 'opacity-100' : 'opacity-0 pointer-events-none scale-[0.98]'
      )}>
        {/* ───── PRODUCTO ESTRELLA (hero destacado) ───── */}
        <button
          ref={heroRef}
          onClick={openFeatured}
          className={cn(
            'group relative w-full max-w-5xl shrink-0 overflow-hidden rounded-3xl border-2 text-left transition-all duration-300',
            'bg-[linear-gradient(110deg,_#10243a_0%,_#0c1a2b_55%,_#1a1407_100%)]',
            heroHovered
              ? 'border-amber-300 shadow-[0_0_60px_-5px_rgba(251,191,36,0.7)] scale-[1.02]'
              : 'border-amber-400/50 hover:border-amber-300 hover:scale-[1.01]'
          )}
        >
          {/* destello que recorre la tarjeta */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="anim-sheen absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          </div>

          <div className="relative flex items-center gap-6 p-6">
            {/* imagen flotante con glow */}
            <div className="relative shrink-0 w-64 h-48 flex items-center justify-center">
              <div className="anim-glow absolute inset-0 rounded-full bg-amber-400/30 blur-3xl" />
              <img src={FEATURED.hero} alt="Combo guardabarros + soporte"
                className="anim-float relative h-48 w-auto object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)]" />
            </div>

            {/* texto */}
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400 text-[#1a1407] text-xs font-mono font-extrabold uppercase tracking-widest mb-3">
                <Sparkles className="w-4 h-4" /> Explorar en detalle
              </div>
              <h3 className="text-4xl font-display font-extrabold text-white tracking-tight leading-none mb-2">
                Guardabarros + Soporte
              </h3>
              <p className="text-lg text-amber-100 font-semibold mb-1">Conjunto con omegas para acoplados</p>
              <p className="text-sm font-mono text-slate-300 mb-4">
                Soporte y omegas <span className="text-amber-300 font-bold">fabricación JOBUZETTI</span> · guardabarros <span className="text-amber-300 font-bold">Climatic</span>
              </p>
              <span className={cn(
                'inline-flex items-center gap-2 text-base font-mono font-bold transition-colors',
                heroHovered ? 'text-amber-300' : 'text-amber-400/80'
              )}>
                <Sparkles className="w-5 h-5" /> Pellizque para explorar las partes →
              </span>
            </div>
          </div>
        </button>

        <p className="text-sm font-mono uppercase tracking-[0.35em] text-cyan-300 font-bold shrink-0">o explore nuestros catálogos</p>

        <div className="grid grid-cols-3 gap-5 w-full max-w-5xl shrink-0">
          <BrandCard
            ref={(el) => { brandCardRefs.current[0] = el; }}
            onClick={() => selectBrand('jobuzetti')}
            accent="cyan"
            tag="Fabricación propia"
            title="JOBUZETTI"
            subtitle="Bisagras, cierres y accesorios de carrocería"
            detail="Ford · Chevrolet · Mercedes · VW · Peugeot · Toyota · Renault · +4 líneas más"
            keyHint="1"
            handHover={brandHovered === 0}
          />
          <BrandCard
            ref={(el) => { brandCardRefs.current[1] = el; }}
            onClick={() => selectBrand('diesel')}
            accent="blue"
            tag="Repuestos distribución"
            title="Inyección Diésel"
            subtitle="Bombas, cebadores y filtros de combustible"
            detail="Adaptable a Mercedes-Benz · Deutz · Motores de campo y transporte"
            keyHint="2"
            handHover={brandHovered === 1}
          />
          <BrandCard
            ref={(el) => { brandCardRefs.current[2] = el; }}
            onClick={() => selectBrand('abfrenos')}
            accent="blue"
            tag="Frenos y aire"
            title="A.B. Frenos"
            subtitle="Repuestos para acoplados y semirremolques"
            detail="Pulmones · Patines · Tanques de aire · Puntas de eje · Herrajes"
            keyHint="3"
            handHover={brandHovered === 2}
            logo="/images/abfrenos/logo-abfrenos.jpg"
          />
        </div>

        <p className="text-base font-mono text-slate-200 font-semibold shrink-0">
          Apunte con la mano y pellizque · o presione 1 / 2 / 3
        </p>
      </div>

      {/* ════ EXPLORADOR INTERACTIVO DEL COMBO (estilo HUD) ════ */}
      <FeaturedExplorer
        visible={showFeatured}
        handPos={handPos}
        pinchCount={pinchCount}
        gesture={gesture}
        onClose={closeFeatured}
      />

      {/* ════ CATEGORY MENU ════ */}
      <CategoryMenu
        categories={categories}
        handPos={handPos}
        pinchCount={pinchCount}
        onSelect={selectCategory}
        visible={menuVisible}
      />

      {/* Gesture guide — catalog only */}
      {view === 'catalog' && !isIdle && (
        <div className="absolute left-6 top-28 w-64 rounded-2xl p-5 flex flex-col gap-3.5 z-10 border-2 border-white/15 bg-[#0a1626]/95 shadow-xl text-slate-100 pointer-events-auto">
          <h3 className="text-[11px] font-mono text-cyan-400 font-bold uppercase tracking-widest border-b border-white/10 pb-2">Cómo navegar</h3>
          <GuideRow icon={<ArrowLeftRight className="w-4 h-4" />} title="Cambiar pieza" desc="Deslice la mano izquierda o derecha." />
          <GuideRow icon={<Hand className="w-4 h-4" />} title="Ver ficha" desc="Pellizque (índice + pulgar)." />
          <GuideRow icon={<Minimize className="w-4 h-4" />} title="Cerrar ficha" desc="Abra la mano frente a la cámara." />
          <div className="mt-1 p-2.5 bg-black/20 rounded-xl text-[10px] text-slate-400 font-mono">
            Párese a ~1,5 m en zona iluminada.
          </div>
        </div>
      )}

      {/* ════ SPEC SHEET ════ */}
      <div className={cn(
        "absolute right-6 top-28 bottom-28 w-[440px] rounded-3xl p-7 flex flex-col z-20 transition-all duration-500 transform shadow-2xl border-2 border-white/15 bg-[#0a1626] text-slate-100",
        showDetails && view === 'catalog' ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0 pointer-events-none"
      )}>
        {currentProduct && (
          <>
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pr-2 scrollbar-hide flex flex-col gap-5">
              <div>
                <div className="inline-flex px-3 py-1.5 bg-cyan-400/15 rounded-lg text-sm font-mono text-cyan-300 border border-cyan-400/40 mb-3 font-bold uppercase tracking-wider">
                  {currentProduct.categoria || currentProduct.linea || 'Repuesto'}
                </div>
                <h2 className="text-4xl font-display font-extrabold text-white leading-tight mb-2">Ref. {currentProduct.codigo}</h2>
                <p className="text-slate-100 text-lg leading-relaxed font-semibold mt-1">{currentProduct.descripcion}</p>
              </div>

              {/* JOBUZETTI extra fields */}
              {currentProduct.especificacion && (
                <SpecBlock title="Fabricación">
                  <p className="text-base border-l-2 border-cyan-400 pl-3 text-slate-100 font-mono font-semibold leading-relaxed">
                    {currentProduct.especificacion}
                  </p>
                </SpecBlock>
              )}
              {currentProduct.fabricacion && (
                <div className={cn(
                  "inline-flex self-start px-3 py-2 rounded-xl text-sm font-mono font-bold border",
                  currentProduct.fabricacion === 'JOBUZETTI'
                    ? 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30'
                    : 'bg-white/5 text-slate-400 border-white/10'
                )}>
                  {currentProduct.fabricacion === 'JOBUZETTI' ? '⚙ Fabricación propia JOBUZETTI' : '📦 Producto importado'}
                </div>
              )}

              {/* Diesel injection fields */}
              {currentProduct.referencias && Object.keys(currentProduct.referencias).length > 0 && (
                <SpecBlock title="Referencias Cruzadas">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(currentProduct.referencias).map(([key, val]: any) => (
                      <div key={key} className="bg-white/5 text-sm px-3 py-2 rounded-xl border border-white/10 flex gap-2 font-mono">
                        <span className="text-cyan-300 font-bold">{key}:</span>
                        <span className="text-slate-200 font-bold">{val}</span>
                      </div>
                    ))}
                  </div>
                </SpecBlock>
              )}

              {currentProduct.medidas && (
                <SpecBlock title="Especificaciones Físicas">
                  <p className="text-base border-l-2 border-cyan-400 pl-3 text-slate-100 font-mono font-semibold">{currentProduct.medidas}</p>
                </SpecBlock>
              )}

              {currentProduct.componentes_principales && Object.keys(currentProduct.componentes_principales).length > 0 && (
                <SpecBlock title="Estructura y Componentes">
                  <ul className="flex flex-col gap-2 font-mono">
                    {Object.entries(currentProduct.componentes_principales).map(([key, val]: any) => (
                      <li key={key} className="text-sm flex justify-between text-slate-100 border-b border-white/10 pb-1.5 last:border-0 last:pb-0">
                        <span className="text-cyan-300 font-bold">{key}:</span>
                        <span className="text-slate-300 text-right">{val}</span>
                      </li>
                    ))}
                  </ul>
                </SpecBlock>
              )}

              {currentProduct.aplicaciones && currentProduct.aplicaciones.length > 0 && (
                <SpecBlock title="Aplicaciones Compatibles">
                  <ul className="flex flex-wrap gap-2">
                    {currentProduct.aplicaciones.map((app: string, idx: number) => (
                      <li key={idx} className="bg-white/5 text-sm px-3 py-2 rounded-lg border border-white/10 text-slate-100 font-semibold">{app}</li>
                    ))}
                  </ul>
                </SpecBlock>
              )}

              {currentProduct.pagina_catalogo && (
                <div className="text-[10px] font-mono text-cyan-400/70 font-bold mt-auto pt-2 flex items-center justify-between">
                  <span>{footerLabel}</span>
                  <span className="bg-cyan-400/10 px-2.5 py-1 rounded-md text-cyan-300 border border-cyan-400/30">PÁG. {currentProduct.pagina_catalogo}</span>
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-white/10 flex justify-between items-center text-xs font-mono text-slate-400 font-bold">
              <span>ABRE LA MANO PARA CERRAR</span>
              <Minimize className="w-4 h-4 text-cyan-400 animate-bounce" />
            </div>
          </>
        )}
      </div>

      {/* ════ BOTTOM NAV — catalog only ════ */}
      {view === 'catalog' && !isIdle && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none">
          <div className="w-80 h-1.5 bg-white/10 rounded-full overflow-hidden mb-4 border border-white/10">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center gap-4 pointer-events-auto">
            {/* MENÚ: pastilla etiquetada — target grande y fácil de pellizcar */}
            <button ref={(el) => { navRefs.current[0] = el; }} onClick={goToMenu} aria-label="Volver al menú"
              className={cn(
                "h-16 px-5 flex items-center gap-2 rounded-2xl border-2 shadow-xl transition active:scale-95 text-sm font-mono font-bold uppercase tracking-widest",
                navHovered === 0
                  ? "border-cyan-300 bg-cyan-400/25 text-white scale-110 shadow-[0_0_34px_-4px_rgba(0,180,216,0.8)]"
                  : "border-white/15 bg-[#0a1626]/95 text-cyan-200 hover:bg-cyan-400/10"
              )}>
              <LayoutGrid className="w-6 h-6" /> Menú
            </button>
            <NavButton ref={(el) => { navRefs.current[1] = el; }} onClick={goPrev} disabled={activeIndex === 0} hovered={navHovered === 1} label="Anterior"><ChevronLeft className="w-8 h-8" /></NavButton>
            <button ref={(el) => { navRefs.current[2] = el; }} onClick={toggleFicha}
              className={cn(
                "px-6 h-16 flex items-center gap-2 rounded-2xl border-2 shadow-xl transition active:scale-95 text-sm font-mono font-bold uppercase tracking-widest",
                navHovered === 2
                  ? "border-cyan-300 bg-cyan-400/25 text-white scale-110 shadow-[0_0_34px_-4px_rgba(0,180,216,0.8)]"
                  : "border-white/15 bg-[#0a1626]/95 text-cyan-200 hover:bg-cyan-400/10"
              )}>
              {showDetails ? <Minimize className="w-6 h-6" /> : <Info className="w-6 h-6" />}
              {showDetails ? 'Cerrar' : 'Ficha'}
            </button>
            <NavButton ref={(el) => { navRefs.current[3] = el; }} onClick={goNext} disabled={activeIndex === displayProducts.length - 1} hovered={navHovered === 3} label="Siguiente"><ChevronRight className="w-8 h-8" /></NavButton>
          </div>
        </div>
      )}

      {/* Volver a marcas — in menu view */}
      {view === 'menu' && !isIdle && (
        <button ref={menuBackRef} onClick={() => { touch(); setView('brand'); }}
          className={cn(
            "absolute top-28 left-6 z-40 flex items-center gap-2 px-5 h-12 rounded-2xl border backdrop-blur-md text-xs font-mono uppercase tracking-widest transition pointer-events-auto",
            menuBackHovered
              ? "border-cyan-400/80 bg-cyan-400/20 text-white scale-105 shadow-[0_0_30px_-4px_rgba(0,180,216,0.7)]"
              : "border-white/10 bg-white/[0.05] text-slate-300 hover:text-white hover:bg-white/10"
          )}>
          <ArrowLeft className="w-4 h-4" /> Cambiar catálogo
        </button>
      )}

      {/* ════ IDLE SHOWCASE ════ */}
      {/* Cartel inferior NO opaco: deja ver el carrusel 3D recorriendo el
          catálogo en automático por detrás. */}
      <div className={cn(
        "absolute inset-x-0 bottom-0 z-40 flex flex-col items-center pb-12 pt-36 text-center transition-opacity duration-700 pointer-events-none",
        "bg-gradient-to-t from-[#06090e] via-[#06090e]/85 to-transparent",
        isIdle ? "opacity-100" : "opacity-0"
      )}>
        <div className="relative mb-5 flex items-center justify-center">
          <span className="absolute w-24 h-24 rounded-full border-2 border-cyan-400/40 animate-ping" />
          <span className="absolute w-36 h-36 rounded-full border border-cyan-400/20 animate-ping [animation-delay:300ms]" />
          <div className="relative w-20 h-20 rounded-full bg-cyan-400 flex items-center justify-center shadow-[0_0_40px_-2px_rgba(0,180,216,0.7)]">
            <Hand className="w-9 h-9 text-[#06090e] animate-bounce" />
          </div>
        </div>
        <h2 className="text-4xl font-display font-extrabold text-white tracking-tight mb-2 drop-shadow-lg">
          Levante la mano para <span className="text-cyan-300">explorar</span>
        </h2>
        <p className="text-sm font-mono uppercase tracking-[0.3em] text-cyan-300/80 animate-pulse">
          Deslice · Pellizque · Descubra
        </p>
      </div>

      {/* Hand cursor */}
      <div ref={cursorRef}
        className="fixed w-10 h-10 rounded-full border-2 border-cyan-400 bg-cyan-400/20 pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 opacity-0 shadow-[0_0_15px_rgba(0,180,216,0.5)]"
        style={{ left: '50%', top: '50%', willChange: 'left, top, transform' }} />
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const BrandCard = React.forwardRef<HTMLButtonElement, {
  onClick: () => void; accent: 'cyan' | 'blue'; tag: string; title: string;
  subtitle: string; detail: string; keyHint: string; handHover?: boolean; logo?: string;
}>(function BrandCard({ onClick, accent, tag, title, subtitle, detail, keyHint, handHover = false, logo }, ref) {
  const isCyan = accent === 'cyan';
  const isHover = handHover;
  return (
    <button ref={ref} onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-3xl p-7 text-left transition-all duration-300 border-2',
        'bg-[#0f2032]',
        isCyan
          ? isHover
            ? 'border-cyan-300 shadow-[0_0_50px_-3px_rgba(0,180,216,0.8)] scale-[1.04]'
            : 'border-cyan-400/40 hover:border-cyan-400/80 hover:scale-[1.02]'
          : isHover
            ? 'border-blue-300 shadow-[0_0_50px_-3px_rgba(59,130,246,0.8)] scale-[1.04]'
            : 'border-blue-500/40 hover:border-blue-400/80 hover:scale-[1.02]'
      )}>
      <div className={cn("text-xs font-mono uppercase tracking-widest mb-3 font-bold",
        isCyan ? "text-cyan-300" : "text-blue-300")}>{tag}</div>
      {logo && (
        <img src={logo} alt={title} className="h-12 w-auto object-contain bg-white rounded-lg p-1.5 mb-3" />
      )}
      <h3 className="text-4xl font-display font-extrabold text-white mb-2 tracking-tight">{title}</h3>
      <p className="text-base text-slate-100 font-semibold leading-snug mb-4">{subtitle}</p>
      <p className="text-sm font-mono text-slate-300 leading-relaxed">{detail}</p>

      {/* Key / hand hint */}
      <div className={cn(
        "absolute top-5 right-5 w-9 h-9 rounded-xl border-2 flex items-center justify-center text-base font-mono font-bold transition-colors",
        isCyan
          ? isHover ? "border-cyan-300 text-cyan-300 bg-cyan-400/20" : "border-cyan-400/50 text-cyan-300"
          : isHover ? "border-blue-300 text-blue-300 bg-blue-400/20" : "border-blue-400/50 text-blue-300"
      )}>{keyHint}</div>

      {/* Glow */}
      <div className={cn(
        'absolute -right-10 -bottom-10 w-48 h-48 rounded-full blur-3xl transition-opacity',
        isCyan ? 'bg-cyan-400/15' : 'bg-blue-500/15',
        isHover ? 'opacity-100' : 'opacity-0'
      )} />
    </button>
  );
});

function GuideRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="p-2 bg-cyan-400/10 text-cyan-300 rounded-xl border border-cyan-400/20 shrink-0">{icon}</div>
      <div>
        <h4 className="text-xs font-bold text-white uppercase tracking-wide">{title}</h4>
        <p className="text-xs text-slate-300 mt-0.5 leading-normal">{desc}</p>
      </div>
    </div>
  );
}

function SpecBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.06] p-4 rounded-2xl border border-white/15">
      <h3 className="text-sm font-mono text-cyan-300 uppercase tracking-widest mb-2.5 font-bold">{title}</h3>
      {children}
    </div>
  );
}

const NavButton = React.forwardRef<HTMLButtonElement, {
  onClick: () => void; disabled?: boolean; label: string; hovered?: boolean; children: React.ReactNode;
}>(function NavButton({ onClick, disabled, label, hovered = false, children }, ref) {
  return (
    <button ref={ref} onClick={onClick} disabled={disabled} aria-label={label}
      className={cn(
        "w-16 h-16 flex items-center justify-center rounded-2xl border-2 shadow-xl transition active:scale-95 disabled:opacity-20 disabled:cursor-default",
        hovered && !disabled
          ? "border-cyan-300 bg-cyan-400/25 text-white scale-110 shadow-[0_0_34px_-4px_rgba(0,180,216,0.8)]"
          : "border-white/15 bg-[#0a1626]/95 text-cyan-200 hover:bg-cyan-400/10"
      )}>
      {children}
    </button>
  );
});
