import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navigation from "@/components/navigation";
import { CoinsIcon, GamepadIcon, TrophyIcon, TrendingUpIcon } from "lucide-react";

export default function Home() {
  const { user } = useAuth();

  const { data: gameHistory } = useQuery({
    queryKey: ['/api/game-history'],
  });

  const { data: balanceData } = useQuery({
    queryKey: ['/api/balance'],
  });

  const winRate = user?.gamesPlayed ? Math.round((user.totalWinnings / (user.gamesPlayed * 30)) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-surface to-dark">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-white">
            Welcome back, <span className="text-primary">{user?.firstName || "Player"}</span>! 🎮
          </h1>
          <p className="text-gray-400">Ready to test your luck and skills?</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-surface/80 border-surface-light backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Current Balance</p>
                  <p className="text-2xl font-bold text-accent">
                    {balanceData?.balance || user?.balance || 0}
                  </p>
                </div>
                <CoinsIcon className="h-8 w-8 text-accent opacity-60" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface/80 border-surface-light backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Games Played</p>
                  <p className="text-2xl font-bold text-primary">{user?.gamesPlayed || 0}</p>
                </div>
                <GamepadIcon className="h-8 w-8 text-primary opacity-60" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface/80 border-surface-light backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Winnings</p>
                  <p className="text-2xl font-bold text-secondary">{user?.totalWinnings || 0}</p>
                </div>
                <TrophyIcon className="h-8 w-8 text-secondary opacity-60" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface/80 border-surface-light backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Win Rate</p>
                  <p className="text-2xl font-bold text-white">{winRate}%</p>
                </div>
                <TrendingUpIcon className="h-8 w-8 text-white opacity-60" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Games */}
        <Card className="bg-surface/80 border-surface-light backdrop-blur-sm mb-8">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-white">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {gameHistory && gameHistory.length > 0 ? (
                gameHistory.slice(0, 5).map((game: any) => (
                  <div key={game.id} className="flex items-center justify-between py-3 border-b border-surface-light last:border-b-0">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        game.gameType === 'color_game' 
                          ? 'bg-gradient-to-br from-primary to-secondary' 
                          : 'bg-gradient-to-br from-secondary to-primary'
                      }`}>
                        {game.gameType === 'color_game' ? (
                          <div className="text-white">🎨</div>
                        ) : (
                          <div className="text-white">✈️</div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {game.gameType === 'color_game' ? 'Six-Color Challenge' : 'Aviator'}
                        </p>
                        <p className="text-sm text-gray-400">
                          {new Date(game.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${game.result === 'win' ? 'text-accent' : 'text-red-400'}`}>
                        {game.result === 'win' ? '+' : '-'}{game.result === 'win' ? game.winAmount : game.betAmount} Points
                      </p>
                      <Badge variant={game.result === 'win' ? 'default' : 'destructive'} className="text-xs">
                        {game.result === 'win' ? 'Win' : 'Loss'}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <GamepadIcon className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No games played yet</p>
                  <p className="text-sm text-gray-500 mt-2">Start playing to see your activity here!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
