import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import Navigation from "@/components/navigation";
import { ArrowLeftIcon, RotateCcwIcon, PlayIcon, RefreshCwIcon } from "lucide-react";

const gameColors = [
  { id: 1, class: "bg-gradient-to-br from-red-500 to-red-600" },
  { id: 2, class: "bg-gradient-to-br from-cyan-500 to-cyan-600" },
  { id: 3, class: "bg-gradient-to-br from-blue-500 to-blue-600" },
  { id: 4, class: "bg-gradient-to-br from-green-500 to-green-600" },
  { id: 5, class: "bg-gradient-to-br from-yellow-500 to-yellow-600" },
  { id: 6, class: "bg-gradient-to-br from-pink-500 to-pink-600" },
];

const pricing = {
  1: { entry: 20, win: 40 },
  2: { entry: 30, win: 60 },
  3: { entry: 45, win: 90 }
};

export default function ColorGame() {
  const [selectedColors, setSelectedColors] = useState<Set<number>>(new Set());
  const [gameResult, setGameResult] = useState<{
    result: 'win' | 'loss';
    winningColor: number;
    winAmount: number;
  } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: balanceData } = useQuery({
    queryKey: ['/api/balance'],
  });

  const playGameMutation = useMutation({
    mutationFn: async () => {
      const selectedColorsArray = Array.from(selectedColors);
      const betAmount = pricing[selectedColorsArray.length as keyof typeof pricing].entry;
      
      const response = await apiRequest('POST', '/api/color-game/play', {
        selectedColors: selectedColorsArray,
        betAmount,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setGameResult({
        result: data.result,
        winningColor: data.winningColor,
        winAmount: data.winAmount,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
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
        title: "Game Error",
        description: error.message || "Failed to play game",
        variant: "destructive",
      });
    },
  });

  const toggleColor = (colorId: number) => {
    if (gameResult) return; // Don't allow selection during result display
    
    const newSelected = new Set(selectedColors);
    if (newSelected.has(colorId)) {
      newSelected.delete(colorId);
    } else if (newSelected.size < 3) {
      newSelected.add(colorId);
    }
    setSelectedColors(newSelected);
  };

  const clearSelection = () => {
    setSelectedColors(new Set());
  };

  const playRound = () => {
    if (selectedColors.size === 0) return;
    playGameMutation.mutate();
  };

  const playAgain = () => {
    setGameResult(null);
    setSelectedColors(new Set());
  };

  const count = selectedColors.size;
  const entryPrice = count > 0 ? pricing[count as keyof typeof pricing].entry : 0;
  const potentialWin = count > 0 ? pricing[count as keyof typeof pricing].win : 0;

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
          <h1 className="text-3xl font-bold mb-2 text-white">Six-Color Challenge 🎨</h1>
          <p className="text-gray-400">Pick up to 3 colors and win big!</p>
        </div>

        <div className="max-w-4xl">
          {/* Game Status */}
          <Card className="bg-surface/80 border-surface-light backdrop-blur-sm mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-400">Round Status</p>
                  <p className="text-xl font-bold text-primary">
                    {gameResult ? 'Round Complete' : 'Select Colors'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400">Your Balance</p>
                  <p className="text-xl font-bold text-accent">
                    {balanceData?.balance || 0} Points
                  </p>
                </div>
              </div>

              {/* Bet Info */}
              <div className="bg-surface-light rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400">
                      Colors Selected: <span className="text-white font-semibold">{count}</span>/3
                    </p>
                    <p className="text-gray-400">
                      Entry Price: <span className="text-white font-semibold">{entryPrice} Points</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400">Potential Win:</p>
                    <p className="text-2xl font-bold text-accent">{potentialWin} Points</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Color Selection Grid */}
          <Card className="bg-surface/80 border-surface-light backdrop-blur-sm mb-6">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-center text-white">Choose Your Colors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
                {gameColors.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => toggleColor(color.id)}
                    disabled={playGameMutation.isPending}
                    className={`w-24 h-24 rounded-full ${color.class} hover:scale-110 transition-transform shadow-lg ${
                      selectedColors.has(color.id) ? 'ring-4 ring-primary scale-95' : ''
                    } ${gameResult ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          {!gameResult && (
            <div className="flex gap-4 justify-center mb-6">
              <Button
                onClick={clearSelection}
                variant="outline"
                className="bg-surface-light text-white border-surface-light hover:bg-surface"
              >
                <RotateCcwIcon className="w-4 h-4 mr-2" />
                Clear Selection
              </Button>
              <Button
                onClick={playRound}
                disabled={count === 0 || playGameMutation.isPending}
                className="bg-gradient-to-r from-primary to-secondary text-white px-8"
              >
                {playGameMutation.isPending ? (
                  <>Processing...</>
                ) : (
                  <>
                    <PlayIcon className="w-4 h-4 mr-2" />
                    Play Round
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Results Area */}
          {gameResult && (
            <Card className="bg-surface/80 border-surface-light backdrop-blur-sm animate-in slide-in-from-bottom">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-center text-white">Round Result</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-6">
                  <p className="text-gray-400 mb-2">Winning Color:</p>
                  <div 
                    className={`w-20 h-20 rounded-full mx-auto shadow-lg ${
                      gameColors.find(c => c.id === gameResult.winningColor)?.class
                    }`}
                  />
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold mb-4 ${
                    gameResult.result === 'win' ? 'text-accent' : 'text-red-400'
                  }`}>
                    {gameResult.result === 'win' 
                      ? `🎉 You Won ${gameResult.winAmount} Points!`
                      : `😔 You Lost ${entryPrice} Points`
                    }
                  </div>
                  <Button
                    onClick={playAgain}
                    className="bg-gradient-to-r from-primary to-secondary text-white px-8"
                  >
                    <RefreshCwIcon className="w-4 h-4 mr-2" />
                    Play Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
