import pino from "pino";

function redactSecrets(obj: unknown): unknown {
  try {
    const json = JSON.stringify(obj, (key, value) => {
      const lower = key.toLowerCase();
      if (lower.includes("token") || lower.includes("apikey") || lower.includes("password") || lower.includes("secret")) {
        return "[REDACTED]";
      }
      return value;
    });
    return JSON.parse(json);
  } catch {
    return obj;
  }
}

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: ["req.headers.authorization", "*.apiKey", "*.token", "*.password"],
    censor: "[REDACTED]",
  },
  hooks: {
    logMethod(args, method) {
      const redactedArgs = args.map((a) => redactSecrets(a));
      return method.apply(this, redactedArgs as unknown as Parameters<typeof method>);
    },
  },
});


