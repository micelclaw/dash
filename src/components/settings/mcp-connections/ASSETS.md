# Logotipos de MCP Connections

Los logotipos identifican las aplicaciones; no representan un ranking ni una
verificación del proveedor.

- Gmail y Calendar reutilizan componentes de `src/config/data-provider-icons.tsx`
  (procedencia de assets propios en `src/assets/brand-icons/ATTRIBUTION.md`). Notion
  usa `siNotion` de `simple-icons` a través de ese mismo componente.
- Drive y GitHub reutilizan `simple-icons`, dependencia existente cuya licencia local declara
  CC0-1.0; esa licencia no concede derechos sobre las marcas representadas.
- `slack.png`: recurso oficial obtenido el 2026-11-16 de
  <https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png>.
  SHA-256: `cfd9f050bf26ea547af438722c5a93be002c721f0f32a3c996595eab7af1b36d`.
  Es una marca de Slack; no se atribuye a este archivo la licencia CC0 de
  `simple-icons`. El hash local coincide; no verifica por sí solo procedencia ni fecha.

Las entradas desconocidas con nombre usan una inicial local; si `name` falta o está vacío
se usa el icono genérico. Un nombre compuesto sólo por espacios deja un recuadro sin inicial. No se descargan imágenes ni
se ejecutan SVG o HTML proporcionados por el registro.
