import {
  users,
  transactions,
  gameRounds,
  aviatorGameState,
  aviatorBets,
  otpCodes,
  paymentRequests,
  withdrawalRequests,
  type User,
  type UpsertUser,
  type InsertTransaction,
  type Transaction,
  type InsertGameRound,
  type GameRound,
  type InsertAviatorGameState,
  type AviatorGameState,
  type InsertAviatorBet,
  type AviatorBet,
  type InsertOtpCode,
  type OtpCode,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (supports both Replit Auth and OTP Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Balance operations
  updateUserBalance(userId: string, amount: number): Promise<void>;
  getUserBalance(userId: string): Promise<number>;
  
  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getUserTransactions(userId: string, limit?: number): Promise<Transaction[]>;
  
  // Game operations
  createGameRound(gameRound: InsertGameRound): Promise<GameRound>;
  getUserGameHistory(userId: string, limit?: number): Promise<GameRound[]>;
  updateUserStats(userId: string, won: boolean, winAmount?: number): Promise<void>;
  
  // Aviator game operations
  createAviatorGameState(gameState: InsertAviatorGameState): Promise<AviatorGameState>;
  updateAviatorGameState(roundId: string, updates: Partial<AviatorGameState>): Promise<void>;
  getCurrentAviatorGame(): Promise<AviatorGameState | undefined>;
  createAviatorBet(bet: InsertAviatorBet): Promise<AviatorBet>;
  updateAviatorBet(id: string, updates: Partial<AviatorBet>): Promise<void>;
  getAviatorBetsForRound(roundId: string): Promise<AviatorBet[]>;
  getUserAviatorBet(userId: string, roundId: string): Promise<AviatorBet | undefined>;
  getUserAviatorBets(userId: string, limit?: number): Promise<AviatorBet[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Balance operations
  async updateUserBalance(userId: string, amount: number): Promise<void> {
    await db
      .update(users)
      .set({ 
        balance: amount,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async getUserBalance(userId: string): Promise<number> {
    const [user] = await db
      .select({ balance: users.balance })
      .from(users)
      .where(eq(users.id, userId));
    return user?.balance || 0;
  }

  // Transaction operations
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async getUserTransactions(userId: string, limit: number = 10): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  }

  // Game operations
  async createGameRound(gameRound: InsertGameRound): Promise<GameRound> {
    const [newGameRound] = await db
      .insert(gameRounds)
      .values(gameRound)
      .returning();
    return newGameRound;
  }

  async getUserGameHistory(userId: string, limit: number = 10): Promise<GameRound[]> {
    return await db
      .select()
      .from(gameRounds)
      .where(eq(gameRounds.userId, userId))
      .orderBy(desc(gameRounds.createdAt))
      .limit(limit);
  }

  async updateUserStats(userId: string, won: boolean, winAmount: number = 0): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;

    await db
      .update(users)
      .set({
        gamesPlayed: (user.gamesPlayed || 0) + 1,
        totalWinnings: won ? (user.totalWinnings || 0) + winAmount : (user.totalWinnings || 0),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // Aviator game operations
  async createAviatorGameState(gameState: InsertAviatorGameState): Promise<AviatorGameState> {
    const [newGameState] = await db
      .insert(aviatorGameState)
      .values(gameState)
      .returning();
    return newGameState;
  }

  async updateAviatorGameState(roundId: string, updates: Partial<AviatorGameState>): Promise<void> {
    await db
      .update(aviatorGameState)
      .set(updates)
      .where(eq(aviatorGameState.roundId, roundId));
  }

  async getCurrentAviatorGame(): Promise<AviatorGameState | undefined> {
    const [currentGame] = await db
      .select()
      .from(aviatorGameState)
      .orderBy(desc(aviatorGameState.createdAt))
      .limit(1);
    return currentGame;
  }

  async createAviatorBet(bet: InsertAviatorBet): Promise<AviatorBet> {
    const [newBet] = await db
      .insert(aviatorBets)
      .values(bet)
      .returning();
    return newBet;
  }

  async updateAviatorBet(id: string, updates: Partial<AviatorBet>): Promise<void> {
    await db
      .update(aviatorBets)
      .set(updates)
      .where(eq(aviatorBets.id, id));
  }

  async getAviatorBetsForRound(roundId: string): Promise<AviatorBet[]> {
    return await db
      .select()
      .from(aviatorBets)
      .where(eq(aviatorBets.roundId, roundId));
  }

  async getUserAviatorBet(userId: string, roundId: string): Promise<AviatorBet | undefined> {
    const [bet] = await db
      .select()
      .from(aviatorBets)
      .where(and(eq(aviatorBets.userId, userId), eq(aviatorBets.roundId, roundId)));
    return bet;
  }

  async getUserAviatorBets(userId: string, limit: number = 10): Promise<AviatorBet[]> {
    return await db
      .select()
      .from(aviatorBets)
      .where(eq(aviatorBets.userId, userId))
      .orderBy(desc(aviatorBets.createdAt))
      .limit(limit);
  }

  // Admin and Payment System Methods
  async updateUserUpiId(userId: string, upiId: string): Promise<void> {
    await db.update(users)
      .set({ upiId })
      .where(eq(users.id, userId));
  }

  async createPaymentRequest(data: any): Promise<any> {
    const [result] = await db.insert(paymentRequests).values(data).returning();
    return result;
  }

  async getUserPaymentRequests(userId: string): Promise<any[]> {
    return db.select()
      .from(paymentRequests)
      .where(eq(paymentRequests.userId, userId))
      .orderBy(desc(paymentRequests.createdAt));
  }

  async createWithdrawalRequest(data: any): Promise<any> {
    const [result] = await db.insert(withdrawalRequests).values(data).returning();
    return result;
  }

  async getUserWithdrawalRequests(userId: string): Promise<any[]> {
    return db.select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, userId))
      .orderBy(desc(withdrawalRequests.createdAt));
  }

  async getAdminDashboardStats(): Promise<any> {
    const [totalPaymentsResult] = await db.select({
      total: sql<string>`COALESCE(SUM(amount), 0)`
    }).from(paymentRequests).where(eq(paymentRequests.status, 'approved'));

    const [totalWithdrawalsResult] = await db.select({
      total: sql<string>`COALESCE(SUM(withdrawal_amount), 0)`
    }).from(withdrawalRequests).where(eq(withdrawalRequests.status, 'completed'));

    const [pendingPaymentsResult] = await db.select({
      count: sql<string>`COUNT(*)`
    }).from(paymentRequests).where(eq(paymentRequests.status, 'pending'));

    const [activeUsersResult] = await db.select({
      count: sql<string>`COUNT(*)`
    }).from(users);

    return {
      totalPayments: totalPaymentsResult?.total || 0,
      totalWithdrawals: totalWithdrawalsResult?.total || 0,
      pendingPayments: pendingPaymentsResult?.count || 0,
      activeUsers: activeUsersResult?.count || 0,
    };
  }

  async getPendingPayments(): Promise<any[]> {
    return db.select()
      .from(paymentRequests)
      .where(eq(paymentRequests.status, 'pending'))
      .orderBy(desc(paymentRequests.createdAt));
  }

  async approvePayment(paymentId: string, adminId: string): Promise<any> {
    const [result] = await db.update(paymentRequests)
      .set({ 
        status: 'approved',
        approvedBy: adminId,
        approvedAt: new Date()
      })
      .where(eq(paymentRequests.id, paymentId))
      .returning();
    
    return result;
  }

  async getPendingWithdrawals(): Promise<any[]> {
    return db.select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.status, 'pending'))
      .orderBy(desc(withdrawalRequests.createdAt));
  }

  async completeWithdrawal(withdrawalId: string, adminId: string): Promise<any> {
    const [result] = await db.update(withdrawalRequests)
      .set({
        status: 'completed',
        processedBy: adminId,
        processedAt: new Date()
      })
      .where(eq(withdrawalRequests.id, withdrawalId))
      .returning();

    return result;
  }
}

export const storage = new DatabaseStorage();
