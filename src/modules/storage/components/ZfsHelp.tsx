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

  clear:
    'Borra el contador de errores acumulados del pool (lectura, escritura y checksum). No repara nada: ' +
    'solo pone los avisos a cero. Hazlo cuando ya hayas solucionado la causa (cambiar un cable, sustituir ' +
    'un disco) y quieras volver a ver claro si vuelven a aparecer errores nuevos.',

  trim:
    'Avisa a los discos SSD de qué bloques ya no se usan, para que se mantengan rápidos y duren más. No ' +
    'afecta a tus datos. Lánzalo de vez en cuando si tu pool está sobre SSD; en discos duros normales no ' +
    'hace nada.',

  autotrim:
    'Si lo activas, ZFS hace el "trim" de los SSD automáticamente en segundo plano, sin que tengas que ' +
    'acordarte. Recomendado en pools de SSD. En discos duros normales déjalo apagado, no aporta nada.',

  spare:
    'Un disco de repuesto (spare) está conectado pero en reserva, sin usarse. Si un disco del pool falla, ' +
    'ZFS lo sustituye solo por el repuesto al instante y empieza a reconstruir sin esperar a que llegues ' +
    'tú. Muy útil para no quedarte desprotegido mientras consigues un disco nuevo.',

  offline:
    'Marca un disco como "fuera de servicio" a propósito: ZFS deja de usarlo pero no lo borra del pool. ' +
    'Útil para revisar o mover un disco sin desmontar nada. El pool sigue funcionando si tiene suficiente ' +
    'redundancia; vuelve a ponerlo con "online" cuando termines.',

  online:
    'Vuelve a poner en servicio un disco que estaba marcado como fuera de servicio (offline). ZFS lo ' +
    'reincorpora al pool y, si hace falta, lo pone al día con los datos que se hayan escrito mientras ' +
    'estaba parado.',

  detach:
    'Saca de forma definitiva un disco de un espejo (mirror). El espejo se queda con un disco menos, así ' +
    'que pierdes esa copia de seguridad. Úsalo solo si quieres reducir el espejo a propósito o vas a ' +
    'reutilizar ese disco en otro sitio.',

  scrub_stop:
    'Detiene la revisión (scrub) que está en marcha. El scrub lee todo el pool buscando errores y los ' +
    'repara; es bueno dejarlo terminar, pero si necesitas que el sistema vaya más rápido un rato puedes ' +
    'pararlo y reanudarlo más tarde sin riesgo.',

  export:
    'Desconecta el pool del sistema de forma limpia y segura, sin borrar nada. Es el paso previo para ' +
    'llevarte los discos a otro equipo o desmontarlos: deja todo bien cerrado para poder volver a ' +
    'conectarlo después con "importar".',

  import_pool:
    'Vuelve a conectar al sistema un pool que estaba desconectado (exportado), o uno que viene de otro ' +
    'equipo. ZFS detecta los discos y monta el pool con todos sus datos tal cual estaban.',

  upgrade:
    'Activa en el pool las mejoras nuevas que trae tu versión de ZFS (más rendimiento o funciones ' +
    'nuevas). OJO: una vez actualizado, equipos con una versión más antigua de ZFS quizá ya no puedan ' +
    'abrir el pool. Hazlo solo cuando no necesites volver atrás.',

  ashift:
    'Es el tamaño de bloque con el que ZFS habla con los discos, y se fija al crear el pool: no se puede ' +
    'cambiar después. El valor 12 (bloques de 4 KB) es el correcto para casi todos los discos modernos. ' +
    'Un valor mal elegido hace que el pool rinda peor para siempre.',

  features:
    'Son las funciones avanzadas de ZFS que el pool tiene disponibles (por ejemplo tipos de compresión). ' +
    'Las que están "activas" ya se usan; las inactivas pueden activarse con "actualizar el pool". Solo es ' +
    'informativo: no necesitas tocarlo en el día a día.',

  usage_logical_vs_physical:
    'El tamaño "lógico" es lo que ocuparían tus datos tal cual; el "físico" es lo que ocupan de verdad en ' +
    'los discos. Suelen diferir porque ZFS comprime al guardar: si el físico es menor que el lógico, la ' +
    'compresión te está ahorrando espacio.',

  usage_snapshots:
    'Las instantáneas (snapshots) son "fotos" del estado de tus datos en un momento dado, para poder ' +
    'volver atrás si borras o estropeas algo. Ocupan espacio porque conservan las versiones antiguas de ' +
    'los archivos que cambias o borras; por eso el espacio usado puede subir aunque tú no añadas nada ' +
    'nuevo. Borra las instantáneas viejas que ya no necesites para recuperar sitio.',
} as const;
