import {
  users,
  transactions,
  gameRounds,
  aviatorGameState,
  aviatorBets,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
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
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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
        gamesPlayed: user.gamesPlayed + 1,
        totalWinnings: won ? user.totalWinnings + winAmount : user.totalWinnings,
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
}

export const storage = new DatabaseStorage();
