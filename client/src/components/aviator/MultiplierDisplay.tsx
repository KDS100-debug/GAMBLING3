import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface MultiplierDisplayProps {
  multiplier: number;
  gameStatus: 'betting' | 'flying' | 'crashed';
  isWarningZone?: boolean;
  className?: string;
}

export function MultiplierDisplay({ 
  multiplier, 
  gameStatus, 
  isWarningZone = false,
  className 
}: MultiplierDisplayProps) {
  const [displayMultiplier, setDisplayMultiplier] = useState(multiplier);
  const [animationClass, setAnimationClass] = useState("");

  useEffect(() => {
    setDisplayMultiplier(multiplier);
    
    // Trigger animation based on multiplier value
    if (gameStatus === 'flying') {
      if (multiplier >= 10) {
        setAnimationClass("animate-intense-glow text-neon-red neon-text-intense");
      } else if (multiplier >= 5) {
        setAnimationClass("animate-neon-glow text-neon-orange neon-text");
      } else if (multiplier >= 2) {
        setAnimationClass("animate-neon-glow text-neon-gold neon-text");
      } else {
        setAnimationClass("animate-neon-glow text-neon-green neon-text");
      }
    } else if (gameStatus === 'crashed') {
      setAnimationClass("text-neon-red animate-plane-crash");
    } else {
      setAnimationClass("text-muted-foreground");
    }
  }, [multiplier, gameStatus]);

  const getMultiplierColor = () => {
    if (gameStatus === 'crashed') return 'text-neon-red';
    if (gameStatus === 'betting') return 'text-muted-foreground';
    
    if (multiplier >= 10) return 'text-neon-red';
    if (multiplier >= 5) return 'text-neon-orange';
    if (multiplier >= 2) return 'text-neon-gold';
    return 'text-neon-green';
  };

  return (
    <div 
      className={cn(
        "font-mono font-bold text-center transition-all duration-300",
        "text-6xl lg:text-8xl",
        isWarningZone && "warning-zone",
        getMultiplierColor(),
        animationClass,
        className
      )}
      data-testid="multiplier-display"
    >
      {gameStatus === 'crashed' ? (
        <span className="relative">
          {displayMultiplier.toFixed(2)}x
          <div className="absolute inset-0 bg-neon-red opacity-20 blur-xl animate-ping" />
        </span>
      ) : (
        <span className="relative">
          {displayMultiplier.toFixed(2)}x
          {gameStatus === 'flying' && (
            <div className="absolute -inset-4 bg-current opacity-10 blur-lg animate-pulse" />
          )}
        </span>
      )}
    </div>
  );
}