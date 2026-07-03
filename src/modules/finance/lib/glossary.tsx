/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see LICENSE. https://micelclaw.com
 */

// Glosario de jerga financiera (tooltips para no-contables), COMPARTIDO por las tres
// lentes. Antes vivía solo en contabilidad/shared.tsx; ahora Personal y Facturación
// también pueden aclarar sus términos (EBITDA, IRPF, amortización…). SSOT aquí.

import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

export const GLOSSARY: Record<string, string> = {
  // — Contabilidad —
  asiento: 'Un apunte en el libro de contabilidad. Siempre tiene dos lados que suman lo mismo (Debe y Haber).',
  debe: 'El lado izquierdo de un asiento. Sube el dinero que tienes o lo que gastas.',
  haber: 'El lado derecho de un asiento. Sube lo que ingresas o lo que debes.',
  mayor: 'El historial de movimientos de UNA cuenta concreta, con su saldo acumulado.',
  diario: 'La lista de todos los asientos en orden de fecha (el "diario de a bordo" de la contabilidad).',
  sumas_y_saldos: 'Un resumen con el total del Debe y del Haber de cada cuenta. El total del Debe debe ser igual al del Haber.',
  balance: 'Foto del patrimonio en una fecha: lo que tienes (Activo) frente a lo que debes y tu capital (Pasivo + Patrimonio).',
  resultados: 'Ingresos menos gastos del periodo. Si sale positivo, hay beneficio.',
  cuadre: 'Que el Debe sea igual al Haber. Un asiento que no cuadra no se puede guardar.',
  postable: 'Una cuenta "agrupadora" no admite apuntes directos; solo sirve para sumar sus subcuentas.',
  retencion: 'Parte del importe que se adelanta a Hacienda a cuenta del IRPF (en facturas de profesionales o alquileres).',
  ejercicio: 'El año contable. Al cerrarlo se calcula el resultado y se bloquea para no tocarlo.',
  regularizacion: 'Asiento de cierre que lleva ingresos y gastos a la cuenta de Resultado del ejercicio (129).',
  // — Facturación / Rendimiento —
  ebitda: 'Lo que gana tu negocio con su actividad, antes de restar amortizaciones, intereses e impuestos. Mide el pulso operativo.',
  ebit: 'EBITDA menos las amortizaciones. El beneficio de la actividad una vez descontado el desgaste de tus bienes.',
  amortizacion: 'Repartir el coste de un bien duradero (maquinaria, software) a lo largo de los años que lo usas, en vez de todo de golpe.',
  irpf: 'Impuesto sobre la renta. En facturas a/de profesionales o alquileres, una parte (la retención) se adelanta a Hacienda.',
  retenciones_recuperar: 'IRPF que tus clientes te retuvieron y adelantaron a Hacienda por ti. Lo recuperas en tu declaración.',
  impuesto_sociedades: 'Impuesto sobre el beneficio de la empresa (tipo general 25%). Se calcula sobre el resultado antes de impuestos.',
  seguridad_social: 'Cotizaciones de la empresa por sus trabajadores. Es coste de personal (gasto operativo), NO un impuesto.',
  escudo_fiscal: 'Ahorro estimado de impuestos que te da un gasto deducible (p. ej. la amortización): reduce el beneficio sobre el que pagas.',
  cogs: 'Coste de lo vendido: lo que te costó a ti la mercancía que has vendido. Se resta de las ventas para saber el margen.',
  // — Personal —
  movimiento: 'Cada entrada o salida de dinero de tus cuentas. Por debajo es un asiento contable simplificado.',
  patrimonio: 'Lo que tienes menos lo que debes. Tu riqueza neta.',
  tasa_ahorro: 'Qué parte de tus ingresos consigues no gastar. Ahorro ÷ ingresos del periodo.',
  categoria: 'Etiqueta para agrupar ingresos y gastos (Comida, Nóminas, Ventas…) y ver en qué se va o de dónde viene el dinero.',
};

/** Icono de ayuda con tooltip de glosario. `k` = clave de GLOSSARY (si no existe, no pinta nada). */
export function Tip({ k }: { k: keyof typeof GLOSSARY | string }) {
  const text = GLOSSARY[k as string];
  if (!text) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" tabIndex={-1} className="inline-flex align-middle text-[var(--text-dim)] hover:text-[var(--text)]" aria-label="¿Qué es esto?">
            <HelpCircle size={13} />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-snug">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
