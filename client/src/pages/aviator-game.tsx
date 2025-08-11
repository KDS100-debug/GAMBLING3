import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useWebSocket } from "@/hooks/useWebSocket";
import Navigation from "@/components/navigation";
import { ArrowLeftIcon, NotebookPen, HandIcon, UsersIcon } from "lucide-react";

interface GameState {
  roundId: string;
  status: 'betting' | 'flying' | 'crashed';
  multiplier: number;
  startTime?: string;
}

interface LivePlayer {
  userId: string;
  betAmount: number;
  status: 'active' | 'cashed_out' | 'crashed';
  cashOutAt?: number;
}

export default function AviatorGame() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [betAmount, setBetAmount] = useState(50);
  const [autoCashOut, setAutoCashOut] = useState<string>("");
  const [userBet, setUserBet] = useState<any>(null);
  const [livePlayers, setLivePlayers] = useState<LivePlayer[]>([]);
  const [lastMultipliers, setLastMultipliers] = useState<number[]>([2.34, 1.15, 5.67, 1.87, 3.21]);
  const [planePosition, setPlanePosition] = useState({ x: 0, y: 0 });
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [showCrashEffect, setShowCrashEffect] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'takeoff' | 'ascent' | 'speed' | 'warning' | 'crash'>('takeoff');
  const [flightTime, setFlightTime] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: balanceData } = useQuery({
    queryKey: ['/api/balance'],
  });

  const { sendMessage } = useWebSocket('/ws', {
    onMessage: (data) => {
      switch (data.type) {
        case 'game_state':
          setGameState(data.data);
          break;
        case 'round_started':
          setGameState({
            roundId: data.data.roundId,
            status: 'betting',
            multiplier: 1.00,
          });
          setUserBet(null);
          break;
        case 'flying_started':
          setGameState(prev => prev ? {
            ...prev,
            status: 'flying',
            startTime: data.data.startTime,
          } : null);
          setFlightTime(0);
          setAnimationPhase('takeoff');
          setShowWarning(false);
          break;
        case 'multiplier_update':
          setGameState(prev => prev ? {
            ...prev,
            multiplier: data.data.multiplier,
          } : null);
          break;
        case 'crashed':
          setShowCrashEffect(true);
          setAnimationPhase('crash');
          setGameState(prev => prev ? {
            ...prev,
            status: 'crashed',
            multiplier: data.data.multiplier,
          } : null);
          setLastMultipliers(prev => [data.data.multiplier, ...prev.slice(0, 4)]);
          if (userBet && userBet.status === 'active') {
            toast({
              title: "Plane Crashed!",
              description: `You lost ${userBet.betAmount} points at ${data.data.multiplier.toFixed(2)}x`,
              variant: "destructive",
            });
          }
          break;
        case 'bet_placed':
          // Update live players
          break;
        case 'cash_out':
        case 'auto_cash_out':
          if (data.data.userId === userBet?.userId) {
            toast({
              title: "Successful Cash Out!",
              description: `You won ${data.data.winAmount} points at ${data.data.multiplier.toFixed(2)}x`,
            });
            setUserBet((prev: any) => prev ? {
              ...prev,
              status: 'cashed_out',
              cashOutAt: data.data.multiplier,
              winAmount: data.data.winAmount,
            } : null);
            queryClient.invalidateQueries({ queryKey: ['/api/balance'] });
          }
          break;
      }
    }
  });

  useEffect(() => {
    sendMessage({ type: 'join', userId: 'user' });
  }, [sendMessage]);

  // Flight time tracking and animation phase management
  useEffect(() => {
    if (gameState?.status === 'flying') {
      const interval = setInterval(() => {
        setFlightTime((prev: number) => {
          const newTime = prev + 0.1;
          
          // Animation phase transitions based on time (frames converted to seconds)
          if (newTime <= 2) {
            setAnimationPhase('takeoff');
          } else if (newTime <= 5) {
            setAnimationPhase('ascent');
          } else if (newTime <= 10) {
            setAnimationPhase('speed');
          } else if (newTime <= 14) {
            setAnimationPhase('warning');
            setShowWarning(true);
          }
          
          return newTime;
        });
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [gameState?.status]);

  // Update plane position and animation based on current phase and multiplier
  useEffect(() => {
    if (gameState?.status === 'flying' && gameState.multiplier) {
      let baseX, baseY, speed;
      
      switch (animationPhase) {
        case 'takeoff':
          // Initial takeoff - smooth acceleration with slight upward curve
          baseX = Math.min(gameState.multiplier * 15, 100);
          baseY = Math.min(gameState.multiplier * 8, 50);
          speed = 1 + (gameState.multiplier - 1) * 0.2;
          break;
        case 'ascent':
          // Steady diagonal ascent
          baseX = 100 + Math.min((gameState.multiplier - 1) * 20, 150);
          baseY = 50 + Math.min((gameState.multiplier - 1) * 15, 80);
          speed = 1.5 + (gameState.multiplier - 1) * 0.3;
          break;
        case 'speed':
          // Steeper ascent with increased speed
          baseX = 250 + Math.min((gameState.multiplier - 2.5) * 25, 150);
          baseY = 130 + Math.min((gameState.multiplier - 2.5) * 20, 60);
          speed = 2 + (gameState.multiplier - 1) * 0.4;
          break;
        case 'warning':
          // Pre-crash jitter and instability
          const jitterX = Math.sin(flightTime * 20) * 3;
          const jitterY = Math.cos(flightTime * 15) * 2;
          baseX = 400 + Math.min((gameState.multiplier - 5) * 15, 80) + jitterX;
          baseY = 190 + Math.min((gameState.multiplier - 5) * 10, 30) + jitterY;
          speed = 2.5 + (gameState.multiplier - 1) * 0.5;
          break;
        default:
          baseX = Math.min(gameState.multiplier * 25, 450);
          baseY = Math.min(gameState.multiplier * 12, 140);
          speed = Math.max(1, gameState.multiplier * 0.3);
      }
      
      setPlanePosition({ x: baseX, y: baseY });
      setAnimationSpeed(speed);
    } else if (gameState?.status === 'betting') {
      setPlanePosition({ x: 0, y: 0 });
      setAnimationSpeed(1);
      setShowCrashEffect(false);
      setShowWarning(false);
      setFlightTime(0);
      setAnimationPhase('takeoff');
    }
  }, [gameState?.multiplier, gameState?.status, animationPhase, flightTime]);

  // Reset crash effect after animation
  useEffect(() => {
    if (showCrashEffect) {
      const timer = setTimeout(() => {
        setShowCrashEffect(false);
      }, 3000); // Show crash effect for 3 seconds
      return () => clearTimeout(timer);
    }
  }, [showCrashEffect]);

  const placeBetMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/aviator/place-bet', {
        betAmount,
        autoCashOut: autoCashOut ? parseFloat(autoCashOut) : null,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setUserBet({
        ...data.bet,
        status: 'active',
      });
      toast({
        title: "Bet Placed!",
        description: `${betAmount} points bet placed successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/balance'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Bet Failed",
        description: error.message || "Failed to place bet",
        variant: "destructive",
      });
    },
  });

  const cashOutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/aviator/cash-out');
      return response.json();
    },
    onSuccess: (data) => {
      setUserBet((prev: any) => prev ? {
        ...prev,
        status: 'cashed_out',
        cashOutAt: data.multiplier,
        winAmount: data.winAmount,
      } : null);
      toast({
        title: "Successful Cash Out!",
        description: `You won ${data.winAmount} points at ${data.multiplier.toFixed(2)}x`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/balance'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Cash Out Failed",
        description: error.message || "Failed to cash out",
        variant: "destructive",
      });
    },
  });

  const takeWinningsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/aviator/take-winnings');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Winnings Collected!",
        description: `Successfully collected ${data.winnings} points`,
      });
      setUserBet(null);
      queryClient.invalidateQueries({ queryKey: ['/api/balance'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Failed to Collect",
        description: error.message || "Failed to collect winnings",
        variant: "destructive",
      });
    },
  });

  const getStatusText = () => {
    if (!gameState) return "Connecting...";
    switch (gameState.status) {
      case 'betting':
        return "Place your bet!";
      case 'flying':
        return "Plane is flying!";
      case 'crashed':
        return "💥 Plane crashed!";
      default:
        return "Waiting...";
    }
  };

  const canPlaceBet = gameState?.status === 'betting' && !userBet;
  const canCashOut = gameState?.status === 'flying' && userBet?.status === 'active';
  const canTakeWinnings = userBet?.status === 'cashed_out' && userBet?.winAmount > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-surface to-dark">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href="/games">
            <Button variant="ghost" className="text-gray-400 hover:text-white transition-colors mb-4">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Games
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-2 text-white">Aviator ✈️</h1>
          <p className="text-gray-400">Cash out before you crash out!</p>
        </div>

        <div className="max-w-6xl">
          {/* Game Area */}
          <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-600 rounded-xl p-8 mb-6 relative overflow-hidden min-h-96">
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white opacity-10"></div>
            
            {/* Enhanced Multiplier Display with Warning System */}
            <div className="text-center mb-8 relative">
              {/* Pre-crash warning indicators */}
              {showWarning && animationPhase === 'warning' && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="animate-pulse text-red-500 font-bold text-lg absolute -top-8 left-1/2 transform -translate-x-1/2">
                    ⚠️ WARNING - CASH OUT NOW! ⚠️
                  </div>
                  <div className="absolute inset-0 border-2 border-red-500 rounded-lg animate-ping opacity-75"></div>
                </div>
              )}
              
              <div className={`text-6xl font-bold mb-2 transition-all duration-300 ${
                gameState?.status === 'flying' 
                  ? `multiplier-glow ${
                      animationPhase === 'warning' ? 'text-red-600 animate-bounce' :
                      gameState.multiplier > 10 ? 'text-red-400' : 
                      gameState.multiplier > 5 ? 'text-orange-400' : 
                      'text-green-400'
                    }`
                  : gameState?.status === 'crashed'
                  ? 'text-red-500 scale-95'
                  : 'text-white'
              }`}>
                {gameState?.multiplier?.toFixed(2) || '1.00'}x
              </div>
              
              <p className="text-blue-200">
                {animationPhase === 'takeoff' && gameState?.status === 'flying' ? '🛫 Taking off...' :
                 animationPhase === 'ascent' && gameState?.status === 'flying' ? '✈️ Steady climb...' :
                 animationPhase === 'speed' && gameState?.status === 'flying' ? '🚀 Accelerating...' :
                 animationPhase === 'warning' && gameState?.status === 'flying' ? '💥 DANGER ZONE!' :
                 gameState?.status === 'crashed' ? 'Plane crashed!' :
                 'Current Multiplier'
                }
              </p>
              
              {/* Flight Time Display */}
              {gameState?.status === 'flying' && (
                <div className="text-sm text-gray-400 mt-1">
                  Flight time: {flightTime.toFixed(1)}s
                </div>
              )}
            </div>

            {/* Advanced Plane Animation Area */}
            <div className="relative h-40 mb-8 overflow-hidden">
              {/* Dynamic Flight Path Trail */}
              <div className="absolute inset-0 pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 500 160">
                  {gameState?.status === 'flying' && (
                    <path
                      d={`M 0 140 Q ${planePosition.x / 2} ${140 - planePosition.y / 2} ${planePosition.x} ${140 - planePosition.y}`}
                      stroke="rgba(59, 130, 246, 0.6)"
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray="5,5"
                      className="animate-pulse"
                      style={{
                        strokeDashoffset: `-${gameState.multiplier * 10}px`,
                        animation: `dash ${2 / animationSpeed}s linear infinite`
                      }}
                    />
                  )}
                </svg>
              </div>
              
              {/* Cloud Effects */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-2 right-10 w-8 h-4 bg-white bg-opacity-20 rounded-full animate-pulse"></div>
                <div className="absolute top-8 right-32 w-6 h-3 bg-white bg-opacity-15 rounded-full animate-pulse delay-300"></div>
                <div className="absolute top-4 left-20 w-10 h-5 bg-white bg-opacity-10 rounded-full animate-pulse delay-700"></div>
              </div>

              {/* Enhanced Animated Plane with Phase-based Animation */}
              <div 
                className={`absolute bottom-4 text-4xl text-white ${
                  animationPhase === 'takeoff' ? 'plane-takeoff' :
                  animationPhase === 'ascent' ? 'plane-ascent' :
                  animationPhase === 'speed' ? 'plane-speed' :
                  animationPhase === 'warning' ? 'plane-warning' :
                  animationPhase === 'crash' ? 'plane-crash' :
                  'transition-all duration-500'
                }`}
                style={{
                  transform: gameState?.status === 'flying' 
                    ? `translateX(${planePosition.x}px) translateY(-${planePosition.y}px) rotate(${Math.min(12 + planePosition.y * 0.2, 25)}deg) scale(${Math.min(1 + planePosition.y * 0.01, 1.3)})`
                    : gameState?.status === 'crashed'
                    ? `translateX(${planePosition.x + 100}px) translateY(-${planePosition.y - 200}px) rotate(180deg) scale(0.5)`
                    : 'translateX(8px) translateY(0px) rotate(12deg)',
                  filter: animationPhase === 'warning' ? 'hue-rotate(45deg) saturate(1.5)' : 'none',
                } as React.CSSProperties}
              >
                {gameState?.status === 'crashed' ? '💥' : '✈️'}
              </div>

              {/* Enhanced Vapor Trails */}
              {gameState?.status === 'flying' && (
                <div className="absolute inset-0 pointer-events-none">
                  <div 
                    className="vapor-trail absolute w-3 h-8 bg-white bg-opacity-30 rounded-full"
                    style={{
                      left: `${planePosition.x - 20}px`,
                      bottom: `${Math.max(planePosition.y - 15, 30)}px`,
                      animationDelay: '0ms'
                    }}
                  ></div>
                  <div 
                    className="vapor-trail absolute w-2 h-6 bg-white bg-opacity-20 rounded-full"
                    style={{
                      left: `${planePosition.x - 35}px`,
                      bottom: `${Math.max(planePosition.y - 10, 35)}px`,
                      animationDelay: '200ms'
                    }}
                  ></div>
                  {animationPhase === 'speed' || animationPhase === 'warning' ? (
                    <div 
                      className="vapor-trail absolute w-1 h-4 bg-white bg-opacity-15 rounded-full"
                      style={{
                        left: `${planePosition.x - 50}px`,
                        bottom: `${Math.max(planePosition.y - 5, 40)}px`,
                        animationDelay: '400ms'
                      }}
                    ></div>
                  ) : null}
                </div>
              )}

              {/* Advanced Crash Effect */}
              {(gameState?.status === 'crashed' || showCrashEffect) && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Dynamic Smoke Trail based on crash position */}
                  <div 
                    className="aviator-smoke absolute w-20 h-20 bg-gray-600 bg-opacity-50 rounded-full"
                    style={{
                      left: `${planePosition.x + 50}px`,
                      bottom: `${Math.max(planePosition.y - 20, 20)}px`,
                      animationDelay: '0ms'
                    }}
                  ></div>
                  <div 
                    className="aviator-smoke absolute w-16 h-16 bg-gray-500 bg-opacity-40 rounded-full"
                    style={{
                      left: `${planePosition.x + 70}px`,
                      bottom: `${Math.max(planePosition.y - 10, 30)}px`,
                      animationDelay: '200ms'
                    }}
                  ></div>
                  <div 
                    className="aviator-smoke absolute w-12 h-12 bg-gray-400 bg-opacity-30 rounded-full"
                    style={{
                      left: `${planePosition.x + 90}px`,
                      bottom: `${Math.max(planePosition.y, 40)}px`,
                      animationDelay: '400ms'
                    }}
                  ></div>
                  
                  {/* Main Explosion Effect */}
                  <div 
                    className="aviator-explosion absolute text-8xl"
                    style={{
                      left: `${planePosition.x + 40}px`,
                      bottom: `${Math.max(planePosition.y - 30, 10)}px`,
                    }}
                  >💥</div>
                  
                  {/* Secondary Fire Effects */}
                  <div 
                    className="absolute text-3xl animate-pulse"
                    style={{
                      left: `${planePosition.x + 20}px`,
                      bottom: `${Math.max(planePosition.y - 10, 25)}px`,
                      animationDelay: '100ms'
                    }}
                  >🔥</div>
                  <div 
                    className="absolute text-2xl animate-pulse"
                    style={{
                      left: `${planePosition.x + 80}px`,
                      bottom: `${Math.max(planePosition.y + 10, 35)}px`,
                      animationDelay: '300ms'
                    }}
                  >🔥</div>

                  {/* Debris Effects */}
                  <div 
                    className="absolute text-lg opacity-70 animate-bounce"
                    style={{
                      left: `${planePosition.x - 10}px`,
                      bottom: `${Math.max(planePosition.y + 20, 50)}px`,
                      animationDelay: '150ms'
                    }}
                  >⚡</div>
                  <div 
                    className="absolute text-lg opacity-60 animate-bounce"
                    style={{
                      left: `${planePosition.x + 110}px`,
                      bottom: `${Math.max(planePosition.y - 5, 45)}px`,
                      animationDelay: '350ms'
                    }}
                  >✨</div>
                </div>
              )}
            </div>

            {/* Game Status */}
            <div className="text-center">
              <div className="text-xl font-semibold text-white mb-4">
                {getStatusText()}
              </div>
              {gameState?.status === 'betting' && (
                <div className="text-lg text-blue-200">
                  Betting phase - Get ready!
                </div>
              )}
            </div>
          </div>

          {/* Control Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Betting Panel */}
            <Card className="bg-surface/80 border-surface-light backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-white">Place Your Bet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="bet-amount" className="text-gray-400">Bet Amount</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="bet-amount"
                      type="number"
                      min={10}
                      max={1000}
                      value={betAmount}
                      onChange={(e) => setBetAmount(parseInt(e.target.value) || 0)}
                      className="bg-surface-light border-surface-light text-white"
                      disabled={!canPlaceBet}
                    />
                    <span className="text-gray-400">Points</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="auto-cashout" className="text-gray-400">Auto Cash Out (Optional)</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="auto-cashout"
                      type="number"
                      step="0.01"
                      min="1.01"
                      value={autoCashOut}
                      onChange={(e) => setAutoCashOut(e.target.value)}
                      placeholder="e.g. 2.00"
                      className="bg-surface-light border-surface-light text-white"
                      disabled={!canPlaceBet}
                    />
                    <span className="text-gray-400">x</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {canPlaceBet && (
                    <Button
                      onClick={() => placeBetMutation.mutate()}
                      disabled={placeBetMutation.isPending || betAmount < 10}
                      className="w-full bg-gradient-to-r from-accent to-primary text-white font-semibold py-3"
                    >
                      <NotebookPen className="w-4 h-4 mr-2" />
                      {placeBetMutation.isPending ? 'Placing Bet...' : 'Place Bet'}
                    </Button>
                  )}
                  
                  {canCashOut && (
                    <div className="relative">
                      <Button
                        onClick={() => cashOutMutation.mutate()}
                        disabled={cashOutMutation.isPending}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 text-lg shadow-lg transform hover:scale-105 transition-all duration-200 animate-pulse"
                      >
                        <HandIcon className="w-5 h-5 mr-2" />
                        {cashOutMutation.isPending ? 'Cashing Out...' : `Cash Out @ ${gameState?.multiplier.toFixed(2)}x`}
                      </Button>
                      <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full animate-bounce">
                        {userBet && gameState ? Math.floor(userBet.betAmount * gameState.multiplier) : 0} pts
                      </div>
                    </div>
                  )}

                  {canTakeWinnings && (
                    <Button
                      onClick={() => takeWinningsMutation.mutate()}
                      disabled={takeWinningsMutation.isPending}
                      className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold py-4 text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      <HandIcon className="w-5 h-5 mr-2" />
                      {takeWinningsMutation.isPending ? 'Collecting...' : `Take Winnings (${userBet?.winAmount} pts)`}
                    </Button>
                  )}
                  
                  {userBet?.status === 'cashed_out' && (
                    <div className="text-center p-4 bg-accent/20 rounded-lg">
                      <p className="text-accent font-semibold">
                        Cashed out at {userBet.cashOutAt?.toFixed(2)}x
                      </p>
                      <p className="text-white">Won {userBet.winAmount} points!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Statistics Panel */}
            <Card className="bg-surface/80 border-surface-light backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-white">Game Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Current Bet:</span>
                  <span className="text-white font-semibold">
                    {userBet?.betAmount || 0} Points
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Potential Win:</span>
                  <span className="text-accent font-semibold">
                    {userBet && gameState ? Math.floor(userBet.betAmount * gameState.multiplier) : 0} Points
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Your Balance:</span>
                  <span className="text-white font-semibold">
                    {balanceData?.balance || 0} Points
                  </span>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">Last 5 Multipliers:</span>
                  </div>
                  <div className="flex space-x-2">
                    {lastMultipliers.map((mult, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {mult.toFixed(2)}x
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Live Players */}
                <div className="mt-6">
                  <h4 className="font-semibold mb-3 text-white flex items-center">
                    <UsersIcon className="w-4 h-4 mr-2" />
                    Live Players
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {/* Placeholder for now - in a real implementation, this would show actual connected players */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">You</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-white">{userBet?.betAmount || 0} pts</span>
                        <Badge variant={userBet?.status === 'active' ? 'default' : userBet?.status === 'cashed_out' ? 'secondary' : 'destructive'}>
                          {userBet?.status || 'waiting'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
