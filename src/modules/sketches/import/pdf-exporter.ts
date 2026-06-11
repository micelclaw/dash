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
 * Export the diagram canvas to PDF using html-to-image + jsPDF.
 */
export async function exportPdf(title: string): Promise<void> {
  const el = document.querySelector('.react-flow') as HTMLElement | null;
  if (!el) return;

  const { toPng } = await import('html-to-image');
  const { jsPDF } = await import('jspdf');

  const dataUrl = await toPng(el, {
    backgroundColor: '#111',
    pixelRatio: 2,
    filter: (node) => {
      if (node instanceof HTMLElement) {
        const cls = node.classList;
        if (cls?.contains('react-flow__minimap') || cls?.contains('react-flow__controls')) return false;
      }
      return true;
    },
  });

  // Determine orientation from canvas aspect ratio
  const rect = el.getBoundingClientRect();
  const isLandscape = rect.width > rect.height;
  const orientation = isLandscape ? 'landscape' : 'portrait';

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  const availW = pageWidth - margin * 2;
  const availH = pageHeight - margin * 2;

  // Scale to fit
  const aspectRatio = rect.width / rect.height;
  let imgW = availW;
  let imgH = imgW / aspectRatio;
  if (imgH > availH) {
    imgH = availH;
    imgW = imgH * aspectRatio;
  }

  const x = margin + (availW - imgW) / 2;
  const y = margin + (availH - imgH) / 2;

  pdf.addImage(dataUrl, 'PNG', x, y, imgW, imgH);
  pdf.save(`${title || 'diagram'}.pdf`);
}
