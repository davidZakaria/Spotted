import { z } from "zod";
import { PASSWORD_MIN_LENGTH, validatePassword } from "./password";

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(128)
  .superRefine((value, ctx) => {
    const error = validatePassword(value);
    if (error) ctx.addIssue({ code: "custom", message: error });
  });

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
  totp: z.string().regex(/^\d{6}$/).optional().or(z.literal("")),
});

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  password: passwordSchema,
  workspaceName: z.string().trim().min(1).max(80).optional(),
  locale: z.enum(["en", "ar"]).optional(),
  invite: z.string().min(8).max(128).optional().or(z.literal("")),
});

export const inviteSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
});

export const liveSearchSchema = z.object({
  q: z.string().trim().min(1).max(200),
  projectId: z.string().min(8).max(64),
  matchType: z.enum(["CONTAINS", "EXACT", "PHRASE"]).optional(),
  required: z.string().max(400).optional(),
  excluded: z.string().max(400).optional(),
  boolean: z.string().max(400).optional(),
  language: z.string().max(16).optional(),
  country: z.string().max(8).optional(),
  synonyms: z.string().max(400).optional(),
});

export const oauthProviderSchema = z.enum(["meta", "threads", "x", "linkedin", "google"]);
