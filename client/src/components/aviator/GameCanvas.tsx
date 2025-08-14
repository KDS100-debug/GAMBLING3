import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface GameCanvasProps {
  gameStatus: 'betting' | 'flying' | 'crashed';
  multiplier: number;
  showCrashEffect?: boolean;
  className?: string;
}

export function GameCanvas({ 
  gameStatus, 
  multiplier, 
  showCrashEffect = false,
  className 
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [planePosition, setPlanePosition] = useState({ x: 50, y: 300 });
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (gameStatus === 'flying') {
      startFlightAnimation();
    } else if (gameStatus === 'crashed') {
      crashAnimation();
    } else {
      resetPlane();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameStatus, multiplier]);

  const startFlightAnimation = () => {
    const animate = () => {
      setPlanePosition(prev => {
        const progress = Math.min(multiplier / 10, 1);
        const x = 50 + (progress * 300);
        const y = 300 - (progress * 200);
        return { x, y };
      });
      
      if (gameStatus === 'flying') {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    animate();
  };

  const crashAnimation = () => {
    const animate = () => {
      setPlanePosition(prev => ({
        x: prev.x + 50,
        y: prev.y + 100
      }));
    };
    animate();
  };

  const resetPlane = () => {
    setPlanePosition({ x: 50, y: 300 });
  };

  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'hsl(220, 30%, 12%)');
    gradient.addColorStop(1, 'hsl(222, 84%, 5%)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw flight path
    if (gameStatus === 'flying' || gameStatus === 'crashed') {
      ctx.beginPath();
      ctx.strokeStyle = `hsl(${multiplier >= 5 ? '0, 100%, 50%' : '120, 100%, 50%'})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      
      const progress = Math.min(multiplier / 10, 1);
      const endX = 50 + (progress * 300);
      const endY = 300 - (progress * 200);
      
      ctx.moveTo(50, 300);
      ctx.quadraticCurveTo(endX / 2, endY + 50, endX, endY);
      ctx.stroke();

      // Add glow effect
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw plane
    ctx.save();
    ctx.translate(planePosition.x, planePosition.y);
    
    if (gameStatus === 'crashed') {
      ctx.rotate(Math.PI / 4); // 45 degree rotation for crash
      ctx.filter = 'hue-rotate(180deg)';
    }

    // Plane body
    ctx.fillStyle = 'hsl(45, 100%, 50%)';
    ctx.fillRect(-15, -3, 30, 6);
    
    // Plane wings
    ctx.fillRect(-5, -8, 10, 4);
    ctx.fillRect(-5, 4, 10, 4);
    
    // Plane nose
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(20, -2);
    ctx.lineTo(20, 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Draw crash effect
    if (showCrashEffect && gameStatus === 'crashed') {
      for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.arc(
          planePosition.x + (Math.random() - 0.5) * 100,
          planePosition.y + (Math.random() - 0.5) * 100,
          Math.random() * 5 + 2,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = `hsl(${Math.random() * 60}, 100%, 50%)`;
        ctx.fill();
      }
    }
  };

  useEffect(() => {
    drawGame();
  }, [planePosition, gameStatus, multiplier, showCrashEffect]);

  return (
    <div className={cn("relative w-full h-full", className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        data-testid="game-canvas"
      />
      
      {/* Overlay elements */}
      {gameStatus === 'betting' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-muted-foreground mb-2">
              Place your bets!
            </div>
            <div className="text-sm text-muted-foreground">
              Round starting soon...
            </div>
          </div>
        </div>
      )}

      {gameStatus === 'crashed' && showCrashEffect && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="text-6xl font-bold text-neon-red neon-text-intense animate-ping">
              CRASHED!
            </div>
          </div>
        </div>
      )}
    </div>
  );
}