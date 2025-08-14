import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plane, TrendingUp, Clock, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface BettingPanelProps {
  balance: number;
  gameStatus: 'betting' | 'flying' | 'crashed';
  betAmount: number;
  setBetAmount: (amount: number) => void;
  autoCashOut: string;
  setAutoCashOut: (value: string) => void;
  userBet: any;
  nextRoundBet: any;
  onPlaceBet: () => void;
  onCashOut: () => void;
  onPlaceNextBet: () => void;
  isLoading?: boolean;
  className?: string;
}

export function BettingPanel({
  balance,
  gameStatus,
  betAmount,
  setBetAmount,
  autoCashOut,
  setAutoCashOut,
  userBet,
  nextRoundBet,
  onPlaceBet,
  onCashOut,
  onPlaceNextBet,
  isLoading = false,
  className
}: BettingPanelProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  const quickAmounts = [10, 25, 50, 100, 250, 500];

  const handleQuickAmount = (amount: number) => {
    setBetAmount(amount);
    setSelectedAmount(amount);
  };

  const canPlaceBet = gameStatus === 'betting' && !userBet && !nextRoundBet && balance >= betAmount;
  const canCashOut = gameStatus === 'flying' && userBet?.status === 'active';
  const canPlaceNextBet = gameStatus === 'flying' && !userBet && !nextRoundBet && balance >= betAmount;

  return (
    <Card className={cn("glass-effect border-surface-light", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Plane className="w-5 h-5 text-neon-gold" />
          Betting Panel
        </CardTitle>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Balance:</span>
          <Badge variant="outline" className="font-mono">
            <DollarSign className="w-3 h-3 mr-1" />
            {balance.toLocaleString()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Bet Amount Section */}
        <div className="space-y-3">
          <Label htmlFor="bet-amount" className="text-sm font-medium">
            Bet Amount
          </Label>
          <div className="space-y-2">
            <Input
              id="bet-amount"
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              min="1"
              max={balance}
              className="font-mono text-center"
              data-testid="input-bet-amount"
            />
            
            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map((amount) => (
                <Button
                  key={amount}
                  variant={selectedAmount === amount ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleQuickAmount(amount)}
                  disabled={amount > balance}
                  className={cn(
                    "text-xs transition-all duration-200",
                    selectedAmount === amount && "animate-neon-glow"
                  )}
                  data-testid={`button-quick-${amount}`}
                >
                  {amount}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Auto Cash Out Section */}
        <div className="space-y-3">
          <Label htmlFor="auto-cashout" className="text-sm font-medium">
            Auto Cash Out (Optional)
          </Label>
          <div className="relative">
            <Input
              id="auto-cashout"
              type="number"
              value={autoCashOut}
              onChange={(e) => setAutoCashOut(e.target.value)}
              step="0.1"
              min="1.1"
              placeholder="e.g., 2.00"
              className="font-mono pr-8"
              data-testid="input-auto-cashout"
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
              x
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {canPlaceBet && (
            <Button
              onClick={onPlaceBet}
              disabled={isLoading || betAmount <= 0 || betAmount > balance}
              className="w-full bg-neon-green hover:bg-neon-green-dim text-black font-bold transition-all duration-200 hover:animate-cash-out-celebration"
              data-testid="button-place-bet"
            >
              <Plane className="w-4 h-4 mr-2" />
              Place Bet ({betAmount} points)
            </Button>
          )}

          {canCashOut && (
            <Button
              onClick={onCashOut}
              className="w-full bg-neon-gold hover:bg-neon-gold-dim text-black font-bold animate-neon-glow cash-out-btn"
              data-testid="button-cash-out"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Cash Out Now!
            </Button>
          )}

          {canPlaceNextBet && (
            <Button
              onClick={onPlaceNextBet}
              disabled={isLoading || betAmount <= 0 || betAmount > balance}
              variant="outline"
              className="w-full border-neon-blue text-neon-blue hover:bg-neon-blue hover:text-black transition-all duration-200"
              data-testid="button-next-bet"
            >
              <Clock className="w-4 h-4 mr-2" />
              Bet Next Round ({betAmount} points)
            </Button>
          )}

          {gameStatus === 'crashed' && (
            <div className="text-center py-4">
              <Badge variant="destructive" className="animate-pulse">
                Round Ended
              </Badge>
            </div>
          )}
        </div>

        {/* Current Bet Status */}
        {userBet && (
          <div className="p-3 bg-surface-light rounded-lg border border-neon-green/20">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Active Bet:</span>
              <Badge className="bg-neon-green text-black font-mono">
                {userBet.betAmount} points
              </Badge>
            </div>
            {userBet.autoCashOut && (
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-muted-foreground">Auto Cash Out:</span>
                <span className="text-neon-gold">{userBet.autoCashOut}x</span>
              </div>
            )}
          </div>
        )}

        {nextRoundBet && (
          <div className="p-3 bg-surface-light rounded-lg border border-neon-blue/20">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Next Round:</span>
              <Badge variant="outline" className="border-neon-blue text-neon-blue font-mono">
                {nextRoundBet.betAmount} points
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}