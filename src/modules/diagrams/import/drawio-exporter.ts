/**
 * Export our DiagramFile format to draw.io compatible XML.
 */
import type { DiagramFile } from '../types';

// Map our shape types to draw.io styles
const STYLE_MAP: Record<string, string> = {
  rectangle: 'rounded=0;whiteSpace=wrap;html=1;',
  rounded: 'rounded=1;whiteSpace=wrap;html=1;',
  diamond: 'rhombus;whiteSpace=wrap;html=1;',
  circle: 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;',
  cylinder: 'shape=cylinder3;whiteSpace=wrap;html=1;',
  hexagon: 'shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;',
  parallelogram: 'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;',
  cloud: 'ellipse;shape=cloud;whiteSpace=wrap;html=1;',
  document: 'shape=document;whiteSpace=wrap;html=1;',
  triangle: 'triangle;whiteSpace=wrap;html=1;',
  trapezoid: 'shape=trapezoid;perimeter=trapezoidPerimeter;whiteSpace=wrap;html=1;',
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportDrawio(diagram: DiagramFile): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<mxfile>');
  lines.push('  <diagram name="Page-1">');
  lines.push('    <mxGraphModel>');
  lines.push('      <root>');
  lines.push('        <mxCell id="0"/>');
  lines.push('        <mxCell id="1" parent="0"/>');

  // Nodes
  for (const node of diagram.nodes) {
    const baseStyle = STYLE_MAP[node.type] || STYLE_MAP['rectangle']!;
    const parts = [baseStyle];
    if (node.data.color) parts.push(`strokeColor=${node.data.color}`);
    if (node.data.bgColor) parts.push(`fillColor=${node.data.bgColor}`);
    else if (node.data.color) parts.push(`fillColor=${node.data.color}`, 'fillOpacity=20');
    if (node.data.textColor) parts.push(`fontColor=${node.data.textColor}`);
    if (node.data.fontSize) parts.push(`fontSize=${node.data.fontSize}`);

    const style = parts.join(';');
    const label = escapeXml(node.data.label || '');
    const w = node.width || 120;
    const h = node.height || 60;

    lines.push(`        <mxCell id="${escapeXml(node.id)}" value="${label}" style="${style}" vertex="1" parent="1">`);
    lines.push(`          <mxGeometry x="${node.position.x}" y="${node.position.y}" width="${w}" height="${h}" as="geometry"/>`);
    lines.push('        </mxCell>');
  }

  // Edges
  for (const edge of diagram.edges) {
    const parts: string[] = [];
    if (edge.type === 'step' || edge.type === 'smoothstep') {
      parts.push('edgeStyle=orthogonalEdgeStyle');
    }
    if (edge.data?.color) parts.push(`strokeColor=${edge.data.color}`);
    if (edge.data?.strokeWidth) parts.push(`strokeWidth=${edge.data.strokeWidth}`);
    if (edge.data?.dashed) parts.push('dashed=1');

    const style = parts.join(';') + ';';
    const label = edge.label ? escapeXml(edge.label) : '';

    lines.push(`        <mxCell id="${escapeXml(edge.id)}" value="${label}" style="${style}" edge="1" parent="1" source="${escapeXml(edge.source)}" target="${escapeXml(edge.target)}">`);
    lines.push('          <mxGeometry relative="1" as="geometry"/>');
    lines.push('        </mxCell>');
  }

  lines.push('      </root>');
  lines.push('    </mxGraphModel>');
  lines.push('  </diagram>');
  lines.push('</mxfile>');

  return lines.join('\n');
}
