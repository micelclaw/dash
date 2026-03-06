import { useEffect, useRef } from 'react';

interface WaveformProps {
  analyser: AnalyserNode | null;
  active: boolean;
  width?: number;
  height?: number;
}

const WAVE_COLOR = '#d4a017';
const BG_COLOR = 'transparent';

export function Waveform({ analyser, active, width = 280, height = 60 }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser || !active) {
      // Draw flat line when not active
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          ctx.strokeStyle = 'var(--border)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, height / 2);
          ctx.lineTo(width, height / 2);
          ctx.stroke();
        }
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      analyser!.getByteTimeDomainData(dataArray);

      ctx!.fillStyle = BG_COLOR;
      ctx!.clearRect(0, 0, width, height);

      ctx!.lineWidth = 2;
      ctx!.strokeStyle = WAVE_COLOR;
      ctx!.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);
        x += sliceWidth;
      }

      ctx!.lineTo(width, height / 2);
      ctx!.stroke();
    }

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, active, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        width: '100%',
        height,
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface)',
      }}
    />
  );
}
