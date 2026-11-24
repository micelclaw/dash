---
doc_type: plan
status: implemented
created: 2026-11-17
updated: 2026-11-24
---

> Contraste documental puntual: 2026-11-24; sin prueba del entorno habitual.

# MicelHub: recorrido de aplicaciones y presentación común (S11)

> **Contraste posterior de fuente, sin ejecución:** este documento registra decisiones y resultados de S11 en su fecha; este contraste no
> modifica las decisiones. La rama de inventario sin fila DB disponible para el cruce
> construye un manifiesto
> sintético con `verified`, `free` y `0.0.0`; eso no acredita procedencia ni plan
> real y contradice la intención de no inferirlos. La medición de tamaño excluye
> rutas/extensiones personales conocidas, enlaces y archivos con múltiples enlaces,
> pero no demuestra que todos los demás archivos pertenezcan al paquete. La retirada
> física se hace por pasos y por archivo: un error puede dejar efectos parciales pese
> al fallo de respuesta. S01/S03 deben revisar estos límites; no se ha probado el
> entorno cargado ni se ha retirado contenido.


## Alcance aprobado y evidencia

Víctor aprueba implementar Registro → Disponibles → Instaladas → Asignadas,
cabecera común en los tres catálogos, una acción principal por vista, tamaño
instalado, colores Office y mejora visual de Taller. Mantener filtros existentes
por botones: **sin ordenación por tamaño ni nuevos filtros**. Integrar Adaptadas
en los catálogos según estado, con edición/copias accesibles desde Taller.
Plugins y la distribución de Asignadas se conservan.

Modalidad transversal: Dash, contratos aditivos de Core y metadatos del repo
público. Aprobación de producto en la conversación S11; no autoriza publicación,
push, reinicios ni escrituras de pruebas en aplicaciones reales.

Base inspeccionada (árboles compartidos, con cambios previos):

- Dash HEAD `bbf8f9a89ca2afc6a341399edbb8486791d24df1`.
- Core HEAD `543d9330f464145acce96ecd16ba62eaed8e5a86`.
- Registry HEAD `a73bedaab987a23ed592c96ce99a8933de76b329`, limpio al inspeccionar.
- Los archivos MicelHub, rutas apps y aplicaciones Office ya contienen cambios
  locales ajenos; conservarlos. No tratar HEAD como representación del trabajo.
- Bootstrap, AGENTS de cada consumidor, protocolo/plantilla de implementación,
  MAP/índice y arquitectura de apps consultados. Revisión estática previa por dos
  agentes: ciclo/contratos y presentación/Office/Taller.

Fuentes: `MicelHubPage`, `RegistryBrowser`, `AppCard`, `AppListRow`, `AppDetail`,
`registry.store`, `public-registry.service`; Core `routes/apps`,
`routes/app-public-registry`, `apps/public-registry`, `app-display.service`;
`registry/catalog.json` y sus generadores.

Diagnóstico de la base inspeccionada antes de la implementación descrita más abajo:
descarga pública hace integridad, procedencia y
análisis y guarda `.claw`/metadatos; NO crea fila installed_apps. Disponibles
consulta installed_apps y skills.status: hoy no recoge la descarga. POST install
con activate:true activa. PATCH available desactiva sin retirar código. DELETE
purge puede borrar datos: no usarlo para el nuevo flujo. Dos botones del detalle
dicen Desinstalar pero ejecutan operaciones distintas. Featured oculta por defecto
las destacadas. No hay tamaño instalado ni progreso real en el contrato actual.

## Relaciones, cambios y conservación

