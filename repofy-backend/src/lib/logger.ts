const isProduction = process.env.NODE_ENV === "production";

function serializeExtra(extra: unknown): Record<string, unknown> {
  if (extra instanceof Error) return { error: extra.message, stack: extra.stack };
  if (extra && typeof extra === "object" && !Array.isArray(extra)) return extra as Record<string, unknown>;
  if (extra !== undefined) return { data: extra };
  return {};
}

function emit(level: "info" | "warn" | "error", message: string, extra?: unknown) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: "repofy-backend",
    message,
    ...serializeExtra(extra),
  };

  if (isProduction) {
    const out = level === "error" ? process.stderr : process.stdout;
    out.write(JSON.stringify(entry) + "\n");
  } else {
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(`${entry.timestamp} [Repofy] ${level.toUpperCase()}: ${message}`, ...(extra !== undefined ? [extra] : []));
  }
}

export const logger = {
  info(message: string, extra?: unknown) {
    emit("info", message, extra);
  },
  warn(message: string, extra?: unknown) {
    emit("warn", message, extra);
  },
  error(message: string, extra?: unknown) {
    emit("error", message, extra);
  },
};
