import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Tolerancia (px) alrededor de los botones para el "click" por gesto.
 *  Al pellizcar, la punta del índice suele moverse un poco; este margen
 *  evita que el toque no se registre por quedar justo afuera del borde. */
export const HIT_PAD = 70;

/** ¿El punto (px,py) en coordenadas de pantalla cae dentro del elemento,
 *  ampliado por `pad` px en cada lado? */
export function pointInEl(
  el: HTMLElement | null,
  px: number,
  py: number,
  pad: number = HIT_PAD,
): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return px >= r.left - pad && px <= r.right + pad && py >= r.top - pad && py <= r.bottom + pad;
}