| ID | Productor → consumidor | Decisión / tarea | Verificación |
|---|---|---|---|
| I01 | catálogo público → store → Registro | T1 metadatos opcionales v1, T2 solo público; sin catálogo público incrustado en búsquedas locales | V1, V2 |
| I02 | descarga Core → inventario local → Disponibles | T1 progreso real; T2 mezclar inventario sin activar, salto y selección exacta | V1, V3 |
| I03 | .claw local → POST install → apps/skills/ui-modules | T2 conservar instalación explícita y actualizaciones; nunca instalar por descargar | V3 |
| I04 | PATCH available → retirada de archivos → reinstalación | T1 flag remove_files conservador para registry con paquete exacto; no purge; preservar datos y fuentes compartidas | V4 |
| I05 | archivos propios → medición Core → tarjeta/lista/detalle | T1 tamaño opcional real; T3 presentación MB sin ordenar | V4, V5 |
| I06 | cabecera/filtros → tres catálogos | T2 misma cabecera, filtros iniciales sin restricción, Featured coherente; móvil adaptable | V2, V5 |
| I07 | Card/List/Detail → acciones de ciclo | T3 presentación compartida y callback único contextual; quitar scan/export/fork del pie principal | V3, V5 |
| I08 | adaptadas/copias → catálogos y Taller/editor | T2 integrar por estado, trasladar acceso editor/copias a Taller sin perder borradores del editor | V2, V5 |
| I09 | display app/manifest → AppIcon/chips/Asignadas/Office | T2 blanco/verde/amarillo/rojo por identidad Office, resolver color del módulo y display | V5 |
| I10 | Workshop → biblioteca/equipo/aprendidas | T3 superficies, jerarquía y contraste; conservar operaciones/revisiones/permisos | V5 |
| I11 | roles/actor → stores/rutas | conservar admin/owner para ciclo de instalación/descarga e inventario local y usuario autenticado para público; las asignaciones siguen la propiedad del agente y las políticas de su ruta; limpiar estado al cambiar actor | V1, V3 |

No cambia esquema DB, configuración, defaults, tools, políticas,
infraestructura ni dependencias instaladas. Las dependencias de una app mantienen
su flujo existente; no se rediseña Plugins. Cache de progreso temporal acotada,
sin secretos ni estado duradero. Errores visibles y reintento sin falso éxito.

## Contratos y límites

- Catálogo schema_version 1 admite metadatos opcionales `author`, `origin`,
  `tier_required`, `icon`, `icon_kind`, `color`, `tags`. Catálogos antiguos siguen
  funcionando; no inferir Verified/Featured ni plan si falta información.
  Compatibilidad con Core antiguo estricto: el catálogo público principal queda
  intacto. Los campos se publican en companion `catalog-display.json` de URL fija,
  versionado/limitado y ligado por nombre+versión+SHA256 del paquete. Core nuevo
  lo combina solo para presentación; timeout corto/cache y fallback ante errores.
- GET admin `/apps/registry/download-progress?name&version` devuelve data nula
  o `{name,version,phase,received_bytes,total_bytes,error_code?}`. Fases downloading,
  checking, ready, failed. POST download conserva su respuesta bloqueante.
- El inventario local se adapta en Dash a aplicaciones disponibles sin POST
  activate:false (la rama L1 puede materializar skill). Identidad nombre+versión;
  una versión ya activa no aparece duplicada como recién descargada.
- Tamaño `installation_size_bytes: number|null`: archivos propios dentro de raíces
  autorizadas, sin seguir symlinks, sin datos/volúmenes/imágenes compartidas.
  GET `/apps/storage?names=a,b` sirve inventario L1 sin fila; data array con
  nombre/tamaño. No duplicar medición en GET apps.
  Desconocido se muestra como tal, nunca 0 ficticio.
- PATCH `{status:'available',remove_files:true}` solo retira archivos reinstalables
  del paquete exacto registry y comprobados; conserva archivos modificados/ajenos,
  datos y rutas compartidas. Desactivar preinstaladas no borra Core/OpenClaw.
  La reinstalación no debe borrar carpetas con datos residuales. Mantener contrato
  PATCH antiguo cuando falta el flag. No ejecutar ninguna desinstalación real.
- Antes de retirar archivos: verificar paquete exacto y parada confirmada;
  reintento idempotente aunque status ya sea available. Reinstalar comprueba
  ancestros sin symlinks y devuelve conflicto antes de tocar archivos modificados.
- Al incorporar adaptadas/Studio conservar manifest, versión, ruta y plan reales
  de DB; no reconstruir Free/Verified/0.0.0. Adaptadas tienen origen Tuya.
- Mantener ambas versiones si una está instalada y otra recién descargada.
  Navegar únicamente tras POST exitoso e inventario confirmado, nunca por un
  progreso ready antiguo. Ignorar respuestas tardías al cambiar de actor.
- Editar/copiar desde Taller debe respetar el borrador dirty de biblioteca.
- Completar validador manifest free/pro/plus, sin cambiar gates de licencia.
- Catálogo público: cambiar metadatos de presentación, nunca modificar releases
  inmutables ni sus archivos/hash para incorporar colores.
