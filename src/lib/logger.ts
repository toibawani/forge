type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  userId?: string;
  requestId?: string;
}

/**
 * Structured, PII-free logging.
 *
 * Rules: log identifiers (user id, request id) and codes, never emails, tokens,
 * passwords, IP addresses or free-text answers. `userId` is a UUID, not a
 * person's identity, and it is what makes an incident traceable.
 */
class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";

  private formatLog(entry: LogEntry): string {
    if (!this.isDevelopment) {
      return JSON.stringify(entry);
    }
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    const user = entry.userId ? ` [user:${entry.userId}]` : "";
    const request = entry.requestId ? ` [req:${entry.requestId}]` : "";
    return `${entry.timestamp} ${entry.level.toUpperCase()}${user}${request} ${entry.message}${context}`;
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    userId?: string,
    requestId?: string
  ) {
    if (level === "debug" && !this.isDevelopment) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context ? { context } : {}),
      ...(userId ? { userId } : {}),
      ...(requestId ? { requestId } : {}),
    };

    const line = this.formatLog(entry);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  info(message: string, context?: Record<string, unknown>, userId?: string, requestId?: string) {
    this.log("info", message, context, userId, requestId);
  }

  warn(message: string, context?: Record<string, unknown>, userId?: string, requestId?: string) {
    this.log("warn", message, context, userId, requestId);
  }

  error(message: string, context?: Record<string, unknown>, userId?: string, requestId?: string) {
    this.log("error", message, context, userId, requestId);
  }

  debug(message: string, context?: Record<string, unknown>, userId?: string, requestId?: string) {
    this.log("debug", message, context, userId, requestId);
  }
}

export const logger = new Logger();
