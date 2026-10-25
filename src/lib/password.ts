import { compare, hash } from "bcryptjs";

export const PASSWORD_MIN_LENGTH = 12;

const UPPER = /[A-Z]/;
const LOWER = /[a-z]/;
const DIGIT = /\d/;
const SPECIAL = /[^A-Za-z0-9]/;

export function validatePassword(password: string): string | null {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (password.length > 128) return "Password is too long";
  if (!UPPER.test(password)) return "Include an uppercase letter";
  if (!LOWER.test(password)) return "Include a lowercase letter";
  if (!DIGIT.test(password)) return "Include a number";
  if (!SPECIAL.test(password)) return "Include a symbol";
  return null;
}

export function assertPassword(password: string) {
  const error = validatePassword(password);
  if (error) throw new Error(error);
}

export async function hashPassword(password: string) {
  assertPassword(password);
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}
