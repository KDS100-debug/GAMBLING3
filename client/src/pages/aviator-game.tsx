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

  const { data: balanceData } = useQuery<{balance: number}>({
    queryKey: ['/api/balance'],
  });

  const { sendMessage } = useWebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`, {
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
          setShowCrashEffect(false);
          setAnimationPhase('takeoff');
          setFlightTime(0);
          setShowWarning(false);
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
          setShowCrashEffect(false);
          break;
        case 'multiplier_update':
          setGameState(prev => prev ? {
            ...prev,
            multiplier: data.data.multiplier,
          } : null);
          
          // Update animation phase based on multiplier
          if (data.data.multiplier > 8) {
            setAnimationPhase('warning');
            setShowWarning(true);
          } else if (data.data.multiplier > 5) {
            setAnimationPhase('speed');
          } else if (data.data.multiplier > 2) {
            setAnimationPhase('ascent');
          }
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
            setUserBet((prev: any) => ({ ...prev, status: 'crashed' }));
            toast({
              title: "Round Ended",
              description: `Plane crashed at ${data.data.multiplier.toFixed(2)}x`,
              variant: "destructive",
            });
          }
          
          setTimeout(() => setShowCrashEffect(false), 3000);
          break;
        case 'bet_placed':
          if (data.data.userId === 'user') {
            setUserBet({
              betAmount: data.data.betAmount,
              autoCashOut: data.data.autoCashOut,
              status: 'active',
            });
            queryClient.invalidateQueries({ queryKey: ['/api/balance'] });
            toast({
              title: "Bet Placed!",
              description: `${data.data.betAmount} points bet placed`,
            });
          }
          break;
        case 'cashed_out':
          if (data.data.userId === 'user') {
            setUserBet((prev: any) => ({
              ...prev,
              status: 'cashed_out',
              winAmount: data.data.winAmount,
              cashOutAt: data.data.multiplier,
            }));
            setTotalProfit(prev => prev + data.data.winAmount);
            queryClient.invalidateQueries({ queryKey: ['/api/balance'] });
            toast({
              title: "Cashed Out Successfully!",
              description: `Won ${data.data.winAmount} points at ${data.data.multiplier.toFixed(2)}x`,
            });
          }
          break;
        case 'live_players':
          setLivePlayers(data.data);
          setActivePlayerCount(data.data.length);
          break;
      }
    },
  });

  // Enhanced flight animation with smooth positioning
  useEffect(() => {
    if (gameState?.status === 'flying') {
      const interval = setInterval(() => {
        setFlightTime(prev => prev + 0.1);
        setPlanePosition(prev => {
          const progress = Math.min(gameState.multiplier / 10, 1);
          return {
            x: 50 + (progress * 300),
            y: progress * 150,
          };
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [gameState?.status, gameState?.multiplier]);

  // Mutations for game actions
  const placeBetMutation = useMutation({
    mutationFn: async () => {
      return await fetch('/api/aviator/bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          betAmount,
          autoCashOut: autoCashOut ? parseFloat(autoCashOut) : null,
        }),
      }).then(res => res.json());
    },
    onSuccess: () => {
      // Success handled by WebSocket
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Please log in",
          description: "You need to be logged in to place bets",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = '/auth';
        }, 2000);
        return;
      }
      toast({
        title: "Failed to place bet",
        description: error.message || "Failed to place bet",
        variant: "destructive",
      });
    },
  });

  const placeNextBetMutation = useMutation({
    mutationFn: async () => {
      return await fetch('/api/aviator/next-bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          betAmount,
          autoCashOut: autoCashOut ? parseFloat(autoCashOut) : null,
        }),
      }).then(res => res.json());
    },
    onSuccess: () => {
      // Success handled by WebSocket
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Please log in",
          description: "You need to be logged in to place bets",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = '/auth';
        }, 2000);
        return;
      }
      toast({
        title: "Failed to place next bet",
        description: error.message || "Failed to place next bet",
        variant: "destructive",
      });
    },
  });

  const cashOutMutation = useMutation({
    mutationFn: async () => {
      return await fetch('/api/aviator/cash-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(res => res.json());
    },
    onSuccess: () => {
      // Success handled by WebSocket
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Please log in",
          description: "You need to be logged in to cash out",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = '/auth';
        }, 2000);
        return;
      }
      toast({
        title: "Failed to cash out",
        description: error.message || "Failed to cash out",
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