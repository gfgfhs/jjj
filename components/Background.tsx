import React, { useRef, useEffect } from 'react';

const Background: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', resize);
    resize();

    // Nebula Plasma Shader Effect
    const draw = () => {
      ctx.fillStyle = '#020205'; // Deep void black
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const scale = Math.max(width, height) / 800;

      // Layered waves
      for (let i = 0; i < 3; i++) {
        const t = time * 0.5 + i * 10;
        
        const gradient = ctx.createRadialGradient(
            cx + Math.sin(t * 0.3) * 200 * scale,
            cy + Math.cos(t * 0.4) * 150 * scale,
            0,
            cx,
            cy,
            width * 0.8
        );

        // Dynamic Palette based on time
        const hue1 = (time * 10 + i * 60) % 360;
        const hue2 = (hue1 + 180) % 360;

        gradient.addColorStop(0, `hsla(${hue1}, 70%, 50%, 0.15)`);
        gradient.addColorStop(0.5, `hsla(${hue2}, 60%, 40%, 0.05)`);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = 'screen'; // Blend mode for glowing effect
        ctx.beginPath();
        ctx.arc(cx, cy, width, 0, Math.PI * 2);
        ctx.fill();
      }

      // Floating Particles
      ctx.globalCompositeOperation = 'source-over';
      const particleCount = 40;
      for (let i = 0; i < particleCount; i++) {
          const x = (Math.sin(i * 132.1 + time * 0.1) * 0.5 + 0.5) * width;
          const y = (Math.cos(i * 45.3 + time * 0.15) * 0.5 + 0.5) * height;
          const size = (Math.sin(time + i) + 2) * 2;
          const alpha = (Math.sin(time * 2 + i) + 1) / 2 * 0.5;
          
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
      }

      // Noise texture overlay
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
          if (Math.random() > 0.92) {
            const noise = (Math.random() - 0.5) * 15;
            data[i] += noise;
            data[i+1] += noise;
            data[i+2] += noise;
          }
      }
      ctx.putImageData(imageData, 0, 0);

      time += 0.005;
      requestAnimationFrame(draw);
    };

    const animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <canvas 
        ref={canvasRef} 
        className="fixed top-0 left-0 w-full h-full -z-10"
      />
      {/* Vignette & CRT Overlay */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-5 crt-screen">
        <div className="w-full h-full scanlines opacity-20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.9)_100%)]"></div>
      </div>
    </>
  );
};

export default Background;