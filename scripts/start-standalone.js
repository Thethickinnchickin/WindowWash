#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");

const serverPath = path.join(process.cwd(), ".next", "standalone", "server.js");
const host = process.env.APP_HOSTNAME || "0.0.0.0";
const port = process.env.PORT || "3000";

const child = spawn(process.execPath, [serverPath], {
  stdio: "inherit",
  env: {
    ...process.env,
    HOSTNAME: host,
    PORT: port,
  },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(0);
  }

  process.exit(code ?? 0);
});
