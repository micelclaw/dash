/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// ─── Primitivas didácticas de ZFS ──────────────────────────────────
// InfoTip (icono ⓘ con tooltip), SectionIntro (bloque introductorio en
// lenguaje llano) y ZFS_COPY (textos centralizados en español). El módulo
// de Storage es todo inline-styles con var(--*); aquí seguimos el mismo
// patrón para que la ayuda combine visualmente con el resto.

import { useState } from 'react';
import { Info } from 'lucide-react';

// ── InfoTip ────────────────────────────────────────────────────────
// Icono ⓘ que muestra una explicación al pasar el ratón / al pulsar.
// Usa un popover propio (más legible que el title nativo para textos
// largos) y deja el title nativo como fallback de accesibilidad.
export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={text}
        title={text}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, margin: 0, border: 'none', background: 'transparent',
          color: 'var(--text-muted, var(--text-dim))', cursor: 'help', lineHeight: 0,
        }}
      >
        <Info size={13} />
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
            transform: 'translateX(-50%)', zIndex: 50, width: 'max-content', maxWidth: 280,
            padding: '8px 10px', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
            fontSize: '0.75rem', lineHeight: 1.45, color: 'var(--text-dim)',
            fontWeight: 400, textTransform: 'none', letterSpacing: 'normal',
            fontFamily: 'var(--font-sans)', whiteSpace: 'normal', textAlign: 'left',
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

// ── SectionIntro ───────────────────────────────────────────────────
// Bloque de texto explicativo en lenguaje llano para introducir una
// sección. Fondo tenue + borde-izquierdo de acento + padding cómodo.
export function SectionIntro({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'color-mix(in srgb, var(--mod-storage) 7%, var(--surface))',
        borderLeft: '3px solid color-mix(in srgb, var(--mod-storage) 55%, var(--border))',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 14px',
        fontSize: '0.8125rem', lineHeight: 1.55, color: 'var(--text-dim)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {children}
    </div>
  );
}

// ── ZFS_COPY ───────────────────────────────────────────────────────
// Textos didácticos centralizados (español, llanos). Se consumen desde
// InfoTip / SectionIntro y desde los wizards para no duplicar copy.
export const ZFS_COPY = {
  pool:
    'Un pool (almacén) es el conjunto de discos que ZFS gestiona como una sola unidad de ' +
    'almacenamiento. En lugar de pensar en discos sueltos, juntas varios y ZFS reparte los datos ' +
    'entre ellos, te protege ante fallos y te da una capacidad única donde guardar todo.',

  raid: {
    intro:
      'El nivel RAID decide cuántos discos pueden fallar sin que pierdas datos. Más protección ' +
      'cuesta más espacio "reservado". Elige según cuánto te importe el dato y cuántos discos tengas.',
    mirror:
      'Mirror (espejo): copia idéntica en 2 (o más) discos. Tolera el fallo de 1 disco (o más si ' +
      'añades copias). Es el más rápido y simple; ideal con pocos discos o para datos muy importantes. ' +
      'Inconveniente: solo aprovechas la mitad de la capacidad.',
    raidz1:
      'RAIDZ1: reparte los datos y guarda 1 disco de paridad. Tolera el fallo de 1 disco. ' +
      'Buen equilibrio capacidad/protección con 3-5 discos. No recomendado para discos muy grandes, ' +
      'porque reconstruir tras un fallo tarda y arriesga un segundo fallo durante el proceso.',
    raidz2:
      'RAIDZ2: guarda 2 discos de paridad. Tolera el fallo de 2 discos a la vez. Es la opción más ' +
      'recomendada para un NAS con 6 o más discos: protege incluso si un segundo disco falla mientras ' +
      'se reconstruye el primero. El equilibrio recomendado por defecto.',
    raidz3:
      'RAIDZ3: guarda 3 discos de paridad. Tolera el fallo de 3 discos a la vez. Para muchos discos ' +
      '(10+) o datos críticos donde quieres el máximo margen. Sacrifica más capacidad a cambio de la ' +
      'máxima protección.',
  },

  dataset:
    'Un dataset (carpeta gestionada) es una "carpeta inteligente" dentro del pool. Lo normal es crear ' +
    'uno por tipo de contenido (fotos, documentos, copias…), porque cada dataset puede tener sus propios ' +
    'ajustes: compresión, cuota de espacio, instantáneas (snapshots) y permisos. Es lo que usarás en el ' +
    'día a día para organizar tus datos.',

  zvol:
    'Un zvol (disco virtual) es un bloque de espacio que ZFS presenta como si fuera un disco crudo, no ' +
    'una carpeta. Normalmente NO lo necesitas: solo tiene sentido para dar disco a una máquina virtual o ' +
    'para exportarlo por iSCSI a otro equipo. Si guardas archivos, usa un dataset.',

  cache:
    'Puedes añadir SSD al pool para acelerarlo o reforzarlo. Hay tres tipos: ' +
    'L2ARC (caché de LECTURA): acelera leer datos que se piden a menudo; puedes quitarlo sin riesgo. ' +
    'SLOG (caché de ESCRITURA): acelera escrituras síncronas; conviene ponerlo en espejo. ' +
    'Special (METADATOS): guarda metadatos y archivos pequeños en SSD para que todo responda más rápido. ' +
    'OJO: el dispositivo special es PERMANENTE — pasa a formar parte del pool y, si lo pierdes sin ' +
    'redundancia, pierdes el pool. Ponlo siempre en espejo.',
} as const;
