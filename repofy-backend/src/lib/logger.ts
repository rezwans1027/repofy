const PREFIX = "[Repofy]";

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(message: string, ...args: unknown[]) {
    console.log(`${timestamp()} ${PREFIX} INFO: ${message}`, ...args);
  },
  warn(message: string, ...args: unknown[]) {
    console.warn(`${timestamp()} ${PREFIX} WARN: ${message}`, ...args);
  },
  error(message: string, ...args: unknown[]) {
    console.error(`${timestamp()} ${PREFIX} ERROR: ${message}`, ...args);
  },
};
