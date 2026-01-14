import { z } from 'zod'

// === Core Validation Schemas ===

// User Profile Schemas
export const ProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  full_name: z.string().nullable(),
  bio: z.string().max(500).nullable(),
  avatar_url: z.string().url().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const ProfileInsertSchema = ProfileSchema.omit({
  created_at: true,
  updated_at: true,
})

export const ProfileUpdateSchema = ProfileInsertSchema.partial().omit({
  id: true,
})

// User Subscription Schemas
export const UserSubscriptionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  plan_type: z.enum(['trial', 'pro', 'enterprise']),
  status: z.enum(['active', 'cancelled', 'expired', 'pending']),
  credits_per_month: z.number().int().min(0),
  current_period_start: z.string().datetime(),
  current_period_end: z.string().datetime(),
  cancel_at_period_end: z.boolean().default(false),
  auto_renew: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const UserSubscriptionInsertSchema = UserSubscriptionSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
})

export const UserSubscriptionUpdateSchema = UserSubscriptionInsertSchema.partial().omit({
  user_id: true,
})

// User Credits Schemas
const UserCreditsBaseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  total_credits: z.number().int().min(0),
  used_credits: z.number().int().min(0),
  bonus_credits: z.number().int().min(0).default(0),
  credits_per_month: z.number().int().min(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const UserCreditsSchema = UserCreditsBaseSchema.refine(
  (data) => data.used_credits <= data.total_credits + data.bonus_credits,
  {
    message: "Used credits cannot exceed total available credits",
    path: ["used_credits"],
  }
)

export const UserCreditsInsertSchema = UserCreditsBaseSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).refine(
  (data) => data.used_credits <= data.total_credits + data.bonus_credits,
  {
    message: "Used credits cannot exceed total available credits",
    path: ["used_credits"],
  }
)

export const UserCreditsUpdateSchema = UserCreditsBaseSchema.partial().omit({
  user_id: true,
})

// Credit Usage Schemas
export const CreditUsageSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  credits_used: z.number().int().min(1),
  action: z.string().min(1).max(100),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime(),
})

export const CreditUsageInsertSchema = CreditUsageSchema.omit({
  id: true,
  created_at: true,
})

// Generated Images Schemas
export const GeneratedImageSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  prompt: z.string().min(1).max(2000),
  negative_prompt: z.string().max(1000).nullable(),
  model: z.string().min(1),
  image_url: z.string().url(),
  thumbnail_url: z.string().url().nullable(),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  steps: z.number().int().min(1).max(150),
  guidance_scale: z.number().min(0).max(30),
  seed: z.number().int().nullable(),
  is_favorite: z.boolean().default(false),
  is_public: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const GeneratedImageInsertSchema = GeneratedImageSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
})

export const GeneratedImageUpdateSchema = GeneratedImageInsertSchema.partial().omit({
  user_id: true,
})

// Avatar Videos Schemas
export const AvatarVideoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullable(),
  script: z.string().min(1).max(10000),
  avatar_id: z.string().uuid(),
  voice_id: z.string().uuid(),
  video_url: z.string().url().nullable(),
  thumbnail_url: z.string().url().nullable(),
  duration: z.number().min(0).nullable(),
  status: z.enum(['processing', 'completed', 'failed']).default('processing'),
  is_favorite: z.boolean().default(false),
  is_public: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const AvatarVideoInsertSchema = AvatarVideoSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
})

export const AvatarVideoUpdateSchema = AvatarVideoInsertSchema.partial().omit({
  user_id: true,
})

// Announcements Schemas
export const AnnouncementSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  type: z.enum(['info', 'warning', 'error', 'success']).default('info'),
  priority: z.number().int().min(1).max(10).default(5),
  is_active: z.boolean().default(true),
  target_audience: z.enum(['all', 'trial', 'pro', 'enterprise']).default('all'),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const AnnouncementInsertSchema = AnnouncementSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
})

export const AnnouncementUpdateSchema = AnnouncementInsertSchema.partial()

// === Composite Schemas ===

// User Registration Schema
export const UserRegistrationSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  full_name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  plan_type: z.enum(['trial', 'pro', 'enterprise']).default('trial'),
})

// User Login Schema
export const UserLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// Password Reset Schema
export const PasswordResetSchema = z.object({
  email: z.string().email(),
})

export const PasswordUpdateSchema = z.object({
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  }
)

// Subscription Management Schema
export const SubscriptionUpgradeSchema = z.object({
  plan_type: z.enum(['pro', 'enterprise']),
  payment_method_id: z.string().min(1),
})

export const SubscriptionCancelSchema = z.object({
  cancel_at_period_end: z.boolean().default(true),
  cancellation_reason: z.string().max(500).optional(),
})

// Content Creation Schemas
export const ImageGenerationSchema = z.object({
  prompt: z.string().min(1).max(2000),
  negative_prompt: z.string().max(1000).optional(),
  model: z.string().min(1).default('stable-diffusion-xl'),
  width: z.number().int().min(256).max(2048).default(1024),
  height: z.number().int().min(256).max(2048).default(1024),
  steps: z.number().int().min(1).max(150).default(30),
  guidance_scale: z.number().min(0).max(30).default(7.5),
  seed: z.number().int().optional(),
  num_images: z.number().int().min(1).max(4).default(1),
})

