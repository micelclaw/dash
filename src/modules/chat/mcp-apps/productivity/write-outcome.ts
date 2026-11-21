/** A request may already execute later. Keep its draft and require a read before any new submission. */
export class UnconfirmedWriteError extends Error {
 constructor(kind: 'approval' | 'provider' | 'unknown') {
  super(kind === 'approval'
   ? 'La operación espera tu aprobación en la tarjeta del chat. Si la apruebas se ejecutará automáticamente; no vuelvas a enviarla. Tu borrador sigue aquí.'
   : kind === 'provider'
    ? 'El proveedor todavía no ha confirmado el cambio. Consulta su estado antes de volver a enviarlo. Tu borrador sigue aquí.'
    : 'No se pudo confirmar el guardado. Puede haberse recibido: consulta el resultado antes de volver a enviarlo. Tu borrador sigue aquí.');
  this.name = 'UnconfirmedWriteError';
 }
}
