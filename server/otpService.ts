import { randomInt } from "crypto";
import { db } from "./db";
import { otpCodes, users } from "@shared/schema";
import { eq, and, lt, gt } from "drizzle-orm";

interface OtpServiceConfig {
  emailProvider?: 'console' | 'sendgrid'; // We'll use console for now, can be extended
  smsProvider?: 'console' | 'twilio'; // We'll use console for now, can be extended
}

export class OtpService {
  private config: OtpServiceConfig;

  constructor(config: OtpServiceConfig = {}) {
    this.config = {
      emailProvider: 'console',
      smsProvider: 'console',
      ...config
    };
  }

  // Generate a 6-digit OTP
  private generateOtp(): string {
    return randomInt(100000, 999999).toString();
  }

  // Validate email format (Gmail only for now)
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    return emailRegex.test(email);
  }

  // Validate phone format (simple international format)
  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+[1-9]\d{1,14}$/; // E.164 format
    return phoneRegex.test(phone);
  }

  // Check rate limiting (max 3 OTP requests per identifier in 5 minutes)
  private async checkRateLimit(identifier: string, ipAddress: string): Promise<boolean> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const recentOtps = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.identifier, identifier),
          gt(otpCodes.createdAt, fiveMinutesAgo)
        )
      );

    return recentOtps.length < 3;
  }

  // Send OTP via email (console implementation for now)
  private async sendEmailOtp(email: string, otp: string): Promise<boolean> {
    try {
      // For development, we'll just log to console
      // In production, integrate with SendGrid, AWS SES, etc.
      console.log(`\n🔐 EMAIL OTP for ${email}: ${otp}`);
      console.log(`📧 Please check server logs above for your OTP code\n`);
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return true;
    } catch (error) {
      console.error('Failed to send email OTP:', error);
      return false;
    }
  }

  // Send OTP via SMS (console implementation for now)
  private async sendSmsOtp(phone: string, otp: string): Promise<boolean> {
    try {
      // For development, we'll just log to console
      // In production, integrate with Twilio, etc.
      console.log(`\n📱 SMS OTP for ${phone}: ${otp}`);
      console.log(`📲 Please check server logs above for your OTP code\n`);
      
      // Simulate SMS sending delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return true;
    } catch (error) {
      console.error('Failed to send SMS OTP:', error);
      return false;
    }
  }

  // Send OTP to email or phone
  async sendOtp(
    identifier: string,
    type: 'email' | 'phone',
    ipAddress: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validate identifier format
      if (type === 'email' && !this.isValidEmail(identifier)) {
        return { success: false, message: 'Please enter a valid Gmail address' };
      }
      
      if (type === 'phone' && !this.isValidPhone(identifier)) {
        return { success: false, message: 'Please enter a valid phone number with country code (e.g., +1234567890)' };
      }

      // Check rate limiting
      const canSend = await this.checkRateLimit(identifier, ipAddress);
      if (!canSend) {
        return { success: false, message: 'Too many OTP requests. Please wait 5 minutes before trying again.' };
      }

      // Generate OTP
      const otp = this.generateOtp();
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

      // Store OTP in database
      await db.insert(otpCodes).values({
        identifier,
        identifierType: type,
        otp,
        ipAddress,
        expiresAt,
      });

      // Send OTP
      let sent = false;
      if (type === 'email') {
        sent = await this.sendEmailOtp(identifier, otp);
      } else {
        sent = await this.sendSmsOtp(identifier, otp);
      }

      if (!sent) {
        return { success: false, message: 'Failed to send OTP. Please try again.' };
      }

      return { 
        success: true, 
        message: `OTP sent! Check server console logs for your ${type === 'email' ? 'email' : 'SMS'} code. Valid for 2 minutes.` 
      };

    } catch (error) {
      console.error('Error sending OTP:', error);
      return { success: false, message: 'Failed to send OTP. Please try again.' };
    }
  }

  // Verify OTP and authenticate user
  async verifyOtp(
    identifier: string,
    otp: string,
    type: 'email' | 'phone'
  ): Promise<{ 
    success: boolean; 
    message: string; 
    user?: any;
    isNewUser?: boolean;
  }> {
    try {
      // Find the most recent valid OTP for this identifier
      const otpRecord = await db
        .select()
        .from(otpCodes)
        .where(
          and(
            eq(otpCodes.identifier, identifier),
            eq(otpCodes.identifierType, type),
            eq(otpCodes.used, false),
            gt(otpCodes.expiresAt, new Date())
          )
        )
        .orderBy(otpCodes.createdAt)
        .limit(1);

      if (!otpRecord.length) {
        return { success: false, message: 'Invalid or expired OTP. Please request a new one.' };
      }

      const record = otpRecord[0];

      // Check attempts (max 3)
      if ((record.attempts || 0) >= 3) {
        await db
          .update(otpCodes)
          .set({ used: true })
          .where(eq(otpCodes.id, record.id));
        
        return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
      }

      // Check OTP match
      if (record.otp !== otp) {
        await db
          .update(otpCodes)
          .set({ attempts: (record.attempts || 0) + 1 })
          .where(eq(otpCodes.id, record.id));
        
        return { success: false, message: 'Invalid OTP. Please check and try again.' };
      }

      // Mark OTP as used
      await db
        .update(otpCodes)
        .set({ used: true })
        .where(eq(otpCodes.id, record.id));

      // Find or create user
      let user;
      let isNewUser = false;

      if (type === 'email') {
        user = await db
          .select()
          .from(users)
          .where(eq(users.email, identifier))
          .limit(1);
      } else {
        user = await db
          .select()
          .from(users)
          .where(eq(users.phone, identifier))
          .limit(1);
      }

      if (!user.length) {
        // Create new user
        const newUserData = type === 'email' 
          ? { email: identifier }
          : { phone: identifier };

        const newUser = await db
          .insert(users)
          .values({
            ...newUserData,
            balance: 1000, // Welcome bonus
            lastLoginAt: new Date(),
          })
          .returning();

        user = newUser;
        isNewUser = true;
      } else {
        // Update last login
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user[0].id));
      }

      return {
        success: true,
        message: isNewUser 
          ? 'Welcome! Your account has been created with 1000 bonus points!' 
          : 'Login successful!',
        user: user[0],
        isNewUser
      };

    } catch (error) {
      console.error('Error verifying OTP:', error);
      return { success: false, message: 'Failed to verify OTP. Please try again.' };
    }
  }

  // Clean up expired OTPs (run periodically)
  async cleanupExpiredOtps(): Promise<void> {
    try {
      await db
        .delete(otpCodes)
        .where(lt(otpCodes.expiresAt, new Date()));
    } catch (error) {
      console.error('Error cleaning up expired OTPs:', error);
    }
  }
}

export const otpService = new OtpService();