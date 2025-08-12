import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertTransactionSchema, insertGameRoundSchema, insertAviatorBetSchema, sendOtpSchema, verifyOtpSchema } from "@shared/schema";
import { randomUUID } from "crypto";
import { otpService } from "./otpService";
import jwt from "jsonwebtoken";

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

// JWT Secret for OTP authentication (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// OTP Auth middleware for JWT tokens
const otpAuthenticated = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = { id: decoded.userId, email: decoded.email, phone: decoded.phone };
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Legacy Replit Auth setup (keeping for backwards compatibility)
  await setupAuth(app);

  // OTP Authentication endpoints
  app.post('/api/auth/send-otp', async (req, res) => {
    try {
      const validatedData = sendOtpSchema.parse(req.body);
      const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
      
      const result = await otpService.sendOtp(
        validatedData.identifier,
        validatedData.type,
        clientIp
      );

      res.status(result.success ? 200 : 400).json(result);
    } catch (error: any) {
      console.error('Send OTP error:', error);
      res.status(400).json({ 
        success: false, 
        message: error.message || 'Invalid request data' 
      });
    }
  });

  app.post('/api/auth/verify-otp', async (req, res) => {
    try {
      const validatedData = verifyOtpSchema.parse(req.body);
      
      const result = await otpService.verifyOtp(
        validatedData.identifier,
        validatedData.otp,
        validatedData.type
      );

      if (result.success && result.user) {
        // Generate JWT token
        const token = jwt.sign(
          { 
            userId: result.user.id, 
            email: result.user.email, 
            phone: result.user.phone 
          },
          JWT_SECRET,
          { expiresIn: '7d' } // Token valid for 7 days
        );

        res.json({
          ...result,
          token,
          user: result.user
        });
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      res.status(400).json({ 
        success: false, 
        message: error.message || 'Invalid request data' 
      });
    }
  });

  // User info endpoint (supports both auth methods)
  app.get('/api/auth/user', (req: any, res: any, next: any) => {
    // Try OTP auth first, fallback to Replit auth
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return otpAuthenticated(req, res, next);
    } else {
      return isAuthenticated(req, res, next);
    }
  }, async (req: any, res) => {
    try {
      // Handle both auth types
      const userId = req.user.id || req.user.claims?.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Balance routes (support both auth methods)
  app.get('/api/balance', (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return otpAuthenticated(req, res, next);
    } else {
      return isAuthenticated(req, res, next);
    }
  }, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const balance = await storage.getUserBalance(userId);
      res.json({ balance });
    } catch (error) {
      console.error("Error fetching balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });

  // Top-up routes (support both auth methods)
  app.post('/api/topup', (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return otpAuthenticated(req, res, next);
    } else {
      return isAuthenticated(req, res, next);
    }
  }, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
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
  app.get('/api/game-history', (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return otpAuthenticated(req, res, next);
    } else {
      return isAuthenticated(req, res, next);
    }
  }, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
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
      const { betAmount, autoCashOut, isNextRound } = req.body;

      if (!currentAviatorRound) {
        return res.status(400).json({ message: "No active game" });
      }

      // Allow betting during betting phase OR as next round bet during flying/crashed
      const canBetCurrentRound = currentAviatorRound.status === 'betting';
      const canBetNextRound = currentAviatorRound.status === 'flying' || currentAviatorRound.status === 'crashed';
      
      if (!canBetCurrentRound && !isNextRound) {
        return res.status(400).json({ message: "Betting closed for current round. Try betting for next round!" });
      }

      if (isNextRound && !canBetNextRound) {
        return res.status(400).json({ message: "Next round betting not available yet" });
      }

      if (betAmount < 10 || betAmount > 1000) {
        return res.status(400).json({ message: "Invalid bet amount" });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.balance || 0) < betAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Check if user already has a bet for the current round or next round
      const targetRoundId = isNextRound ? 'NEXT_ROUND' : currentAviatorRound.roundId;
      const existingBet = await storage.getUserAviatorBet(userId, targetRoundId);
      if (existingBet) {
        return res.status(400).json({ message: `Already placed bet for ${isNextRound ? 'next' : 'current'} round` });
      }

      // Create aviator bet
      const bet = await storage.createAviatorBet({
        userId,
        roundId: targetRoundId,
        betAmount,
        autoCashOut: autoCashOut || null,
        isNextRoundBet: isNextRound || false,
      });

      // Create bet transaction
      await storage.createTransaction({
        userId,
        type: 'game_bet',
        amount: -betAmount,
        gameType: 'aviator',
        gameRoundId: targetRoundId,
      });

      // Update user balance
      const newBalance = (user.balance || 0) - betAmount;
      await storage.updateUserBalance(userId, newBalance);

      // Broadcast bet to all clients
      broadcastToClients({
        type: isNextRound ? 'next_bet_placed' : 'bet_placed',
        data: {
          userId,
          betAmount,
          autoCashOut,
          isNextRound,
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
      const cashedOutBet = recentBets.find(bet => bet.status === 'cashed_out' && (bet.winAmount || 0) > 0);
      
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

    // Process next round bets - convert them to current round bets
    processNextRoundBets(roundId).catch(err => console.error('Error processing next round bets:', err));

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

  async function processNextRoundBets(newRoundId: string) {
    try {
      // Get all next round bets
      const nextRoundBets = await storage.getAviatorBetsForRound('NEXT_ROUND');
      
      for (const bet of nextRoundBets) {
        // Update the bet to use the new round ID and mark as active for current round
        await storage.updateAviatorBet(bet.id, {
          roundId: newRoundId,
          isNextRoundBet: false,
        });

        // Broadcast that this next round bet is now active
        broadcastToClients({
          type: 'next_bet_activated',
          data: {
            userId: bet.userId,
            betAmount: bet.betAmount,
            autoCashOut: bet.autoCashOut,
            roundId: newRoundId,
          }
        });
      }

      if (nextRoundBets.length > 0) {
        console.log(`Processed ${nextRoundBets.length} next round bets for round ${newRoundId}`);
      }
    } catch (error) {
      console.error('Error processing next round bets:', error);
    }
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

  // Admin authentication middleware
  const isAdminAuthenticated = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Admin token required' });
    }
    
    // Simple JWT verification (in production, use proper JWT library)
    try {
      // For demo purposes, using simple token validation
      if (token === 'admin-demo-token') {
        req.admin = { id: 'admin1', username: 'admin' };
        next();
      } else {
        res.status(401).json({ message: 'Invalid admin token' });
      }
    } catch (error) {
      res.status(401).json({ message: 'Invalid admin token' });
    }
  };

  // Payment System Routes
  app.get('/api/payment/qr-code', async (req, res) => {
    try {
      // Return default QR code info for UPI payment
      return res.json({
        merchantUpiId: 'ashishalamkabir@idfc',
        qrCodeImage: null,
        qrCodeData: 'upi://pay?pa=ashishalamkabir@idfc&pn=GameHub&cu=INR'
      });
    } catch (error) {
      console.error('Error fetching QR code:', error);
      res.status(500).json({ message: 'Failed to fetch QR code' });
    }
  });

  app.post('/api/payment/create-request', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, upiId, pointsToCredit } = req.body;

      if (!amount || amount < 10 || amount > 50000) {
        return res.status(400).json({ message: 'Invalid amount' });
      }

      if (!upiId) {
        return res.status(400).json({ message: 'UPI ID is required' });
      }

      // Store user's UPI ID for future withdrawals
      await storage.updateUserUpiId(userId, upiId);

      // Create payment request
      const paymentRequest = await storage.createPaymentRequest({
        userId,
        amount: amount.toString(),
        pointsToCredit,
        paymentMethod: 'upi',
        payerUpiId: upiId,
        status: 'pending',
      });

      res.json({ success: true, paymentRequest });
    } catch (error) {
      console.error('Error creating payment request:', error);
      res.status(500).json({ message: 'Failed to create payment request' });
    }
  });

  app.get('/api/payment/requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getUserPaymentRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error('Error fetching payment requests:', error);
      res.status(500).json({ message: 'Failed to fetch payment requests' });
    }
  });

  // Withdrawal Routes
  app.post('/api/withdrawal/create-request', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { pointsToWithdraw, upiId, withdrawalAmount } = req.body;

      if (!pointsToWithdraw || pointsToWithdraw < 10) {
        return res.status(400).json({ message: 'Minimum withdrawal is 10 points' });
      }

      if (!upiId) {
        return res.status(400).json({ message: 'UPI ID is required' });
      }

      // Check user balance
      const user = await storage.getUser(userId);
      if (!user || (user.balance || 0) < pointsToWithdraw) {
        return res.status(400).json({ message: 'Insufficient balance' });
      }

      // Create withdrawal request
      const withdrawalRequest = await storage.createWithdrawalRequest({
        userId,
        pointsToWithdraw,
        withdrawalAmount: withdrawalAmount.toString(),
        recipientUpiId: upiId,
        status: 'pending',
      });

      // Deduct points temporarily (will be restored if rejected)
      await storage.updateUserBalance(userId, (user.balance || 0) - pointsToWithdraw);

      res.json({ success: true, withdrawalRequest });
    } catch (error) {
      console.error('Error creating withdrawal request:', error);
      res.status(500).json({ message: 'Failed to create withdrawal request' });
    }
  });

  app.get('/api/withdrawal/requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getUserWithdrawalRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error('Error fetching withdrawal requests:', error);
      res.status(500).json({ message: 'Failed to fetch withdrawal requests' });
    }
  });

  // Admin Routes
  app.post('/api/admin/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // Simple demo authentication (use proper auth in production)
      if (username === 'admin' && password === 'admin123') {
        res.json({ 
          success: true, 
          token: 'admin-demo-token',
          user: { username: 'admin', role: 'admin' }
        });
      } else {
        res.status(401).json({ message: 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  app.get('/api/admin/dashboard/stats', isAdminAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getAdminDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  });

  app.get('/api/admin/payments/pending', isAdminAuthenticated, async (req, res) => {
    try {
      const pendingPayments = await storage.getPendingPayments();
      res.json(pendingPayments);
    } catch (error) {
      console.error('Error fetching pending payments:', error);
      res.status(500).json({ message: 'Failed to fetch pending payments' });
    }
  });

  app.post('/api/admin/payments/:id/approve', isAdminAuthenticated, async (req: any, res) => {
    try {
      const paymentId = req.params.id;
      const adminId = req.admin.id;

      const payment = await storage.approvePayment(paymentId, adminId);
      if (!payment) {
        return res.status(404).json({ message: 'Payment not found' });
      }

      // Credit points to user
      const user = await storage.getUser(payment.userId);
      if (user) {
        const newBalance = (user.balance || 0) + payment.pointsToCredit;
        await storage.updateUserBalance(payment.userId, newBalance);
      }

      res.json({ success: true, payment });
    } catch (error) {
      console.error('Error approving payment:', error);
      res.status(500).json({ message: 'Failed to approve payment' });
    }
  });

  app.get('/api/admin/withdrawals/pending', isAdminAuthenticated, async (req, res) => {
    try {
      const pendingWithdrawals = await storage.getPendingWithdrawals();
      res.json(pendingWithdrawals);
    } catch (error) {
      console.error('Error fetching pending withdrawals:', error);
      res.status(500).json({ message: 'Failed to fetch pending withdrawals' });
    }
  });

  app.post('/api/admin/withdrawals/:id/complete', isAdminAuthenticated, async (req: any, res) => {
    try {
      const withdrawalId = req.params.id;
      const adminId = req.admin.id;

      const withdrawal = await storage.completeWithdrawal(withdrawalId, adminId);
      if (!withdrawal) {
        return res.status(404).json({ message: 'Withdrawal not found' });
      }

      res.json({ success: true, withdrawal });
    } catch (error) {
      console.error('Error completing withdrawal:', error);
      res.status(500).json({ message: 'Failed to complete withdrawal' });
    }
  });

  app.get('/api/admin/config/:key', isAdminAuthenticated, async (req, res) => {
    try {
      const { key } = req.params;
      
      // Default values
      const defaults: { [key: string]: any } = {
        'topup-rate': { rate: 10 }, // 10 points per ₹1
        'withdrawal-rate': { rate: 0.08 }, // ₹0.08 per point
      };

      res.json(defaults[key] || { value: null });
    } catch (error) {
      console.error('Error fetching config:', error);
      res.status(500).json({ message: 'Failed to fetch config' });
    }
  });

  // Start first aviator round immediately
  console.log('Starting Aviator game engine...');
  startAviatorRound();

  return httpServer;
}
