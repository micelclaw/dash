// Color determinista por tag: la misma palabra produce SIEMPRE el mismo tono.
// Luminancia y saturación FIJAS por rol (fondo/borde/texto) — solo cambia el tono (hue).
// Tonos no brillantes: fondo translúcido (se adapta al tema) + texto claro-tintado legible.
//
// Centraliza el hash string→hue que estaba duplicado (calendar/types, AvatarInitials, projects).

/** Hash estable de una cadena → hue [0,360). Case/space-insensitive para que "Trabajo" == "trabajo". */
export function hueFromString(s: string): number {
  let h = 0;
  for (const c of s.toLowerCase().trim()) h = c.charCodeAt(0) + ((h << 5) - h);
  return Math.abs(h) % 360;
}

export interface TagColor {
  /** Fondo del chip (tint translúcido sobre la superficie). */
  bg: string;
  /** Borde del chip. */
  border: string;
  /** Texto/icono del chip. */
  text: string;
}

/**
 * Devuelve los 3 colores de un tag. S/L fijos por rol → todos los tags tienen la misma
 * luminancia y saturación; solo cambia el tono. Ajustar aquí afecta a TODOS los dominios.
 */
export function tagColor(tag: string): TagColor {
  const hue = hueFromString(tag);
  return {
    bg: `hsl(${hue} 45% 50% / 0.16)`,
    border: `hsl(${hue} 45% 55% / 0.40)`,
    text: `hsl(${hue} 55% 72%)`,
  };
}
