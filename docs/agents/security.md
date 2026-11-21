---
doc_type: reference
status: vigente
created: 2026-10-28
updated: 2026-11-17
---

# Seguridad del agente · diseño v3 implementado

La pestaña Seguridad de los detalles de agente y Settings → Agent security
comparten el mismo editor: aislamiento del agente, comandos y estado/diagnóstico.
El resumen conserva tres aspectos: aislamiento, comandos y acceso temporal.
Comandos reúne modo, perfil asignado, reglas locales y acceso temporal. Avanzado
muestra sus controles adicionales y el diagnóstico; los avisos de discrepancia,
contratos pendientes y acceso temporal abierto siguen visibles en la principal.
El selector compacto de perfil solo asigna versiones publicadas; `allow` es la
etiqueta visible del valor interno `allowlist`.

Settings añade debajo la biblioteca compartida de perfiles: catálogo compacto y
editor inline al consultar o editar. Esta biblioteca no pertenece al agente
seleccionado y se mantiene montada al cambiarlo, incluso sin agentes disponibles.
El catálogo distingue la versión publicada del borrador más reciente. Crear,
guardar, publicar o restaurar un perfil no lo asigna automáticamente. Sus
mutaciones refrescan los metadatos del editor individual sin remontarlo; cambiar
la versión o los límites del perfil invalida la revisión y conserva el borrador.

Security tiene ocho entradas: General, Agent security, Tools & permissions,
Protections, Global isolation, Approvals, Browser safety y Security changes.
Channel commands pertenece a AI & Agents. Approvals reúne solicitudes y avisos/
destinos, con los dos guardados de entrega separados. Security changes conserva
la auditoría de políticas, distinta del historial de solicitudes.

Los IDs `security_tab=command-profiles` y `agent-execution` apuntan al mismo árbol
de página; `approval-delivery` y `action-approvals` hacen lo mismo en Approvals.
Los alias enfocan títulos estables y desplazan al bloque solicitado sin desmontar
formularios. La alineación sigue la carga inicial y se desconecta al estabilizarse
o cuando el usuario interactúa; no persigue el scroll durante el uso de la página.
Lateral, búsqueda y cabecera móvil usan la página normalizada.
Cambiar a otra página conserva el comportamiento previo de navegación de Settings;
no hay almacenamiento global nuevo de borradores.

Las interrogaciones grises abren explicaciones sencillas inline mediante clic,
toque o teclado. Enter/Espacio abre o cierra y Escape cierra sin perder foco. El
resumen abre Avanzado si es necesario y lleva el foco al título de su sección.
Los riesgos y accesos temporales abiertos, con alcance y vencimiento, permanecen
en el resumen. El perfil se asigna con un selector compacto. La reorganización
no añade pestañas internas ni pantallas auxiliares al editor del agente.

## Borrador, guardado y comprobación

Cambiar una opción prepara un borrador. Revisar presenta antes/después y el impacto
devuelto por el servidor. Guardar conserva CAS y la revisión vigente. Un conflicto
mantiene las ediciones propias, adopta los cambios de campos intactos y exige
revisión nueva. El preview se vincula a los metadatos publicados y se releen antes de guardar. La comprobación atómica de versión se envía sólo si el servidor anuncia su soporte; en el backend anterior se explica el límite de una publicación concurrente. Refrescar no guarda ni pisa una edición local. Consultar ayudas o
abrir Avanzado no escribe política ni invalida una revisión vigente.

Avanzado no se cierra con campos avanzados modificados, formularios o revisiones
abiertas. El aviso inline lleva a los cambios pendientes. En principal, Heredar
las sesiones modifica solo ese campo; el reset de tres overrides queda en Avanzado.
El PATCH de aislamiento envía solo los campos editados, conserva `none` previo y
la limpieza, y exige releer los valores antes de afirmar que se guardaron. Un 200
con valores diferentes conserva el borrador y muestra el desacuerdo.

La configuración de sandbox nunca demuestra un contenedor funcionando. La UI
muestra «Configurado» y «en uso sin comprobar». La observación de comandos debe
estar vigente y corresponder a las revisiones devueltas. Un acceso temporal activo
se presenta como ampliación de permisos, en naranja; su efectividad exige el
boolean de Core, guard cargado/sano, versión e ID activo coincidentes y vigencia.
Al fallar una lectura se pierde esa afirmación, sin convertir el registro en una
prueba de cierre. La API actual no atesta explícitamente ausencia efectiva: una
lista vacía tampoco se pinta favorable. Un entorno de proveedor requiere evidencia
propia, separada de la comprobación de comandos del equipo.

## Autoridad y compatibilidad

Se conservan límites del dueño del agente, del perfil y del actor. El rol del
visitante no redefine al dueño. Los límites globales son de consulta en el editor
individual; la biblioteca compartida de Settings conserva sus permisos propios.
Los permisos del sandbox siguen siendo los del
propietario exacto según su API. Las solicitudes temporales conservan rol, base,
guard, duración, motivo y PIN propios verificados en servidor. Revocar conserva
el contrato de acceso al agente y puede intentarse si falla la comunicación con
el runtime; su confirmación es inline y un fallo no se presenta como cierre.

Las tres opciones fallback conservan su valor persistido, con la limitación
explícita de que no se han demostrado tres conductas o avisos diferentes. El
registro de herramientas sigue siendo global; su lista pendiente no es un grant
ni demuestra asignación a este agente, incluso al mostrar el control desactivado.

## Código y validación

Fuentes: `src/modules/agents/AgentSecurity.tsx`, `AgentSandboxConfig.tsx`,
`src/modules/agents/security/`, `src/services/agent-sandbox.service.ts` y los
contratos de tipos de Security. Los consumidores son AgentDetail y
AgentExecutionPanel. El selector de agente de la vista general de Settings
conserva su función y no forma parte de los controles de esta pestaña.

Aprobación visual expresa de Víctor: revisión v3 del 28/10/2026. [Seguimiento,
comandos, capturas y límites de la ejecución S06](../../../_artifacts/scratch/agent-security-implementation-20261028/FINAL.md).
Las pruebas de mutación usan APIs de fixture con identidad Paco normal o roles
sintéticos explícitos; no alteran agentes reales ni certifican enforcement real.

La corrección backend de escritura sandbox concurrente y eliminación de overrides
se entrega separada para S01, en copia con base/resultado/parche/pruebas. No está
aplicada a Core por esta sesión y debe validarse antes de afirmar cerrado ese
riesgo. La interfaz ya conserva los valores no editados y detecta un read-back
que no coincide. [Contrato canónico de seguridad](../../../micelclaw-os/docs/reference/unified-security-approvals.md).
