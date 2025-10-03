import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = (() => {
  const parsed = envSchema.safeParse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
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


