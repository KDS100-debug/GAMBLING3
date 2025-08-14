import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useWebSocket } from "@/hooks/useWebSocket";
import Navigation from "@/components/navigation";
import { MultiplierDisplay } from "@/components/aviator/MultiplierDisplay";
import { GameCanvas } from "@/components/aviator/GameCanvas";
import { BettingPanel } from "@/components/aviator/BettingPanel";
import { StatisticsPanel } from "@/components/aviator/StatisticsPanel";
import { ArrowLeftIcon } from "lucide-react";

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
  const [nextRoundBet, setNextRoundBet] = useState<any>(null);
  const [livePlayers, setLivePlayers] = useState<LivePlayer[]>([]);
  const [lastMultipliers, setLastMultipliers] = useState<number[]>([2.34, 1.15, 5.67, 1.87, 3.21]);
  const [planePosition, setPlanePosition] = useState({ x: 0, y: 0 });
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [showCrashEffect, setShowCrashEffect] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'takeoff' | 'ascent' | 'speed' | 'warning' | 'crash'>('takeoff');
  const [flightTime, setFlightTime] = useState(0);
  const [showWarning, setShowWarning] = useState(false);

  // Enhanced statistics state
  const [activePlayerCount, setActivePlayerCount] = useState(Math.floor(Math.random() * 15) + 8);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalLoss, setTotalLoss] = useState(0);
  const [biggestWinOfDay, setBiggestWinOfDay] = useState({ amount: 5850, player: 'Flyer_47' });
  const [profitChangePercent, setProfitChangePercent] = useState(0);
  
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
        case 'next_bet_placed':
          if (data.data.userId === 'user') {
            setNextRoundBet({
              betAmount: data.data.betAmount,
              autoCashOut: data.data.autoCashOut,
              status: 'waiting',
            });
            toast({
              title: "Next Round Bet Placed!",
              description: `${data.data.betAmount} points bet placed for next round`,
            });
          }
          break;
        case 'next_bet_activated':
          if (data.data.userId === 'user') {
            setUserBet({
              betAmount: data.data.betAmount,
              autoCashOut: data.data.autoCashOut,
              status: 'active',
            });
            setNextRoundBet(null);
            toast({
              title: "Next Round Bet Activated!",
              description: `Your ${data.data.betAmount} points bet is now active`,
            });
          }
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
          setLivePlayers(prev => {
            const updatedPlayers = [...prev];
            const existingPlayerIndex = updatedPlayers.findIndex(p => p.userId === data.data.userId);
            if (existingPlayerIndex >= 0) {
              updatedPlayers[existingPlayerIndex] = {
                ...updatedPlayers[existingPlayerIndex],
                betAmount: data.data.betAmount,
                status: 'active'
              };
            } else {
              updatedPlayers.push({
                userId: data.data.userId,
                betAmount: data.data.betAmount,
                status: 'active'
              });
            }
            return updatedPlayers;
          });
          setActivePlayerCount(prev => prev + 1);
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
    mutationFn: async (isNextRound = false) => {
      const response = await apiRequest('POST', '/api/aviator/place-bet', {
        betAmount,
        autoCashOut: autoCashOut ? parseFloat(autoCashOut) : null,
        isNextRound,
      });
      return { data: await response.json(), isNextRound };
    },
    onSuccess: ({ data, isNextRound }) => {
      if (isNextRound) {
        setNextRoundBet({
          ...data.bet,
          status: 'waiting',
        });
        toast({
          title: "Next Round Bet Placed!",
          description: `${betAmount} points bet placed for next round`,
        });
      } else {
        setUserBet({
          ...data.bet,
          status: 'active',
        });
        toast({
          title: "Bet Placed!",
          description: `${betAmount} points bet placed successfully`,
        });
      }
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
  const canPlaceNextBet = (gameState?.status === 'flying' || gameState?.status === 'crashed') && !nextRoundBet && !userBet;
  const canCashOut = gameState?.status === 'flying' && userBet?.status === 'active';
  const canTakeWinnings = userBet?.status === 'cashed_out' && userBet?.winAmount > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-casino-dark via-casino-navy to-casino-midnight">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href="/games">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4 bg-surface-light hover:bg-surface-lighter px-4 py-2 rounded-lg">
              <ArrowLeftIcon className="w-4 h-4" />
              Back to Games
            </button>
          </Link>
          <h1 className="text-4xl font-bold mb-2 text-foreground neon-text">Aviator ✈️</h1>
          <p className="text-muted-foreground text-lg">Cash out before you crash out!</p>
        </div>

        {/* Enterprise-Grade Game Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Game Area - Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Game Canvas and Multiplier Display */}
            <div className="relative bg-gradient-to-br from-casino-navy via-casino-midnight to-dark rounded-xl p-8 border border-surface-light overflow-hidden min-h-[400px]">
              <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white opacity-5"></div>
              
              {/* Enhanced Multiplier Display */}
              <div className="relative z-10 mb-6">
                <MultiplierDisplay
                  multiplier={gameState?.multiplier || 1.0}
                  gameStatus={gameState?.status || 'betting'}
                  isWarningZone={showWarning && animationPhase === 'warning'}
                  className="mb-4"
                />
                <div className="text-center text-muted-foreground">
                  {getStatusText()}
                </div>
              </div>

              {/* Game Canvas */}
              <div className="relative z-10 h-64">
                <GameCanvas
                  gameStatus={gameState?.status || 'betting'}
                  multiplier={gameState?.multiplier || 1.0}
                  showCrashEffect={showCrashEffect}
                  className="w-full h-full"
                />
              </div>
            </div>

            {/* Betting Panel */}
            <BettingPanel
              balance={balanceData?.balance || 0}
              gameStatus={gameState?.status || 'betting'}
              betAmount={betAmount}
              setBetAmount={setBetAmount}
              autoCashOut={autoCashOut}
              setAutoCashOut={setAutoCashOut}
              userBet={userBet}
              nextRoundBet={nextRoundBet}
              onPlaceBet={() => placeBetMutation.mutate()}
              onCashOut={() => cashOutMutation.mutate()}
              onPlaceNextBet={() => placeNextBetMutation.mutate()}
              isLoading={placeBetMutation.isPending || cashOutMutation.isPending || placeNextBetMutation.isPending}
            />
          </div>

          {/* Statistics Panel - Right Column */}
          <div className="lg:col-span-1">
            <StatisticsPanel
              activePlayerCount={activePlayerCount}
              totalProfit={totalProfit}
              totalLoss={totalLoss}
              biggestWinOfDay={biggestWinOfDay}
              profitChangePercent={profitChangePercent}
              lastMultipliers={lastMultipliers}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
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

                {/* Next Round Bet Status */}
                {nextRoundBet && (
                  <div className="p-3 bg-purple-900/50 border border-purple-500/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-purple-200 font-medium">Next Round Bet:</span>
                      <span className="text-purple-400 font-bold">{nextRoundBet.betAmount} pts</span>
                    </div>
                    <div className="text-purple-300 text-sm mt-1">
                      Waiting for next round to start...
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {canPlaceBet && (
                    <Button
                      onClick={() => placeBetMutation.mutate(false)}
                      disabled={placeBetMutation.isPending || betAmount < 10}
                      className="w-full bg-gradient-to-r from-accent to-primary text-white font-semibold py-3"
                    >
                      <NotebookPen className="w-4 h-4 mr-2" />
                      {placeBetMutation.isPending ? 'Placing Bet...' : 'Place Bet'}
                    </Button>
                  )}

                  {canPlaceNextBet && (
                    <Button
                      onClick={() => placeBetMutation.mutate(true)}
                      disabled={placeBetMutation.isPending || betAmount < 10}
                      className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3"
                    >
                      <NotebookPen className="w-4 h-4 mr-2" />
                      {placeBetMutation.isPending ? 'Placing Next Bet...' : 'Bet Next Round'}
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

            {/* Enhanced Statistics Panel */}
            <Card className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-gray-700 backdrop-blur-sm shadow-2xl">
              <CardHeader className="relative">
                {/* Player Count Badge */}
                <div className="absolute top-4 right-4">
                  <div className="player-count-badge px-3 py-1 rounded-full flex items-center space-x-2">
                    <UsersIcon className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 font-bold text-sm">{Math.max(activePlayerCount, Math.floor(Math.random() * 15) + 8)} Live</span>
                  </div>
                </div>

                {/* Biggest Win Badge */}
                {biggestWinOfDay.amount > 0 && (
                  <div className="biggest-win-badge absolute -top-2 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <TrophyIcon className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 font-bold text-xs">Biggest Win: {biggestWinOfDay.amount} pts</span>
                    </div>
                  </div>
                )}

                <CardTitle className="text-xl font-semibold text-white neon-text">Live Statistics</CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Desktop Layout */}
                <div className="hidden lg:block">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Player List Panel */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-white flex items-center justify-between">
                        <span>Player Leaderboard</span>
                        <Badge className="bg-gray-700 text-gray-300 text-xs">Live</Badge>
                      </h4>
                      
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {/* Top 3 Players with Special Highlighting */}
                        <div className="leaderboard-gold p-3 rounded-lg flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                              <span className="text-black font-bold text-xs">1</span>
                            </div>
                            <div>
                              <p className="text-white font-semibold text-sm">Flyer_47</p>
                              <p className="text-xs text-gray-400">Bet: 850 pts</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="profit-positive font-bold text-sm">+2,125</p>
                            <p className="text-xs text-gray-400">2.5x</p>
                          </div>
                        </div>

                        <div className="leaderboard-silver p-3 rounded-lg flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center">
                              <span className="text-black font-bold text-xs">2</span>
                            </div>
                            <div>
                              <p className="text-white font-semibold text-sm">AviatorPro</p>
                              <p className="text-xs text-gray-400">Bet: 500 pts</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="profit-positive font-bold text-sm">+950</p>
                            <p className="text-xs text-gray-400">1.9x</p>
                          </div>
                        </div>

                        <div className="leaderboard-bronze p-3 rounded-lg flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-xs">3</span>
                            </div>
                            <div>
                              <p className="text-white font-semibold text-sm">SkyHigh_23</p>
                              <p className="text-xs text-gray-400">Bet: 300 pts</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="profit-positive font-bold text-sm">+450</p>
                            <p className="text-xs text-gray-400">1.5x</p>
                          </div>
                        </div>

                        {/* Your Position */}
                        <div className="bg-gray-800 p-3 rounded-lg border border-blue-500 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-xs">You</span>
                            </div>
                            <div>
                              <p className="text-blue-400 font-semibold text-sm">Your Game</p>
                              <p className="text-xs text-gray-400">Bet: {userBet?.betAmount || 0} pts</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold text-sm ${userBet?.status === 'cashed_out' ? 'profit-positive' : userBet?.status === 'active' ? 'text-yellow-400' : 'text-gray-400'}`}>
                              {userBet?.status === 'cashed_out' ? `+${userBet.winAmount}` : userBet?.status === 'active' ? 'Flying' : '--'}
                            </p>
                            <Badge variant={userBet?.status === 'active' ? 'default' : userBet?.status === 'cashed_out' ? 'secondary' : 'outline'} className="text-xs">
                              {userBet?.status || 'waiting'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Profit & Loss Panel */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-white flex items-center justify-between">
                        <span>Round Summary</span>
                        <span className="text-xs text-gray-400">vs Previous</span>
                      </h4>
                      
                      {/* Profit/Loss Meters */}
                      <div className="space-y-4">
                        <div className="bg-gray-800 p-4 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <TrendingUpIcon className="w-4 h-4 text-green-400" />
                              <span className="text-green-400 font-semibold">Total Profits</span>
                            </div>
                            <span className="profit-positive font-bold">{Math.floor(Math.random() * 50000) + 15000}</span>
                          </div>
                          <div className="profit-meter w-full rounded"></div>
                          <p className="text-xs text-green-400 mt-1">+12.3% from last round</p>
                        </div>

                        <div className="bg-gray-800 p-4 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <TrendingDownIcon className="w-4 h-4 text-red-400" />
                              <span className="text-red-400 font-semibold">Total Losses</span>
                            </div>
                            <span className="profit-negative font-bold">{Math.floor(Math.random() * 30000) + 8000}</span>
                          </div>
                          <div className="loss-meter w-full rounded"></div>
                          <p className="text-xs text-red-400 mt-1">-8.7% from last round</p>
                        </div>
                      </div>

                      {/* Your Stats */}
                      <div className="bg-gradient-to-r from-blue-900 to-purple-900 p-4 rounded-lg border border-blue-500">
                        <h5 className="text-blue-400 font-semibold mb-3">Your Session</h5>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-400">Current Bet</p>
                            <p className="text-white font-bold">{userBet?.betAmount || 0} pts</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Potential Win</p>
                            <p className="text-green-400 font-bold">{userBet && gameState ? Math.floor(userBet.betAmount * gameState.multiplier) : 0} pts</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Balance</p>
                            <p className="text-white font-bold">{(balanceData as any)?.balance || 0} pts</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Status</p>
                            <Badge variant={userBet?.status === 'active' ? 'default' : userBet?.status === 'cashed_out' ? 'secondary' : 'outline'} className="text-xs">
                              {userBet?.status || 'ready'}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Last Multipliers */}
                      <div>
                        <h5 className="text-white font-semibold mb-2">Recent Results</h5>
                        <div className="flex space-x-2">
                          {lastMultipliers.map((mult, index) => (
                            <Badge key={index} variant="secondary" className={`text-xs ${mult > 2 ? 'bg-green-600 text-white' : mult < 1.5 ? 'bg-red-600 text-white' : 'bg-yellow-600 text-black'}`}>
                              {mult.toFixed(2)}x
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile Layout */}
                <div className="lg:hidden space-y-4">
                  {/* Collapsible Player List */}
                  <details className="group">
                    <summary className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer">
                      <span className="text-white font-semibold">Player Leaderboard</span>
                      <Badge className="bg-gray-700 text-gray-300 text-xs">Live</Badge>
                    </summary>
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                      <div className="leaderboard-gold p-2 rounded flex justify-between text-sm">
                        <span className="text-white">Flyer_47</span>
                        <span className="profit-positive font-bold">+2,125</span>
                      </div>
                      <div className="leaderboard-silver p-2 rounded flex justify-between text-sm">
                        <span className="text-white">AviatorPro</span>
                        <span className="profit-positive font-bold">+950</span>
                      </div>
                      <div className="bg-gray-800 p-2 rounded flex justify-between text-sm border border-blue-500">
                        <span className="text-blue-400">You</span>
                        <Badge variant={userBet?.status === 'active' ? 'default' : 'outline'} className="text-xs">
                          {userBet?.status || 'ready'}
                        </Badge>
                      </div>
                    </div>
                  </details>

                  {/* Mobile Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <p className="text-gray-400 text-xs">Your Bet</p>
                      <p className="text-white font-bold">{userBet?.betAmount || 0} pts</p>
                    </div>
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <p className="text-gray-400 text-xs">Balance</p>
                      <p className="text-white font-bold">{(balanceData as any)?.balance || 0} pts</p>
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