- La barra muestra bytes/porcentaje durante descarga, estado de comprobación sin
  porcentaje fingido después. Análisis automático también en Verified.
- Importar .claw se traslada a Disponibles. Edición y crear copia, a Taller.

## Wireframes acordados

```text
Registro  Disponibles  Instaladas  Asignadas  Taller  Plugins   [Buscar apps… ×]
Micelclaw OpenClaw Tuya Community | L1 L2 L3 | Free Pro Plus | Verified Featured
                                                        [Cuadrícula | Lista]
----------------------------------------------------------------------------
[icono] Aplicación                                         panel de detalle
[Origen] [Plan] [Verified/Featured]                 README | SKILL | Config
Descripción breve en dos líneas.
v1.0                                           21 MB       (solo Instaladas)
---------------------------------------
                    [Acción contextual]                   [La misma acción]
Registro: Descargar | Disponibles: Instalar | Instaladas: Desinstalar

Descargar → [barra real / Descargando] → [Comprobando] → Disponibles
Disponibles [nombre exacto ×] → solo descargada; al limpiar, catálogo completo.
Error → permanece en origen + aviso/reintento; sin salto ni instalación implícita.
Cargando → skeleton/estado; vacío → mensaje de la vista; sin permisos → consulta.

Taller
  [Mi biblioteca] [Equipo] [Aprendidas]       (estructura existente)
  tarjetas/paneles sobre superficie legible, títulos y metadatos jerarquizados
  Tus aplicaciones: [selector] [Editar archivos] / Crear copia desde [selector]

Móvil: pestañas desplazables; buscador ancho completo; mismos filtros por botones
envueltos/recogidos sin nuevos tipos; una columna de tarjetas, detalle con Volver.
```

## Tareas y propiedad

- T1 worker micelhub_core: Core public-registry/rutas apps/helper de archivos y
  pruebas; primero contratos, después medición/progreso/retirada segura.
- T2 S11 raíz: MicelHubPage, RegistryBrowser, servicios/stores/tipos, AppIcon/Office,
  metadatos y generadores Registry. Conservar cambios ajenos e IDs antiguos.
- T3 worker micelhub_surfaces: AppCard/List/Detail, presentación compartida y
  Workshop/Library/Learned. Props catalogView + primaryAction suministrada por T2.
- Revisor independiente: contrastar este plan antes de habilitar ediciones y
  revisar contratos de retirada/reinstalación y consumidores de metadatos.

## Verificación prevista

- V1 Core: node --import tsx --test tests específicos public-registry/rutas/helper;
  bytes reales, fases, fallos, auth admin/usuario y compatibilidad catálogo antiguo.
- V2 contratos Dash: ocho estados relevantes de navegación, pestañas nuevas,
  filtros, adaptadas, biblioteca y ausencia de resultados públicos en locales.
- V3 contratos: descargar sin instalar, salto exacto, progreso/check/error,
  instalar explícitamente, desinstalar una vez, refresco de sidebar y actor.
- V4 helper Core con filesystem temporal propio: tamaños sin symlinks/datos,
  limpieza selectiva por hashes, datos y archivos modificados conservados,
  reinstalación sin borrado de residuales. No usar producto ni DB real.
- V5 Playwright desktop/móvil con Paco no admin para lectura; fixtures de roles
  privilegiados solo para contratos de mutaciones simuladas. Acciones de tarjeta,
  lista y detalle, colores, Taller, sin overflow y sin controles de ordenar tamaño.
- Lint de archivos afectados, typecheck/build Dash y comprobación Core acotada.
  Si falla por cambios previos ajenos, registrar y comprobar empaquetado pertinente.

En el momento de redactar el plan estas pruebas aún no estaban ejecutadas; el resultado
posterior está más abajo. No equiparar fixtures a integración runtime real.

## Activación, reversión y revisión

Preparar código y validar no carga automáticamente cambios Core. Sin reiniciar
Core/Gateway ni publicar Registry. El catálogo remoto solo cambia después del
push autorizado correspondiente; indicar esta limitación en la entrega.
Reversión localizada de los deltas propios; sin reset de árboles compartidos ni
migraciones. Mantener .claw y datos al retirar la UI.

Revisión independiente por `micelhub_plan_check`, solo lectura, contrastó
productores, contratos y consumidores. Hallazgos incorporados arriba: parada y
reintento, merge seguro, manifest DB, versiones, borradores, Plus y catálogo.
Plan revisado y habilitado para implementar dentro de ese alcance. Evidencia
mínima y capturas finales en
`_artifacts/{scratch,screenshots/inbox}/s11-micelhub-20261117/`; retirar builds,
capturas intermedias y resultados propios prescindibles al cerrar.

