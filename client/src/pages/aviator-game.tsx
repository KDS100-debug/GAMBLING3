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
          break;
        case 'multiplier_update':
          setGameState(prev => prev ? {
            ...prev,
            multiplier: data.data.multiplier,
          } : null);
          break;
        case 'crashed':
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
            setUserBet(prev => prev ? {
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
      setUserBet(prev => prev ? {
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
            
            {/* Multiplier Display */}
            <div className="text-center mb-8">
              <div className="text-6xl font-bold text-white mb-2">
                <span className={gameState?.status === 'flying' ? 'animate-pulse' : ''}>
                  {gameState?.multiplier?.toFixed(2) || '1.00'}x
                </span>
              </div>
              <p className="text-blue-200">Current Multiplier</p>
            </div>

            {/* Plane Animation Area */}
            <div className="relative h-32 mb-8">
              <div className={`absolute text-4xl text-white transform rotate-12 transition-all duration-1000 ${
                gameState?.status === 'flying' ? 'left-1/2' : 'left-8'
              }`}>
                ✈️
              </div>
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
                    <Button
                      onClick={() => cashOutMutation.mutate()}
                      disabled={cashOutMutation.isPending}
                      className="w-full bg-gradient-to-r from-secondary to-accent text-white font-semibold py-3"
                    >
                      <HandIcon className="w-4 h-4 mr-2" />
                      {cashOutMutation.isPending ? 'Cashing Out...' : 'Cash Out'}
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
