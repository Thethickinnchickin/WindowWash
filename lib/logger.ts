type Context = Record<string, unknown>;

function log(level: "INFO" | "WARN" | "ERROR", message: string, context?: Context) {
  const payload = {
    level,
    message,
    ...(context ? { context } : {}),
    timestamp: new Date().toISOString(),
  };

  if (level === "ERROR") {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === "WARN") {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}

export const logger = {
  info: (message: string, context?: Context) => log("INFO", message, context),
  warn: (message: string, context?: Context) => log("WARN", message, context),
  error: (message: string, context?: Context) => log("ERROR", message, context),
};
