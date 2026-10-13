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

/**
 * Propone qué significa cada columna de un tablero, deducido de su nombre.
 *
 * Se PROPONE y se confirma; nunca se aplica solo. Adivinar en silencio es lo que
 * produce los fallos que no dan la cara: una columna mal deducida cambiaría el
 * comportamiento de las tareas —incluido marcarlas como hechas al arrastrarlas—
 * sin que nadie lo haya visto.
 *
 * Lo que no se deduce se queda sin declarar, con su aviso. "Bloqueado" no es
 * ninguno de los cuatro estados del estándar y colgarle uno sería mentir.
 */

import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import { useEscapeToClose } from '@/hooks/use-escape-to-close';
import { SEMANTICAS, deducirTablero, colorSemantica, type StatusSemantic } from '../utils/status-semantic';
import type { Column } from '../types';

/** Tableros que el usuario ya decidió no etiquetar. Por navegador, como el resto
 *  de preferencias de interfaz (`use-tool-visibility.ts` usa el mismo patrón). */
const CLAVE = 'claw-semantic-dismissed';

export function tableroDescartado(boardId: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(CLAVE) ?? '[]') as string[]).includes(boardId);
  } catch { return false; }
}

function descartarTablero(boardId: string) {
  try {
    const previos = JSON.parse(localStorage.getItem(CLAVE) ?? '[]') as string[];
    localStorage.setItem(CLAVE, JSON.stringify([...new Set([...previos, boardId])]));
  } catch { /* sin storage: volverá a preguntar, que es inofensivo */ }
}

export function SemanticSuggestModal({
  boardId,
  columnas,
  onClose,
}: {
  boardId: string;
  columnas: Column[];
  onClose: () => void;
}) {
  const updateColumn = useProjectsStore((s) => s.updateColumn);
  const [filas, setFilas] = useState(() => deducirTablero(columnas));
  const [guardando, setGuardando] = useState(false);

  useEscapeToClose(onClose);

  async function aplicar() {
    setGuardando(true);
    try {
      // Solo lo que CAMBIA: una columna ya declarada no se vuelve a escribir.
      for (const f of filas) {
        if (f.propuesta !== f.actual) {
          await updateColumn(boardId, f.id, { status_semantic: f.propuesta });
        }
      }
      descartarTablero(boardId);
      onClose();
    } finally { setGuardando(false); }
  }

  function ahoraNo() {
    descartarTablero(boardId);
    onClose();
  }

  const sinDeducir = filas.filter((f) => f.propuesta == null).length;

  return (
    <div
      onClick={ahoraNo}
      style={{ position: 'fixed', inset: 0, zIndex: 205, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Significado de las columnas"
        style={{ width: 520, maxWidth: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 8px)', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>Significado de las columnas</span>
          <button onClick={ahoraNo} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '12px 14px', color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.5, borderBottom: '1px solid var(--border)' }}>
          Tus columnas se llaman como quieras, pero fuera de Micelclaw solo existen cuatro
          estados. Declarar la equivalencia hace que las tareas viajen bien —y que
          arrastrar una a una columna «Hecho» la marque como hecha. Esto es lo que deduzco
          de sus nombres:
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
          {filas.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
              <span style={{ flex: 1, minWidth: 0, color: 'var(--text)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.title}
              </span>
              <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>→</span>
              <select
                value={f.propuesta ?? ''}
                onChange={(e) => {
                  const v = (e.target.value || null) as StatusSemantic | null;
                  setFilas((prev) => prev.map((x) => (x.id === f.id ? { ...x, propuesta: v } : x)));
                }}
                style={{
                  width: 150, padding: '3px 6px', borderRadius: 6, fontSize: 12,
                  background: 'var(--card)', color: f.propuesta ? colorSemantica(f.propuesta) : 'var(--text-dim)',
                  border: '1px solid var(--border)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
                }}
              >
                <option value="">Ninguno</option>
                {SEMANTICAS.map((s) => <option key={s.valor} value={s.valor}>{s.etiqueta}</option>)}
              </select>
            </div>
          ))}
        </div>

        {sinDeducir > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '8px 14px', borderTop: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.4 }}>
            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              {sinDeducir === 1 ? 'Una columna no encaja' : `${sinDeducir} columnas no encajan`} en ninguno de los
              cuatro estados, y dejarlas en «Ninguno» es correcto. Sus tareas se verán como
              «por hacer» al sincronizar, y arrastrarlas ahí no cambiará si están hechas.
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          <button onClick={ahoraNo} style={{ padding: '5px 12px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12 }}>
            Ahora no
          </button>
          <button
            onClick={() => void aplicar()}
            disabled={guardando}
            style={{ padding: '5px 12px', borderRadius: 6, background: 'var(--amber)', border: 'none', color: '#06060a', cursor: guardando ? 'wait' : 'pointer', fontSize: 12, fontWeight: 500 }}
          >
            {guardando ? 'Guardando…' : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>
  );
}
