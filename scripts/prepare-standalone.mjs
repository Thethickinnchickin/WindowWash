#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const standaloneDir = path.join(appRoot, ".next", "standalone");

function relativePath(filePath) {
  return path.relative(appRoot, filePath).replaceAll(path.sep, "/");
}

function copyDirectoryIfExists(source, destination) {
  if (!fs.existsSync(source)) {
    console.warn(`Skipping missing ${relativePath(source)}`);
    return;
  }

  fs.rmSync(destination, {
    recursive: true,
    force: true,
  });
  fs.cpSync(source, destination, {
    recursive: true,
  });

  console.log(`Copied ${relativePath(source)} to ${relativePath(destination)}`);
}

if (!fs.existsSync(standaloneDir)) {
  throw new Error("Next standalone output was not found. Run next build first.");
}

copyDirectoryIfExists(
  path.join(appRoot, ".next", "static"),
  path.join(standaloneDir, ".next", "static"),
);
copyDirectoryIfExists(
  path.join(appRoot, "public"),
  path.join(standaloneDir, "public"),
);
