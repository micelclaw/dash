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
 * Mini-lenguaje de la captura rápida.
 *
 * Símbolos reservados, no lenguaje natural: es una regex escrita por nosotros,
 * sin dependencias y con el mismo comportamiento escribas en el idioma que
 * escribas. El precio es que hay que aprenderse cuatro símbolos; a cambio nunca
 * "adivina" mal en silencio, que es el fallo caro de los parsers de lenguaje
 * natural — se comen palabras del título y el usuario no se entera.
 *
 * Lo entendido se DEVUELVE para pintarlo en chips y poder quitarlo ANTES de
 * guardar. Ocultar el parseo es lo que hace Things 3 y es peor: si acierta no te
 * enteras, y si falla tampoco.
 */

export type Prioridad = 'urgent' | 'high' | 'medium' | 'low';

export interface TrozoParseado {
  /** Clave estable para el chip y para poder descartarlo. */
  id: string;
  tipo: 'prioridad' | 'tablero' | 'etiqueta' | 'asignado' | 'fecha';
  /** El texto literal que se comió del título (para poder devolverlo). */
  crudo: string;
  /** Lo que se enseña en el chip. Lleva la palabra, no solo el símbolo. */
  etiqueta: string;
  valor: string;
}

export interface Parseado {
  /** El título ya limpio de símbolos. */
  titulo: string;
  trozos: TrozoParseado[];
}

/**
 * `!1` es la MÁS urgente. Se pinta siempre con su palabra («!1 urgente») porque
 * la escala invertida de Todoist —donde p1 es lo más urgente y p4 lo menos— es
 * fuente conocida de errores: sin la palabra, la mitad de la gente asume que 1
 * es lo menos importante.
 */
const PRIORIDADES: Record<string, { valor: Prioridad; palabra: string }> = {
  '1': { valor: 'urgent', palabra: 'urgente' },
  '2': { valor: 'high', palabra: 'alta' },
  '3': { valor: 'medium', palabra: 'media' },
  '4': { valor: 'low', palabra: 'baja' },
};

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado'];
const DIA_INDICE: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miércoles: 3, miercoles: 3,
  jueves: 4, viernes: 5, sábado: 6, sabado: 6,
};