export const VideoGenerationSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  script: z.string().min(1).max(10000),
  avatar_id: z.string().uuid(),
  voice_id: z.string().uuid(),
  background_music: z.boolean().default(false),
  subtitle_enabled: z.boolean().default(true),
})

// === API Response Schemas ===

export const ApiSuccessSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  message: z.string().optional(),
})

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
})

export const ApiResponseSchema = z.union([ApiSuccessSchema, ApiErrorSchema])

// === Utility Schemas ===

export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export const SearchSchema = z.object({
  query: z.string().min(1).max(200),
  filters: z.record(z.string(), z.unknown()).optional(),
  pagination: PaginationSchema.optional(),
})

// === Type Inference ===

// User Types
export type Profile = z.infer<typeof ProfileSchema>
export type ProfileInsert = z.infer<typeof ProfileInsertSchema>
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>

// Subscription Types
export type UserSubscription = z.infer<typeof UserSubscriptionSchema>
export type UserSubscriptionInsert = z.infer<typeof UserSubscriptionInsertSchema>
export type UserSubscriptionUpdate = z.infer<typeof UserSubscriptionUpdateSchema>

// Credits Types
export type UserCredits = z.infer<typeof UserCreditsSchema>
export type UserCreditsInsert = z.infer<typeof UserCreditsInsertSchema>
export type UserCreditsUpdate = z.infer<typeof UserCreditsUpdateSchema>

// Credit Usage Types
export type CreditUsage = z.infer<typeof CreditUsageSchema>
export type CreditUsageInsert = z.infer<typeof CreditUsageInsertSchema>

// Content Types
export type GeneratedImage = z.infer<typeof GeneratedImageSchema>
export type GeneratedImageInsert = z.infer<typeof GeneratedImageInsertSchema>
export type GeneratedImageUpdate = z.infer<typeof GeneratedImageUpdateSchema>

export type AvatarVideo = z.infer<typeof AvatarVideoSchema>
export type AvatarVideoInsert = z.infer<typeof AvatarVideoInsertSchema>
export type AvatarVideoUpdate = z.infer<typeof AvatarVideoUpdateSchema>

// Announcement Types
export type Announcement = z.infer<typeof AnnouncementSchema>
export type AnnouncementInsert = z.infer<typeof AnnouncementInsertSchema>
export type AnnouncementUpdate = z.infer<typeof AnnouncementUpdateSchema>

// Auth Types
export type UserRegistration = z.infer<typeof UserRegistrationSchema>
export type UserLogin = z.infer<typeof UserLoginSchema>
export type PasswordReset = z.infer<typeof PasswordResetSchema>
export type PasswordUpdate = z.infer<typeof PasswordUpdateSchema>

// Subscription Management Types
export type SubscriptionUpgrade = z.infer<typeof SubscriptionUpgradeSchema>
export type SubscriptionCancel = z.infer<typeof SubscriptionCancelSchema>

// Content Creation Types
export type ImageGeneration = z.infer<typeof ImageGenerationSchema>
export type VideoGeneration = z.infer<typeof VideoGenerationSchema>

// API Types
export type ApiSuccess<T = unknown> = z.infer<typeof ApiSuccessSchema> & { data: T }
export type ApiError = z.infer<typeof ApiErrorSchema>
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError

// Utility Types
export type Pagination = z.infer<typeof PaginationSchema>
export type Search = z.infer<typeof SearchSchema>

// === Validation Helpers ===

export function validateAndParse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.issues.map(i => i.message).join(', ')}`)
  }
  return result.data
}

export function validatePartial<T>(schema: z.ZodObject<z.ZodRawShape>, data: unknown): Partial<T> {
  const partialSchema = schema.partial()
  const result = partialSchema.safeParse(data)
  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.issues.map(i => i.message).join(', ')}`)
  }
  return result.data as Partial<T>
}

export function createApiSuccess<T>(data: T, message?: string): ApiSuccess<T> {
  return { success: true, data, message }
}

export function createApiError(error: string, details?: Record<string, unknown>): ApiError {
  return { success: false, error, details }
}

// === Schema Registry ===

export const SchemaRegistry = {
  // User Schemas
  Profile: ProfileSchema,
  ProfileInsert: ProfileInsertSchema,
  ProfileUpdate: ProfileUpdateSchema,
  
  // Subscription Schemas
  UserSubscription: UserSubscriptionSchema,
  UserSubscriptionInsert: UserSubscriptionInsertSchema,
  UserSubscriptionUpdate: UserSubscriptionUpdateSchema,
  
  // Credits Schemas
  UserCredits: UserCreditsSchema,
  UserCreditsInsert: UserCreditsInsertSchema,
  UserCreditsUpdate: UserCreditsUpdateSchema,
  
  // Content Schemas
  GeneratedImage: GeneratedImageSchema,
  GeneratedImageInsert: GeneratedImageInsertSchema,
  GeneratedImageUpdate: GeneratedImageUpdateSchema,
  
  AvatarVideo: AvatarVideoSchema,
  AvatarVideoInsert: AvatarVideoInsertSchema,
  AvatarVideoUpdate: AvatarVideoUpdateSchema,
  
  // Auth Schemas
  UserRegistration: UserRegistrationSchema,
  UserLogin: UserLoginSchema,
  PasswordReset: PasswordResetSchema,
  PasswordUpdate: PasswordUpdateSchema,
  
  // API Schemas
  ApiSuccess: ApiSuccessSchema,
  ApiError: ApiErrorSchema,
  ApiResponse: ApiResponseSchema,
} as const