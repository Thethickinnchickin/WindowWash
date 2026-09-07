#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const serverPath = path.join(process.cwd(), ".next", "standalone", "server.js");
const standaloneDir = path.join(process.cwd(), ".next", "standalone");
const host = process.env.APP_HOSTNAME || "0.0.0.0";
const port = process.env.PORT || "3000";

function copyDirectoryIfExists(source, destination) {
  if (!fs.existsSync(source)) {
    return;
  }

  fs.rmSync(destination, {
    recursive: true,
    force: true,
  });
  fs.cpSync(source, destination, {
    recursive: true,
  });
}

copyDirectoryIfExists(
  path.join(process.cwd(), ".next", "static"),
  path.join(standaloneDir, ".next", "static"),
);
copyDirectoryIfExists(
  path.join(process.cwd(), "public"),
  path.join(standaloneDir, "public"),
);

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