## Resultado de implementación y revisión

Implementado el recorrido, cabecera/filtros compartidos y presentación contextual.
Disponibles incorpora paquetes locales sin activarlos y conserva identidades por
nombre+versión. Adaptadas mantiene metadatos reales y edición/copias en Taller.
No se añadió ordenación por tamaño ni filtros nuevos. Plugins conserva su UI y
Asignadas conserva distribución/operaciones, con la paleta Office corregida.

V1/V4: 26 subtests Core ejecutados y pasados (13 catálogo/progreso/companion,
3 autorización, 8 filesystem/Plus, 1 recorrido de handlers con filesystem real y
DB/Docker simulados, 1 regresión Office). Revisor independiente encontró tres
ajustes, corregidos y reensayados: conservar bits ejecutables sin bits especiales,
bloquear retirada física per_user sin parada comprobable y publicar todas las
copias desde temporal para permitir reintentos. Segunda lectura cerró los tres.

V2/V3/V5: ocho casos únicos de contratos de interfaz comprobados entre ejecuciones:
primera 5 passed + 2 selectores del harness corregidos + 1 interrumpido; regresión
de los tres afectados 3/3; reensayo de instalación/desinstalación con recarga 1/1.
No presentar esa secuencia como una única ejecución 8/8. APIs simuladas, Paco
usuario para lectura/visual y fixtures privilegiadas solo para mutaciones.
Capturas inspeccionadas de cuadrícula/lista a 1440, 390 y 320, Asignadas y Taller.

Lint de fuentes afectadas: 0 errores y 23 avisos de efectos/memoización/fetch.
Empaquetado Vite pasó. Build oficial de
Dash encontró un error ajeno de tipos en Gateway; Core tuvo un typecheck completo
limpio durante el trabajo y el último quedó afectado por cambios ajenos de
Storage/VPN. El estado final y comandos se registran en la evidencia S11.

Companion local validado: cinco registros coinciden con nombre, versión y hash
de los paquetes inmutables. Fuente n8n 0.1.1 comprobada por SHA-256 para no usar
el manifest local 0.1.0. `catalog.json` original permanece intacto. Sin badges
Verified/Featured inferidos, sin repaquetar releases y sin publicar.

Código en checkouts compartidos; carga en producto habitual no acreditada por
estas pruebas. No se reinició Core/Gateway ni se modificaron aplicaciones reales.
Empaquetado Vite final del delta completo: exit0. Build oficial final bloqueado
por Gateway indicado. Retirados build y archivo fuente temporal; conservadas
ocho capturas y evidencia pequeña hasta integración/aceptación.

### Ajuste posterior: tres filtros de origen

Víctor pide retirar únicamente el filtro «Tuya». Cambio local de presentación y
filtrado: conservar los distintivos de las aplicaciones, agrupar las propias bajo
Community al filtrar y mantener visibles todas inicialmente. Sin cambios de API.

```text
[Micelclaw] [OpenClaw] [Community] | [L1] [L2] [L3] | ...
```

Usar una lista común para controles, selección inicial, restablecimiento tras
descarga y detección de catálogo sin restricción. Actualizar el contrato de
cabecera y verificar las aplicaciones propias/los metadatos de origen ausentes.
Verificación del ajuste: lint de los dos archivos sin errores; comprobaciones
directas del filtrado pasadas (propias visibles inicialmente y bajo Community,
excluidas al filtrar solo Micelclaw; origen desconocido visible sin restricciones).
Contrato de cabecera actualizado; no se repitió el recorrido completo de navegador.

### Ajuste posterior: indicador de estado en Registro

Mostrar el estado de la misma versión que determina el pie de la tarjeta:

```text
● gris     [icono] Aplicación   → Descargar
● amarillo [icono] Aplicación   → Descargada
● verde    [icono] Aplicación   → Instalada
```

Cambio local de frontend: pasar el estado estructurado junto con la acción,
sin inferirlo de textos traducidos ni alterar los estados de las demás pestañas.
Verificado con renderizado real de AppCard para los tres estados; colores y
estado estructurado correctos. Lint de los tres archivos sin errores. Sin
artefactos temporales ni cambios de backend.
