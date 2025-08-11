import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertTransactionSchema, insertGameRoundSchema, insertAviatorBetSchema } from "@shared/schema";
import { randomUUID } from "crypto";

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

let currentAviatorRound: {
  roundId: string;
  status: 'betting' | 'flying' | 'crashed';
  multiplier: number;
  crashPoint: number;
  startTime?: Date;
} | null = null;

let aviatorInterval: NodeJS.Timeout | null = null;
const connectedClients = new Set<ExtendedWebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Balance routes
  app.get('/api/balance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const balance = await storage.getUserBalance(userId);
      res.json({ balance });
    } catch (error) {
      console.error("Error fetching balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });

  // Top-up routes
  app.post('/api/topup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, package: packageType } = req.body;

      // Validate package
      const packages: Record<string, { price: number; points: number }> = {
        starter: { price: 50, points: 500 },
        value: { price: 100, points: 1100 },
        premium: { price: 200, points: 2500 },
      };

      if (!packages[packageType]) {
        return res.status(400).json({ message: "Invalid package" });
      }

      const pkg = packages[packageType];
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Create transaction
      const transaction = await storage.createTransaction({
        userId,
        type: 'topup',
        amount: pkg.points,
        status: 'completed',
        paymentId: randomUUID(),
      });

      // Update user balance
      const newBalance = (user.balance || 0) + pkg.points;
      await storage.updateUserBalance(userId, newBalance);

      res.json({ success: true, transaction, newBalance });
    } catch (error) {
      console.error("Error processing top-up:", error);
      res.status(500).json({ message: "Failed to process top-up" });
    }
  });

  // Game history routes
  app.get('/api/game-history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const gameHistory = await storage.getUserGameHistory(userId, 20);
      res.json(gameHistory);
    } catch (error) {
      console.error("Error fetching game history:", error);
      res.status(500).json({ message: "Failed to fetch game history" });
    }
  });

  // Transaction history routes
  app.get('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transactions = await storage.getUserTransactions(userId, 20);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Color game routes
  app.post('/api/color-game/play', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { selectedColors, betAmount } = req.body;

      // Validate input
      if (!Array.isArray(selectedColors) || selectedColors.length === 0 || selectedColors.length > 3) {
        return res.status(400).json({ message: "Invalid color selection" });
      }

      // Validate bet amount based on selection count
      const pricing: Record<number, { entry: number; win: number }> = {
        1: { entry: 20, win: 40 },
        2: { entry: 30, win: 60 },
        3: { entry: 45, win: 90 }
      };

      const count = selectedColors.length;
      if (betAmount !== pricing[count].entry) {
        return res.status(400).json({ message: "Invalid bet amount" });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.balance || 0) < betAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Generate winning color (1-6)
      const winningColor = Math.floor(Math.random() * 6) + 1;
      const isWin = selectedColors.includes(winningColor);
      const winAmount = isWin ? pricing[count].win : 0;

      // Create game round
      const gameRound = await storage.createGameRound({
        userId,
        gameType: 'color_game',
        betAmount,
        result: isWin ? 'win' : 'loss',
        winAmount,
        gameData: {
          selectedColors,
          winningColor,
        },
      });

      // Create bet transaction
      await storage.createTransaction({
        userId,
        type: 'game_bet',
        amount: -betAmount,
        gameType: 'color_game',
        gameRoundId: gameRound.id,
      });

      // Create win transaction if won
      if (isWin) {
        await storage.createTransaction({
          userId,
          type: 'game_win',
          amount: winAmount,
          gameType: 'color_game',
          gameRoundId: gameRound.id,
        });
      }

      // Update user balance and stats
      const newBalance = (user.balance || 0) - betAmount + winAmount;
      await storage.updateUserBalance(userId, newBalance);
      await storage.updateUserStats(userId, isWin, winAmount);

      res.json({
        result: isWin ? 'win' : 'loss',
        winningColor,
        winAmount,
        newBalance,
        gameRound,
      });
    } catch (error) {
      console.error("Error playing color game:", error);
      res.status(500).json({ message: "Failed to play color game" });
    }
  });

  // Aviator game routes
  app.get('/api/aviator/current-game', async (req, res) => {
    try {
      if (!currentAviatorRound) {
        return res.json({ game: null });
      }

      res.json({
        game: {
          roundId: currentAviatorRound.roundId,
          status: currentAviatorRound.status,
          multiplier: currentAviatorRound.multiplier,
          startTime: currentAviatorRound.startTime,
        }
      });
    } catch (error) {
      console.error("Error fetching current aviator game:", error);
      res.status(500).json({ message: "Failed to fetch current game" });
    }
  });

  app.post('/api/aviator/place-bet', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { betAmount, autoCashOut } = req.body;

      if (!currentAviatorRound || currentAviatorRound.status !== 'betting') {
        return res.status(400).json({ message: "No active betting round" });
      }

      if (betAmount < 10 || betAmount > 1000) {
        return res.status(400).json({ message: "Invalid bet amount" });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.balance || 0) < betAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Check if user already has a bet in this round
      const existingBet = await storage.getUserAviatorBet(userId, currentAviatorRound.roundId);
      if (existingBet) {
        return res.status(400).json({ message: "Already placed bet in this round" });
      }

      // Create aviator bet
      const bet = await storage.createAviatorBet({
        userId,
        roundId: currentAviatorRound.roundId,
        betAmount,
        autoCashOut: autoCashOut || null,
      });

      // Create bet transaction
      await storage.createTransaction({
        userId,
        type: 'game_bet',
        amount: -betAmount,
        gameType: 'aviator',
        gameRoundId: currentAviatorRound.roundId,
      });

      // Update user balance
      const newBalance = (user.balance || 0) - betAmount;
      await storage.updateUserBalance(userId, newBalance);

      // Broadcast bet to all clients
      broadcastToClients({
        type: 'bet_placed',
        data: {
          userId,
          betAmount,
          autoCashOut,
        }
      });

      res.json({ success: true, bet, newBalance });
    } catch (error) {
      console.error("Error placing aviator bet:", error);
      res.status(500).json({ message: "Failed to place bet" });
    }
  });

  app.post('/api/aviator/cash-out', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      if (!currentAviatorRound || currentAviatorRound.status !== 'flying') {
        return res.status(400).json({ message: "Cannot cash out now" });
      }

      const bet = await storage.getUserAviatorBet(userId, currentAviatorRound.roundId);
      if (!bet || bet.status !== 'active') {
        return res.status(400).json({ message: "No active bet found" });
      }

      const winAmount = Math.floor(bet.betAmount * currentAviatorRound.multiplier);

      // Update bet
      await storage.updateAviatorBet(bet.id, {
        cashOutAt: currentAviatorRound.multiplier.toString(),
        status: 'cashed_out',
        winAmount,
      });

      // Create win transaction
      await storage.createTransaction({
        userId,
        type: 'game_win',
        amount: winAmount,
        gameType: 'aviator',
        gameRoundId: currentAviatorRound.roundId,
      });

      const user = await storage.getUser(userId);
      if (user) {
        await storage.updateUserBalance(userId, (user.balance || 0) + winAmount);
        await storage.updateUserStats(userId, true, winAmount);
      }

      // Broadcast cash out to all clients
      broadcastToClients({
        type: 'cash_out',
        data: {
          userId,
          multiplier: currentAviatorRound.multiplier,
          winAmount,
        }
      });

      res.json({ success: true, winAmount, multiplier: currentAviatorRound.multiplier });
    } catch (error) {
      console.error("Error cashing out:", error);
      res.status(500).json({ message: "Failed to cash out" });
    }
  });

  app.post('/api/aviator/take-winnings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get the most recent cashed out bet for the user
      const recentBets = await storage.getUserAviatorBets(userId, 5); // Get last 5 bets
      const cashedOutBet = recentBets.find(bet => bet.status === 'cashed_out' && bet.winAmount > 0);
      
      if (!cashedOutBet) {
        return res.status(400).json({ message: "No winnings to collect" });
      }

      res.json({ 
        success: true, 
        winnings: cashedOutBet.winAmount,
        betAmount: cashedOutBet.betAmount,
        multiplier: parseFloat(cashedOutBet.cashOutAt || '0')
      });
    } catch (error) {
      console.error("Error taking winnings:", error);
      res.status(500).json({ message: "Failed to collect winnings" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket setup for Aviator game
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: ExtendedWebSocket) => {
    ws.isAlive = true;
    connectedClients.add(ws);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'join') {
          ws.userId = data.userId;
          
          // Send current game state
          if (currentAviatorRound) {
            ws.send(JSON.stringify({
              type: 'game_state',
              data: {
                roundId: currentAviatorRound.roundId,
                status: currentAviatorRound.status,
                multiplier: currentAviatorRound.multiplier,
                startTime: currentAviatorRound.startTime,
              }
            }));
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      connectedClients.delete(ws);
    });
  });

  // Ping clients to keep connections alive
  setInterval(() => {
    wss.clients.forEach((ws: ExtendedWebSocket) => {
      if (ws.isAlive === false) {
        ws.terminate();
        connectedClients.delete(ws);
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  function broadcastToClients(message: any) {
    connectedClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // Aviator game loop
  function startAviatorRound() {
    const roundId = randomUUID();
    const crashPoint = 1.01 + Math.random() * 8.99; // Random crash point between 1.01 and 10.00
    
    currentAviatorRound = {
      roundId,
      status: 'betting',
      multiplier: 1.00,
      crashPoint: parseFloat(crashPoint.toFixed(2)),
    };

    console.log(`Starting new Aviator round ${roundId} with crash point ${currentAviatorRound.crashPoint}x`);

    // Save game state to database
    storage.createAviatorGameState({
      roundId,
      status: 'betting',
      multiplier: '1.00',
      crashPoint: crashPoint.toString(),
    }).catch(err => console.error('Error saving game state:', err));

    // Broadcast betting phase
    broadcastToClients({
      type: 'round_started',
      data: {
        roundId,
        status: 'betting',
      }
    });

    // Betting phase (5 seconds)
    setTimeout(() => {
      if (currentAviatorRound?.roundId === roundId) {
        startFlying();
      }
    }, 5000);
  }

  function startFlying() {
    if (!currentAviatorRound) return;

    currentAviatorRound.status = 'flying';
    currentAviatorRound.startTime = new Date();

    // Update database
    storage.updateAviatorGameState(currentAviatorRound.roundId, {
      status: 'flying',
      startTime: currentAviatorRound.startTime,
    });

    // Broadcast flying phase
    broadcastToClients({
      type: 'flying_started',
      data: {
        roundId: currentAviatorRound.roundId,
        startTime: currentAviatorRound.startTime,
      }
    });

    // Flying phase - increment multiplier
    aviatorInterval = setInterval(async () => {
      if (!currentAviatorRound || currentAviatorRound.status !== 'flying') {
        if (aviatorInterval) clearInterval(aviatorInterval);
        return;
      }

      currentAviatorRound.multiplier += 0.01;

      // Check for crash
      if (currentAviatorRound.multiplier >= currentAviatorRound.crashPoint) {
        crashAviator();
        return;
      }

      // Check for auto cash outs
      const roundBets = await storage.getAviatorBetsForRound(currentAviatorRound.roundId);
      for (const bet of roundBets) {
        if (bet.status === 'active' && bet.autoCashOut && currentAviatorRound.multiplier >= parseFloat(bet.autoCashOut.toString())) {
          const winAmount = Math.floor(bet.betAmount * currentAviatorRound.multiplier);
          
          await storage.updateAviatorBet(bet.id, {
            cashOutAt: currentAviatorRound.multiplier.toString(),
            status: 'cashed_out',
            winAmount,
          });

          await storage.createTransaction({
            userId: bet.userId,
            type: 'game_win',
            amount: winAmount,
            gameType: 'aviator',
            gameRoundId: currentAviatorRound.roundId,
          });

          const user = await storage.getUser(bet.userId);
          if (user) {
            await storage.updateUserBalance(bet.userId, (user.balance || 0) + winAmount);
            await storage.updateUserStats(bet.userId, true, winAmount);
          }

          broadcastToClients({
            type: 'auto_cash_out',
            data: {
              userId: bet.userId,
              multiplier: currentAviatorRound.multiplier,
              winAmount,
            }
          });
        }
      }

      // Broadcast multiplier update
      broadcastToClients({
        type: 'multiplier_update',
        data: {
          multiplier: parseFloat(currentAviatorRound.multiplier.toFixed(2)),
        }
      });
    }, 100);
  }

  async function crashAviator() {
    if (aviatorInterval) {
      clearInterval(aviatorInterval);
      aviatorInterval = null;
    }

    if (!currentAviatorRound) return;

    const finalMultiplier = currentAviatorRound.multiplier;
    currentAviatorRound.status = 'crashed';

    // Update database
    await storage.updateAviatorGameState(currentAviatorRound.roundId, {
      status: 'crashed',
      multiplier: finalMultiplier.toString(),
      crashTime: new Date(),
    });

    // Handle losing bets
    const roundBets = await storage.getAviatorBetsForRound(currentAviatorRound.roundId);
    for (const bet of roundBets) {
      if (bet.status === 'active') {
        await storage.updateAviatorBet(bet.id, {
          status: 'crashed',
        });

        // Update user stats (loss)
        await storage.updateUserStats(bet.userId, false);
      }
    }

    // Broadcast crash
    broadcastToClients({
      type: 'crashed',
      data: {
        multiplier: parseFloat(finalMultiplier.toFixed(2)),
        crashPoint: currentAviatorRound.crashPoint,
      }
    });

    // Start new round after 3 seconds
    setTimeout(() => {
      startAviatorRound();
    }, 3000);
  }

  // Start first aviator round immediately
  console.log('Starting Aviator game engine...');
  startAviatorRound();

  return httpServer;
}
