import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface Props {
  value: string;
  size?: number;
}

export function QrCodeDisplay({ value, size = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).catch(() => {
      // ignore render errors
    });
  }, [value, size]);

  if (!value) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{ borderRadius: 'var(--radius-sm)', imageRendering: 'pixelated' }}
    />
  );
}
