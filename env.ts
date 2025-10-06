import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Email configuration with Resend
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().default("noreply@quiz.it"),
  // Base URL for generating quiz links
  BASE_URL: z.string().url().default("http://localhost:3000"),
});

export const env = (() => {
  const parsed = envSchema.safeParse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    FROM_EMAIL: process.env.FROM_EMAIL,
    BASE_URL: process.env.BASE_URL,
  });
  if (!parsed.success) {
    const issues = parsed.error.flatten().fieldErrors;
    const message = Object.entries(issues)
      .map(([key, errors]) => `${key}: ${errors?.join(", ")}`)
      .join("; ");
    throw new Error(`Invalid environment variables: ${message}`);
  }
  return parsed.data;
})();

export type Env = z.infer<typeof envSchema>;


