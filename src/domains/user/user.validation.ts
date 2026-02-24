import { z } from 'zod';

// ============================================================
// User Profile Update Validation
// ============================================================

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  languagePref: z.enum(['en', 'hi']).optional(),
  profileData: z.record(z.unknown()).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ============================================================
// Patch Profile Validation (Flutter alias fields)
// Accepts both Prisma names and Flutter names
// ============================================================

export const patchProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  preferredLanguage: z.enum(['en', 'hi']).optional(),
  languagePref: z.enum(['en', 'hi']).optional(),
});

export type PatchProfileInput = z.infer<typeof patchProfileSchema>;

// ============================================================
// User Search / List Validation (Admin)
// ============================================================

export const userSearchSchema = z.object({
  query: z.string().max(100).optional(),
  role: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  cityId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type UserSearchInput = z.infer<typeof userSearchSchema>;
