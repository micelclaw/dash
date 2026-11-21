const textTypes = new Set(['application/json', 'application/javascript', 'application/xml', 'application/yaml', 'application/x-yaml']);
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
export function filePreviewKind(mime: string): 'image' | 'markdown' | 'text' | null {
 if (imageTypes.has(mime)) return 'image';
 if (mime === 'text/markdown') return 'markdown';
 if (mime.startsWith('text/') || textTypes.has(mime)) return 'text';
 return null;
}
/** Only raster bytes re-encoded by Core. No remote URLs, active SVG or HTML data URLs. */
export function RasterPreview({ source, name }: { source?: string; name: string }) {
 return source && source.length <= 1_000_024 && /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(source)
  ? <img alt={name} src={source} style={{ maxWidth: '100%' }} /> : <p>No se pudo obtener una imagen compatible.</p>;
}
