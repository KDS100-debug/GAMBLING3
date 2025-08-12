import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  integer,
  decimal,
  boolean,
  text
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (now OTP-based)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  phone: varchar("phone").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  balance: integer("balance").default(0),
  totalWinnings: integer("total_winnings").default(0),
  gamesPlayed: integer("games_played").default(0),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// OTP storage for authentication
export const otpCodes = pgTable("otp_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identifier: varchar("identifier").notNull(), // email or phone
  identifierType: varchar("identifier_type").notNull(), // 'email' or 'phone'
  otp: varchar("otp").notNull(),
  attempts: integer("attempts").default(0),
  used: boolean("used").default(false),
  ipAddress: varchar("ip_address"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transactions table for top-ups and game transactions
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type").notNull(), // 'topup', 'game_bet', 'game_win'
  amount: integer("amount").notNull(),
  status: varchar("status").default('completed'), // 'pending', 'completed', 'failed'
  gameType: varchar("game_type"), // 'color_game', 'aviator'
  gameRoundId: varchar("game_round_id"),
  paymentId: varchar("payment_id"), // for top-ups
  createdAt: timestamp("created_at").defaultNow(),
});

// Game rounds for tracking individual game sessions
export const gameRounds = pgTable("game_rounds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  gameType: varchar("game_type").notNull(), // 'color_game', 'aviator'
  betAmount: integer("bet_amount").notNull(),
  result: varchar("result").notNull(), // 'win', 'loss'
  winAmount: integer("win_amount").default(0),
  gameData: jsonb("game_data"), // Store game-specific data
  createdAt: timestamp("created_at").defaultNow(),
});

// Aviator game state for real-time multiplayer
export const aviatorGameState = pgTable("aviator_game_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roundId: varchar("round_id").notNull(),
  status: varchar("status").default('betting'), // 'betting', 'flying', 'crashed'
  multiplier: decimal("multiplier", { precision: 10, scale: 2 }).default('1.00'),
  crashPoint: decimal("crash_point", { precision: 10, scale: 2 }),
  startTime: timestamp("start_time"),
  crashTime: timestamp("crash_time"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Aviator bets for tracking player bets in each round
export const aviatorBets = pgTable("aviator_bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  roundId: varchar("round_id").notNull(),
  betAmount: integer("bet_amount").notNull(),
  autoCashOut: decimal("auto_cash_out", { precision: 10, scale: 2 }),
  cashOutAt: decimal("cash_out_at", { precision: 10, scale: 2 }),
  status: varchar("status").default('active'), // 'active', 'cashed_out', 'crashed'
  winAmount: integer("win_amount").default(0),
  isNextRoundBet: boolean("is_next_round_bet").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertOtpCode = typeof otpCodes.$inferInsert;
export type OtpCode = typeof otpCodes.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertGameRound = typeof gameRounds.$inferInsert;
export type GameRound = typeof gameRounds.$inferSelect;
export type InsertAviatorGameState = typeof aviatorGameState.$inferInsert;
export type AviatorGameState = typeof aviatorGameState.$inferSelect;
export type InsertAviatorBet = typeof aviatorBets.$inferInsert;
export type AviatorBet = typeof aviatorBets.$inferSelect;

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertGameRoundSchema = createInsertSchema(gameRounds).omit({
  id: true,
  createdAt: true,
});

export const insertAviatorBetSchema = createInsertSchema(aviatorBets).omit({
  id: true,
  createdAt: true,
});

export const insertOtpCodeSchema = createInsertSchema(otpCodes).omit({
  id: true,
  createdAt: true,
});

// OTP Authentication Schemas
export const sendOtpSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  type: z.enum(["email", "phone"]),
});

export const verifyOtpSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  type: z.enum(["email", "phone"]),
});

export type SendOtpRequest = z.infer<typeof sendOtpSchema>;
export type VerifyOtpRequest = z.infer<typeof verifyOtpSchema>;
