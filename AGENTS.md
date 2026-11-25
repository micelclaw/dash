# Micelclaw Dash

This is the portable, versioned Codex contract for Dash.

- Dash is the React/Vite frontend for Micelclaw Core. Preserve the documented
  Core contract and do not guess backend fields or add raw API fallbacks.
- Al añadir, modificar o retirar ajustes configurables, seguir el
  [contrato de extensión de configuración](../micelclaw-os/docs/reference/configuration-extension-contract.md)
  y actualizar sus controles/contratos de cobertura junto al cambio de Core.
- Use the package scripts for build, lint and E2E work; cross-repo E2E tests live
  in `../tests/dash`.
- Preserve the linked `@micelclaw/mail-admin-ui` sibling-repo workflow.
- Antes de crear o rediseñar una experiencia, consultar ampliamente a Víctor
  sobre usos, funciones, interacción, apariencia, idioma, integración y límites,
  y confirmar alcance/diseño antes de implementar. En apps de terceros, acordar
  qué conservar, adaptar o excluir. Reutilizar respuestas previas, investigar
  lo técnico y no suplir decisiones de producto con preferencias del agente.
  No obliga a reabrir acuerdos ni cada detalle técnico rutinario autorizado.
- Desarrollo compartido por defecto (Víctor, 13/11/2026): trabajar en los
  checkouts de desarrollo acordando archivos con S01, que implementa e integra
  continuamente para llevar las mejoras al entorno habitual. Conservar cambios
  ajenos. No preparar instalaciones completas ni sus contenedores/paquetes por
  cada entrega: sólo S01, por petición expresa de Víctor coordinada por S00.
  Los builds y pruebas necesarios no implican reinstalar ni amplían permisos
  operativos. Distinguir cambios integrados de los cargados y comprobados.
- Use the nested guidance in `src/services`, `src/stores`, `src/hooks`,
  `src/components` and `src/modules` for API/UI-specific work.
- The Micelclaw Gateway is a Dash module, not the upstream OpenClaw Control UI.
  For a Gateway/Models capture or provider catalog, first read
  the [workspace bootstrap](../micelclaw-os/docs/reference/codex-bootstrap.md),
  then begin in `src/modules/gateway/`. See the [models reference](docs/gateway/models.md).
- Do not change unrelated worktree files, generated `dist/` content or secrets.
- Verify claims and state the validation actually run. Require approval for push,
  publishing and external side effects.

## Planificación de implementaciones

- Antes de preparar o revisar un plan, lee y aplica
  la [skill de planificación](../micelclaw-os/codex-skills/micelclaw-impact-planner/SKILL.md), que enlaza el
  protocolo y la plantilla canónicos. Investiga relaciones en código antes de
  diseñar tareas; vincula impactos, tareas y verificaciones.
- Plan breve si el alcance local está comprobado; matriz y revisión independiente
  para planes transversales. Incluye wireframes ASCII si cambia la interfaz.
- Si el checkout de Micelclaw OS u otro consumidor no está disponible, declara
  esa parte pendiente; no afirmes compatibilidad sin investigarla. Al ejecutar,
  revalida el código de partida y revisa dependencias nuevas antes de modificarlas.

## Procedencia de entidades

- Reutiliza `SourceBadge`/`EntitySource` (y `PhotoSource` en miniaturas) en nuevos
  dominios. [Contrato de procedencia](../micelclaw-os/docs/reference/entity-origins.md).
- Conserva `origins` en adaptadores, tipos, escrituras/Undo y mezclas de estado;
  su ausencia no prueba origen local. No infieras marcas por nombre o protocolo.
- Tras cambiar identidad o conexiones, invalida consumidores montados mediante
  `useOriginRefresh`; refresca también detalles, búsquedas e hilos abiertos.

## Mensajería mínima entre sesiones (Víctor, 16/11/2026)

- Reducir al mínimo los mensajes, también en S00. Enviar sólo bloqueos reales,
  cruces de archivos o permisos, decisiones necesarias y una entrega consolidada.
  Los avances rutinarios quedan en el seguimiento existente, sin avisos repetidos.
- Dirigir la coordinación a S00; no duplicar el mismo aviso en varios chats.
  Un aviso breve indica destinatario, acción necesaria y referencia. No pedir
  confirmaciones de recepción ni responder con otro aviso si no cambia nada.
- Antes de enviar, comprobar que el asunto sigue pendiente. Agrupar novedades
  del mismo tema; no mandar por separado inicio, progreso y cierre de una prueba.
- S00 clasifica, agrupa y entrega; no resuelve técnicamente cada mensaje. STEER
  sólo para un bloqueo actual o un cruce urgente; lo demás espera un momento útil.
- S00 puede consolidar avisos automáticos obsoletos o duplicados conservando
  copia y las decisiones vigentes. No borrar instrucciones ni aprobaciones humanas.
  La recepción de un aviso no acredita ejecución ni amplía permisos operativos.