function aMedianoche(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Medianoche UTC del día LOCAL que representa `d` — el mismo valor que guarda
 *  el `<input type="date">` de la ficha. */
function aIsoUtc(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T00:00:00.000Z`;
}

function formatearCorta(d: Date): string {
  const hoy = aMedianoche(new Date());
  const dia = aMedianoche(d);
  const diff = Math.round((dia.getTime() - hoy.getTime()) / 86400000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'mañana';
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/**
 * Resuelve el trozo de fecha. Devuelve `null` si no se entiende: entonces el
 * texto se queda en el título en vez de desaparecer, que es lo importante — un
 * `*loquesea` mal escrito no puede tragarse una palabra en silencio.
 */
export function resolverFecha(texto: string, ahora = new Date()): Date | null {
  const t = texto.toLowerCase().trim();
  const hoy = aMedianoche(ahora);

  if (t === 'hoy') return hoy;
  if (t === 'mañana' || t === 'manana') return new Date(hoy.getTime() + 86400000);
  if (t === 'pasado') return new Date(hoy.getTime() + 2 * 86400000);

  // *+3d / *+2s (semanas)
  const rel = t.match(/^\+(\d+)([ds])$/);
  if (rel) {
    const n = Number(rel[1]);
    return new Date(hoy.getTime() + n * (rel[2] === 's' ? 7 : 1) * 86400000);
  }

  // Día de la semana: el PRÓXIMO que venga (nunca hoy — "el martes" dicho un
  // martes significa el que viene, no dentro de un rato).
  if (DIAS.includes(t)) {
    const objetivo = DIA_INDICE[t];
    if (objetivo === undefined) return null;
    let delta = (objetivo - hoy.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    return new Date(hoy.getTime() + delta * 86400000);
  }

  // 20/7 o 20/7/2026
  const dm = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (dm) {
    const [, d, m, a] = dm;
    const anio = a ? Number(a) : hoy.getFullYear();
    const fecha = new Date(anio, Number(m) - 1, Number(d));
    if (fecha.getMonth() !== Number(m) - 1) return null; // 31/2 y compañía
    // Sin año: si ya pasó, se entiende el que viene.
    if (!a && fecha < hoy) fecha.setFullYear(anio + 1);
    return fecha;
  }

  // ISO
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const fecha = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(fecha.getTime()) ? null : fecha;
  }

  return null;
}

/**
 * Parsea la línea de captura. NO muta nada: devuelve el título limpio y los
 * trozos entendidos para que la interfaz los enseñe y permita descartarlos.
 *
 * `descartados` son ids de trozos que el usuario ya quitó: su texto vuelve al
 * título tal cual estaba.
 */
export function parsearCaptura(entrada: string, descartados: Set<string> = new Set()): Parseado {
  const trozos: TrozoParseado[] = [];
  let n = 0;

  // Un solo barrido: cada símbolo con su palabra pegada (sin espacios).
  const RE = /(^|\s)([!+#@*])([^\s]+)/g;
  const consumidos: Array<[number, number]> = [];

  for (const m of entrada.matchAll(RE)) {
    const espacio = m[1] ?? '';
    const simbolo = m[2];
    const palabra = m[3];
    if (!simbolo || !palabra) continue;
    const inicio = (m.index ?? 0) + espacio.length;
    const fin = inicio + simbolo.length + palabra.length;
    const id = `${simbolo}${palabra}#${n++}`;
    if (descartados.has(id)) continue;

    let trozo: TrozoParseado | null = null;
    switch (simbolo) {
      case '!': {
        const p = PRIORIDADES[palabra];
        if (p) trozo = { id, tipo: 'prioridad', crudo: `!${palabra}`, etiqueta: `!${palabra} ${p.palabra}`, valor: p.valor };
        break;
      }
      case '#':
        trozo = { id, tipo: 'etiqueta', crudo: `#${palabra}`, etiqueta: `#${palabra}`, valor: palabra };
        break;
      case '@':
        trozo = { id, tipo: 'asignado', crudo: `@${palabra}`, etiqueta: `@${palabra}`, valor: palabra };
        break;
      case '+':
        trozo = { id, tipo: 'tablero', crudo: `+${palabra}`, etiqueta: `→ ${palabra}`, valor: palabra };
        break;
      case '*': {
        const f = resolverFecha(palabra);
        // Si no se entiende, NO se consume: el texto se queda en el título.
        // OJO con la zona horaria: `resolverFecha` devuelve medianoche LOCAL y su
        // `toISOString()` retrocede un día al este de Greenwich (medianoche del 7
        // en CEST son las 22:00 del 6 en UTC). El selector de fecha de la ficha
        // guarda medianoche UTC (`new Date('2026-08-07')`), así que se emite lo
        // mismo o los dos caminos guardarían días distintos.
        if (f) trozo = { id, tipo: 'fecha', crudo: `*${palabra}`, etiqueta: formatearCorta(f), valor: aIsoUtc(f) };
        break;
      }
    }

    if (trozo) {
      trozos.push(trozo);
      consumidos.push([inicio, fin]);
    }
  }

  // Quitar del título lo consumido, de atrás hacia delante para no mover índices.
  let titulo = entrada;
  for (const [i, f] of consumidos.reverse()) {
    titulo = titulo.slice(0, i) + titulo.slice(f);
  }

  return { titulo: titulo.replace(/\s+/g, ' ').trim(), trozos };
}

/** Traduce los trozos al cuerpo que espera `POST /projects/cards`. */
export function trozosAPayload(
  trozos: TrozoParseado[],
  resolverTablero: (nombre: string) => string | null,
  resolverUsuario: (nombre: string) => string | null,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const tags: string[] = [];
  const asignados: string[] = [];

  for (const t of trozos) {
    if (t.tipo === 'prioridad') body.priority = t.valor;
    else if (t.tipo === 'fecha') body.due_date = t.valor;
    else if (t.tipo === 'etiqueta') tags.push(t.valor);
    else if (t.tipo === 'asignado') {
      const id = resolverUsuario(t.valor);
      if (id) asignados.push(id);
    } else if (t.tipo === 'tablero') {
      const id = resolverTablero(t.valor);
      if (id) body.board_id = id;
    }
  }

  if (tags.length) body.tags = tags;
  if (asignados.length) body.assignee_ids = asignados;
  return body;
}
