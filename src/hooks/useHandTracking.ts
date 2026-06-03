import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';

export type GestureType = 'IDLE' | 'SWIPE_LEFT' | 'SWIPE_RIGHT' | 'PINCH' | 'OPEN_HAND';

interface Point { x: number; y: number; z: number }

const opts = (delegate: 'GPU' | 'CPU') => ({
  baseOptions: {
    modelAssetPath: '/models/hand_landmarker.task',
    delegate: delegate,
  },
  runningMode: 'VIDEO' as const,
  numHands: 1,
  // Umbral algo más bajo: en PCs viejas + CPU la detección es más débil; queremos
  // que tome la mano con facilidad bajo la iluminación de la feria.
  minHandDetectionConfidence: 0.5,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

export function useHandTracking(cursorRef?: React.RefObject<HTMLDivElement | null>, enabled = true) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [gesture, setGesture] = useState<GestureType>('IDLE');
  const [handPos, setHandPos] = useState<{ x: number, y: number } | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const historyRef = useRef<{x: number, y: number, time: number}[]>([]);
  const lastGestureTime = useRef<number>(0);

  // Smoothed (EMA) landmark positions — kills jitter so the cursor is steady
  // and swipes don't fire from camera noise under harsh booth lighting.
  const smoothRef = useRef<{ ix: number, iy: number, tx: number, ty: number, wx: number } | null>(null);
  // Hysteresis state for pinch so it doesn't flicker around the threshold.
  const pinchedRef = useRef<boolean>(false);
  // Última posición emitida a React — para no re-renderizar la App si la mano
  // está casi quieta (zona muerta). El cursor visual usa ref aparte y sigue fluido.
  const lastEmitRef = useRef<{ x: number, y: number } | null>(null);

  // Diagnóstico visible en pantalla (tecla D) para depurar sin consola en la PC del stand.
  const [diag, setDiag] = useState({
    status: 'cargando', delegate: '-', camera: '-',
    videoW: 0, videoH: 0, frames: 0, hands: 0, err: '',
  });
  const diagRef = useRef({ ...diag });
  // Actualiza el ref de diagnóstico. Sólo refleja en React (re-render) cuando se
  // pide explícitamente (push), para no spamear renders en el loop por frame.
  const setD = (patch: Partial<typeof diag>, push = false) => {
    diagRef.current = { ...diagRef.current, ...patch };
    if (push) setDiag({ ...diagRef.current });
  };

  // Motor de inferencia (GPU/CPU). Se puede cambiar en vivo (tecla G) porque en
  // algunas PCs viejas uno de los dos crashea (detect: aborted) y el otro anda.
  const visionRef = useRef<any>(null);
  // CPU por defecto: el delegado GPU CUELGA Chrome entero en placas viejas con
  // WebGL por software (el detectForVideo nunca vuelve). CPU, si falla, tira un
  // error que SÍ se puede atrapar (no congela). GPU sólo por prueba manual (G).
  const delegateRef = useRef<'GPU' | 'CPU'>('CPU');
  const buildingRef = useRef(false);
  const abortCountRef = useRef(0);   // crashes seguidos del motor
  const gaveUpRef = useRef(false);   // se rindió: no detectar más (no trabar)

  // (Re)crea el HandLandmarker con el delegado actual.
  const buildLandmarker = useCallback(async () => {
    if (!visionRef.current || buildingRef.current) return;
    buildingRef.current = true;
    try {
      try { landmarkerRef.current?.close(); } catch { /* ignore */ }
      landmarkerRef.current = null;
      setD({ status: 'cargando motor ' + delegateRef.current }, true);
      landmarkerRef.current = await HandLandmarker.createFromOptions(
        visionRef.current, opts(delegateRef.current)
      );
      setD({ status: 'modelo listo', delegate: delegateRef.current, err: '' }, true);
    } catch (e: any) {
      setD({ status: 'ERROR motor', err: (delegateRef.current + ': ' + (e?.message || e)) }, true);
    } finally {
      buildingRef.current = false;
    }
  }, []);

  // Cambiar GPU<->CPU manualmente (tecla G). Reinicia los contadores para
  // darle otra chance al motor elegido.
  const cycleDelegate = useCallback(() => {
    delegateRef.current = delegateRef.current === 'GPU' ? 'CPU' : 'GPU';
    abortCountRef.current = 0;
    gaveUpRef.current = false;
    buildLandmarker();
  }, [buildLandmarker]);

  // Initialize MediaPipe HandLandmarker
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        // WASM + modelo LOCALES (sin internet).
        const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        if (!active) return;
        visionRef.current = vision;
        await buildLandmarker();
        if (!active) return;
        setIsInitializing(false);
      } catch (err: any) {
        console.error("Failed to initialize hand tracking:", err);
        setD({ status: 'ERROR init', err: err?.message || String(err) }, true);
        setError(err.message || "Failed to initialize MediaPipe");
        setIsInitializing(false);
      }
    }
    init();
    return () => {
      active = false;
      if (landmarkerRef.current) { try { landmarkerRef.current.close(); } catch {} }
    };
  }, [buildLandmarker]);

  // Detect gestures based on landmarks
  const processLandmarks = useCallback((result: HandLandmarkerResult) => {
    if (result.landmarks.length > 0) {
      const hand = result.landmarks[0];

      // --- Exponential smoothing (EMA) of the key landmarks ---
      // alpha=0.55: más ágil (menos lag percibido) sin volverse tembloroso.
      const alpha = 0.55;
      const rawIx = hand[8].x, rawIy = hand[8].y;   // index tip
      const rawTx = hand[4].x, rawTy = hand[4].y;   // thumb tip
      const rawWx = hand[0].x;                       // wrist x

      const prev = smoothRef.current;
      const s = prev
        ? {
            ix: prev.ix + alpha * (rawIx - prev.ix),
            iy: prev.iy + alpha * (rawIy - prev.iy),
            tx: prev.tx + alpha * (rawTx - prev.tx),
            ty: prev.ty + alpha * (rawTy - prev.ty),
            wx: prev.wx + alpha * (rawWx - prev.wx),
          }
        : { ix: rawIx, iy: rawIy, tx: rawTx, ty: rawTy, wx: rawWx };
      smoothRef.current = s;

      // Update hand position coordinates (smoothed) — sólo si se movió lo
      // suficiente, para evitar re-renders inútiles con la mano quieta.
      const le = lastEmitRef.current;
      if (!le || Math.abs(s.ix - le.x) > 0.004 || Math.abs(s.iy - le.y) > 0.004) {
        lastEmitRef.current = { x: s.ix, y: s.iy };
        setHandPos({ x: s.ix, y: s.iy });
      }

      const distance = Math.sqrt(
        Math.pow(s.tx - s.ix, 2) +
        Math.pow(s.ty - s.iy, 2)
      );

      const now = Date.now();
      // X en ESPACIO DE PANTALLA (espejado, igual que el cursor): 0 = borde
      // izquierdo, 1 = borde derecho. Así el swipe coincide con lo que el
      // usuario ve mover en la pantalla.
      const screenX = 1 - s.ix;

      // Sync custom cursor DOM element
      if (cursorRef?.current) {
          cursorRef.current.style.opacity = '1';
          const cx = (1 - s.ix) * window.innerWidth;
          const cy = s.iy * window.innerHeight;
          cursorRef.current.style.left = `${cx}px`;
          cursorRef.current.style.top = `${cy}px`;

          if (pinchedRef.current) {
              cursorRef.current.style.transform = 'translate(-50%, -50%) scale(0.6)';
              cursorRef.current.style.backgroundColor = 'rgba(0, 180, 216, 0.9)'; // Brand Cyan
              cursorRef.current.style.borderColor = 'rgba(0, 180, 216, 1)';
          } else {
              cursorRef.current.style.transform = 'translate(-50%, -50%) scale(1)';
              cursorRef.current.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              cursorRef.current.style.borderColor = 'rgba(255, 255, 255, 0.8)';
          }
      }

      // PINCH DETECTION con histéresis — entra a 0.06 (más fácil de disparar),
      // suelta a 0.10 para que una mano cerca del umbral no parpadee.
      if (!pinchedRef.current && distance < 0.06) {
        pinchedRef.current = true;
        setGesture('PINCH');
      } else if (pinchedRef.current && distance > 0.10) {
        pinchedRef.current = false;
        setGesture('OPEN_HAND');
      } else if (!pinchedRef.current && distance > 0.15) {
        setGesture('OPEN_HAND');
      } else if (!pinchedRef.current) {
        setGesture('IDLE');
      }

      // SWIPE DETECTION — modelo de "arrastre direccional" en espacio de pantalla.
      // Para que sea DELIBERADO (no súper sensible) exige:
      //   • empezar el gesto en un lado de la pantalla,
      //   • arrastrar de forma horizontal hacia el otro lado,
      //   • cubrir una distancia clara (TRAVEL).
      // Empezar en la IZQUIERDA y arrastrar a la derecha → pieza anterior.
      // Empezar en la DERECHA y arrastrar a la izquierda  → pieza siguiente.
      const TRAVEL = 0.22;      // distancia mínima del arrastre (22% del ancho)
      const START_EDGE = 0.55;  // "izquierda" = <0.45 ; "derecha" = >0.55
      if (!pinchedRef.current && now - lastGestureTime.current > 700) {
          historyRef.current.push({ x: screenX, y: s.iy, time: now });
          historyRef.current = historyRef.current.filter(p => now - p.time < 500);

          if (historyRef.current.length > 1) {
              const oldest = historyRef.current[0];
              const dx = screenX - oldest.x;       // + = hacia la derecha
              const dy = s.iy - oldest.y;
              const horizontal = Math.abs(dx) > Math.abs(dy) * 1.4;

              // Izquierda → derecha (empezó en la mitad izquierda)
              if (horizontal && dx > TRAVEL && oldest.x < (1 - START_EDGE)) {
                  setGesture('SWIPE_RIGHT'); // App: SWIPE_RIGHT → anterior
                  lastGestureTime.current = now;
                  historyRef.current = [];
              // Derecha → izquierda (empezó en la mitad derecha)
              } else if (horizontal && dx < -TRAVEL && oldest.x > START_EDGE) {
                  setGesture('SWIPE_LEFT');  // App: SWIPE_LEFT → siguiente
                  lastGestureTime.current = now;
                  historyRef.current = [];
              }
          }
      }

    } else {
      setGesture('IDLE');
      historyRef.current = [];
      smoothRef.current = null;
      pinchedRef.current = false;
      lastEmitRef.current = null;
      setHandPos(null);
      if (cursorRef?.current) cursorRef.current.style.opacity = '0';
    }
  }, [cursorRef]);

  // Set up camera and processing loop
  useEffect(() => {
    if (!enabled || isInitializing || error) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      setGesture('IDLE');
      setHandPos(null);
      if (cursorRef?.current) cursorRef.current.style.opacity = '0';
      return;
    }
    
    let active = true;
    let lastVideoTime = -1;
    let lastInferenceTime = 0;
    // ~30 fps de inferencia: fluido pero sin saturar la CPU. Posible ahora que
    // el 3D dejó de comerse la GPU (sin HDRI y con tarjetas virtualizadas).
    const INFERENCE_INTERVAL_MS = 33;

    let lastDiagPush = 0;

    async function startCamera() {
      try {
        // Resolución baja a propósito: el modelo reescala internamente.
        // Pedimos lo mínimo (sin fijar tamaño exacto) para máxima compatibilidad
        // con webcams viejas; si falla, reintentamos con lo más básico.
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 480 }, height: { ideal: 360 }, facingMode: 'user' },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        if (!videoRef.current || !active) return;
        const v = videoRef.current;
        v.srcObject = stream;
        v.muted = true;
        (v as any).playsInline = true;

        // Algunas webcams/Chrome viejos NO disparan 'loadeddata' a tiempo: hay que
        // llamar play() explícito y arrancar el loop apenas haya datos.
        try { await v.play(); } catch { /* autoplay políticas; igual seguimos */ }
        setD({ camera: 'ok' }, true);

        const begin = () => { if (active) predictWebcam(); };
        if (v.readyState >= 2) begin();
        else v.addEventListener('loadeddata', begin, { once: true });
        // Respaldo: arrancar igual al segundo, por si el evento no llega.
        setTimeout(begin, 1000);
      } catch (err: any) {
        console.error("Camera error:", err);
        setD({ camera: 'sin permiso/ERROR', err: err?.message || String(err) }, true);
        setError("Error accessing webcam. Please allow permissions.");
      }
    }

    function predictWebcam() {
      if (!videoRef.current || !active) { animationFrameRef.current = requestAnimationFrame(predictWebcam); return; }

      const v = videoRef.current;
      const now = performance.now();

      // No detectar mientras se (re)construye el motor, si no hay landmarker, o
      // si ya se rindió (para no trabar la CPU con crashes en bucle).
      if (landmarkerRef.current && !buildingRef.current && !gaveUpRef.current &&
          now - lastInferenceTime >= INFERENCE_INTERVAL_MS && v.readyState >= 2 && v.videoWidth > 0) {
        if (lastVideoTime !== v.currentTime) {
          lastVideoTime = v.currentTime;
          try {
            const results = landmarkerRef.current.detectForVideo(v, now);
            processLandmarks(results);
            abortCountRef.current = 0; // funcionó: reset
            setD({
              videoW: v.videoWidth, videoH: v.videoHeight,
              frames: diagRef.current.frames + 1,
              hands: results.landmarks.length,
            });
          } catch (e: any) {
            // El motor crasheó (aborted). NO cambiamos a GPU solos (GPU CUELGA
            // Chrome en esta clase de placas). Tras varios crashes, nos rendimos:
            // la app sigue 100% usable con teclado/mouse.
            abortCountRef.current += 1;
            if (abortCountRef.current >= 6) {
              gaveUpRef.current = true;
              setD({ status: 'gestos no disponibles', err: 'motor ' + delegateRef.current + ' inestable (' + (e?.message || e) + '). Usá teclado/mouse o probá tecla G.' }, true);
            } else {
              setD({ err: 'detect(' + delegateRef.current + '): ' + (e?.message || e) }, true);
            }
          }
          lastInferenceTime = now;
        }
      }

      // Empujar el diagnóstico a React ~2 veces por segundo (sin spamear renders).
      if (now - lastDiagPush > 500) {
        lastDiagPush = now;
        setDiag({ ...diagRef.current });
      }

      animationFrameRef.current = requestAnimationFrame(predictWebcam);
    }

    startCamera();

    return () => {
      active = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadeddata', predictWebcam);
      }
    };
  }, [enabled, isInitializing, error, processLandmarks]);

  return { videoRef, gesture, isInitializing, error, handPos, diag, cycleDelegate };
}
