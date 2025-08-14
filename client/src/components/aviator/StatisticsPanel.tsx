import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Trophy, 
  Target, 
  Clock,
  Zap,
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Player {
  id: string;
  name: string;
  profit: number;
  gamesPlayed: number;
  winRate: number;
  biggestWin: number;
  isOnline: boolean;
}

interface StatisticsPanelProps {
  activePlayerCount: number;
  totalProfit: number;
  totalLoss: number;
  biggestWinOfDay: { amount: number; player: string };
  profitChangePercent: number;
  lastMultipliers: number[];
  className?: string;
}

export function StatisticsPanel({
  activePlayerCount,
  totalProfit,
  totalLoss,
  biggestWinOfDay,
  profitChangePercent,
  lastMultipliers,
  className
}: StatisticsPanelProps) {
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Mock leaderboard data - in real app, this would come from API
  useEffect(() => {
    const generateMockLeaderboard = (): Player[] => {
      const names = ['Ace_Pilot', 'Sky_Master', 'High_Flyer', 'Wind_Walker', 'Cloud_Chaser', 'Jet_Stream', 'Rocket_Man', 'Flight_Pro'];
      return names.map((name, index) => ({
        id: `player_${index}`,
        name,
        profit: Math.floor(Math.random() * 10000) + 1000 - (index * 200),
        gamesPlayed: Math.floor(Math.random() * 100) + 50,
        winRate: Math.floor(Math.random() * 40) + 40 + (8 - index),
        biggestWin: Math.floor(Math.random() * 5000) + 1000,
        isOnline: Math.random() > 0.3
      })).sort((a, b) => b.profit - a.profit);
    };

    setLeaderboard(generateMockLeaderboard());
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const netProfit = totalProfit - totalLoss;
  const avgMultiplier = lastMultipliers.reduce((sum, mult) => sum + mult, 0) / lastMultipliers.length;

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="w-4 h-4 text-neon-gold" />;
      case 1: return <Star className="w-4 h-4 text-gray-400" />;
      case 2: return <Target className="w-4 h-4 text-amber-600" />;
      default: return <span className="w-4 h-4 flex items-center justify-center text-xs font-bold">{index + 1}</span>;
    }
  };

  const getRankClass = (index: number) => {
    switch (index) {
      case 0: return "leaderboard-gold";
      case 1: return "leaderboard-silver";
      case 2: return "leaderboard-bronze";
      default: return "";
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Live Statistics */}
      <Card className="glass-effect border-surface-light">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="w-5 h-5 text-neon-blue" />
            Live Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Active Players & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-surface-light rounded-lg border border-neon-green/20">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Users className="w-4 h-4 text-neon-green" />
                <span className="text-sm text-muted-foreground">Online</span>
              </div>
              <div className="text-2xl font-bold text-neon-green neon-text" data-testid="text-player-count">
                {activePlayerCount}
              </div>
            </div>
            
            <div className="text-center p-3 bg-surface-light rounded-lg border border-neon-blue/20">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-neon-blue" />
                <span className="text-sm text-muted-foreground">Time</span>
              </div>
              <div className="text-sm font-mono text-neon-blue">
                {currentTime.toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Profit/Loss Display */}
          <div className="p-4 bg-surface-light rounded-lg border border-surface-lighter">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Net Profit</span>
              <div className="flex items-center gap-1">
                {profitChangePercent >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-neon-green" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-neon-red" />
                )}
                <span className={cn(
                  "text-sm font-mono",
                  profitChangePercent >= 0 ? "text-neon-green" : "text-neon-red"
                )}>
                  {profitChangePercent >= 0 ? '+' : ''}{profitChangePercent.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className={cn(
              "text-2xl font-bold font-mono",
              netProfit >= 0 ? "text-neon-green profit-positive" : "text-neon-red profit-negative"
            )} data-testid="text-net-profit">
              {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString()}
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Wins: {totalProfit.toLocaleString()}</span>
                <span className="text-muted-foreground">Losses: {totalLoss.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Biggest Win Today */}
          <div className="p-3 bg-surface-light rounded-lg border border-neon-gold/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Biggest Win Today</div>
                <div className="text-lg font-bold text-neon-gold neon-text" data-testid="text-biggest-win">
                  {biggestWinOfDay.amount.toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">by</div>
                <div className="text-sm font-medium text-foreground">
                  {biggestWinOfDay.player}
                </div>
              </div>
            </div>
          </div>

          {/* Average Multiplier */}
          <div className="p-3 bg-surface-light rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Average Multiplier (Last 5)</span>
              <span className="text-lg font-bold text-neon-blue">
                {avgMultiplier.toFixed(2)}x
              </span>
            </div>
            <Progress 
              value={Math.min((avgMultiplier / 5) * 100, 100)} 
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Recent Multipliers */}
      <Card className="glass-effect border-surface-light">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Recent Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 justify-center">
            {lastMultipliers.map((mult, index) => (
              <Badge
                key={index}
                variant={mult >= 2 ? "default" : "secondary"}
                className={cn(
                  "font-mono text-sm px-3 py-1 transition-all duration-200",
                  mult >= 10 ? "bg-neon-red text-black animate-neon-glow" :
                  mult >= 5 ? "bg-neon-orange text-black" :
                  mult >= 2 ? "bg-neon-gold text-black" :
                  "bg-surface-lighter text-muted-foreground",
                  index === 0 && "animate-slide-up"
                )}
                data-testid={`badge-multiplier-${index}`}
              >
                {mult.toFixed(2)}x
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card className="glass-effect border-surface-light">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="w-5 h-5 text-neon-gold" />
            Top Players
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {leaderboard.slice(0, 8).map((player, index) => (
            <div
              key={player.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border border-surface-lighter transition-all duration-200 hover:bg-surface-light",
                getRankClass(index)
              )}
              data-testid={`row-player-${index}`}
            >
              <div className="flex items-center gap-3">
                {getRankIcon(index)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{player.name}</span>
                    {player.isOnline && (
                      <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {player.gamesPlayed} games • {player.winRate}% win rate
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={cn(
                  "font-bold font-mono",
                  player.profit >= 0 ? "text-neon-green" : "text-neon-red"
                )}>
                  {player.profit >= 0 ? '+' : ''}{player.profit.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  Best: {player.biggestWin.toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}