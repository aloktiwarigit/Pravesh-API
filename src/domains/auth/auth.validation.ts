// ============================================================
// Auth Domain — Zod Validation Schemas
// Registration, role assignment, status management
// ============================================================

import { z } from 'zod';

// ============================================================
// Valid Roles
// ============================================================

const VALID_ROLES = [
  'customer',
  'agent',
  'dealer',
  'ops',
  'builder',
  'lawyer',
  'franchise_owner',
  'super_admin',
  'support',
] as const;

// ============================================================
// User Status (mirrors Prisma UserStatus enum)
// ============================================================

const USER_STATUS = [
  'ACTIVE',
  'PENDING_ROLE',
  'PENDING_APPROVAL',
  'SUSPENDED',
  'DEACTIVATED',
] as const;

// ============================================================
// POST /register — After Firebase phone auth on client
// ============================================================

export const registerSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?91?[0-9]{10}$/, 'Phone must be 10 digits, optionally prefixed with +91 or 91')
    .transform((val) => val.replace(/^\+?91/, '').slice(-10))
    .optional(),
  displayName: z.string().min(1).max(100).optional(),
  firebaseUid: z.string().min(1, 'firebaseUid is required'),
  email: z.string().email().optional(),
  languagePref: z.enum(['en', 'hi']).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ============================================================
// POST /set-roles — Admin assigns roles to a user
// ============================================================

export const setRoleSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
  roles: z
    .array(z.enum(VALID_ROLES))
    .min(1, 'At least one role is required')
    .max(9),
  cityId: z.string().uuid('cityId must be a valid UUID').optional(),
  primaryRole: z.enum(VALID_ROLES).optional(),
});

export type SetRoleInput = z.infer<typeof setRoleSchema>;

// ============================================================
// PUT /status — Admin changes user status
// ============================================================

export const updateStatusSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
  status: z.enum(USER_STATUS),
});

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

// ============================================================
// POST /refresh-claims — Re-sync Firebase custom claims
// ============================================================

export const refreshClaimsSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
});

export type RefreshClaimsInput = z.infer<typeof refreshClaimsSchema>;
