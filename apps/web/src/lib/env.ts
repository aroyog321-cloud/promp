import { z } from "zod";

const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL is required"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
});

export function requireEnv(name: keyof z.infer<typeof EnvSchema>): string {
  const value = process.env[name];
  
  // During Next.js build phase, secrets are not injected by Vercel.
  // We bypass Zod validation if the value is missing AND we're building.
  if (!value && process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV) {
     // Vercel build environment check
  }

  const fieldSchema = EnvSchema.shape[name];
  // Parse the specific field. If missing, it will throw a descriptive Zod error.
  // We fallback to a dummy value only if we know we're in a build step safely.
  if (!value && (process.env.npm_lifecycle_event === 'build' || process.env.CI)) {
    if (name.includes('URL')) return 'https://dummy.com';
    return 'dummy';
  }

  return fieldSchema.parse(value) as string;
}
