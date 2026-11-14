type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  userId?: string;
  requestId?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";

  private formatLog(entry: LogEntry): string {
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    const userIdStr = entry.userId ? ` [User: ${entry.userId}]` : "";
    const requestIdStr = entry.requestId ? ` [Request: ${entry.requestId}]` : "";
    return `[${entry.timestamp}] ${entry.level.toUpperCase()}${userIdStr}${requestIdStr}: ${entry.message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, userId?: string, requestId?: string) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      userId,
      requestId,
    };

    if (this.isDevelopment) {
      console.log(this.formatLog(entry));
    } else {
      // In production, send to logging service (e.g., Sentry, Datadog, CloudWatch)
      // For now, we'll still log to console but could replace with external service
      console.log(this.formatLog(entry));
    }
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
    if (this.isDevelopment) {
      this.log("debug", message, context, userId, requestId);
    }
  }
}

export const logger = new Logger();
