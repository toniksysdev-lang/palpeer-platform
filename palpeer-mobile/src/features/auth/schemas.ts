import { z } from 'zod';

/**
 * Client validation mirrors the backend constraints exactly (RegisterRequest, LoginRequest,
 * PasswordResetConfirmRequest). No extra rules are added; the server stays authoritative.
 */
const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address')
  .max(320, 'Email must be 320 characters or fewer')
  .email('Enter a valid email address');

const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be 128 characters or fewer');

export const OTP_LENGTH = 6;

const otpCode = z
  .string()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Enter the ${OTP_LENGTH}-digit code`);

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email or phone number'),
  password: z.string().min(1, 'Enter your password'),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email,
    username: z.string().trim().max(64, 'Username must be 64 characters or fewer'),
    referralCode: z
      .string()
      .trim()
      .max(40, 'Referral code must be 40 characters or fewer'),
    password: newPassword,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type RegisterForm = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    code: otpCode,
    newPassword,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export const otpSchema = z.object({ code: otpCode });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;
