import { z } from 'zod';
import { DEFAULT_WEIGHT_UNIT, WEIGHT_UNITS } from '../constants';

export const userRoleSchema = z.enum(['client', 'admin']);
export const userWeightUnitSchema = z.enum(WEIGHT_UNITS);

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteToken: z.string().min(1).optional(),
  trustedDevice: z.boolean().optional().default(true),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  trustedDevice: z.boolean().optional().default(true),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: userRoleSchema,
  weightUnit: userWeightUnitSchema.default(DEFAULT_WEIGHT_UNIT),
  createdAt: z.string().datetime(),
});

export const updateUserPreferencesSchema = z.object({
  weightUnit: userWeightUnitSchema,
});

export const authResponseSchema = z.object({
  user: userSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const invitePreviewSchema = z.object({
  email: z.string().email(),
  expiresAt: z.string().datetime(),
});

export const createInvitationSchema = z.object({
  email: z.string().email(),
});

export const invitationSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  expiresAt: z.string().datetime(),
  usedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const createInvitationResponseSchema = z.object({
  inviteUrl: z.string().url(),
  expiresAt: z.string().datetime(),
  invitation: invitationSchema,
});

export const adminUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type User = z.infer<typeof userSchema>;
export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type InvitePreview = z.infer<typeof invitePreviewSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type Invitation = z.infer<typeof invitationSchema>;
export type CreateInvitationResponse = z.infer<typeof createInvitationResponseSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
