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
import { desc } from "drizzle-orm";
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
  upiId: varchar("upi_id"), // Store user's UPI ID for withdrawals
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

// Admin users for system management
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash").notNull(),
  role: varchar("role").default('admin'), // 'admin', 'super_admin'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment requests for top-ups
export const paymentRequests = pgTable("payment_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  pointsToCredit: integer("points_to_credit").notNull(),
  paymentMethod: varchar("payment_method").notNull(), // 'upi', 'bank_transfer', 'card'
  paymentTransactionId: varchar("payment_transaction_id"),
  payerUpiId: varchar("payer_upi_id"),
  payerBankDetails: jsonb("payer_bank_details"),
  status: varchar("status").default('pending'), // 'pending', 'approved', 'rejected'
  qrCodeId: varchar("qr_code_id"),
  approvedBy: varchar("approved_by").references(() => adminUsers.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Withdrawal requests
export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  pointsToWithdraw: integer("points_to_withdraw").notNull(),
  withdrawalAmount: decimal("withdrawal_amount", { precision: 10, scale: 2 }).notNull(),
  recipientUpiId: varchar("recipient_upi_id").notNull(),
  status: varchar("status").default('pending'), // 'pending', 'processing', 'completed', 'rejected'
  processedBy: varchar("processed_by").references(() => adminUsers.id),
  processedAt: timestamp("processed_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// QR codes for payments
export const paymentQrCodes = pgTable("payment_qr_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  qrCodeData: text("qr_code_data").notNull(),
  qrCodeImage: text("qr_code_image"), // Base64 or URL
  merchantUpiId: varchar("merchant_upi_id").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// System configuration
export const systemConfig = pgTable("system_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configKey: varchar("config_key").unique().notNull(),
  configValue: text("config_value").notNull(),
  description: text("description"),
  updatedBy: varchar("updated_by").references(() => adminUsers.id),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// Admin system types
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = typeof adminUsers.$inferInsert;
export type PaymentRequest = typeof paymentRequests.$inferSelect;
export type InsertPaymentRequest = typeof paymentRequests.$inferInsert;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = typeof withdrawalRequests.$inferInsert;
export type PaymentQrCode = typeof paymentQrCodes.$inferSelect;
export type InsertPaymentQrCode = typeof paymentQrCodes.$inferInsert;
export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = typeof systemConfig.$inferInsert;

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
