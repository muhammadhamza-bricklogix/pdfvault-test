import path from "node:path";
import { fileURLToPath } from "node:url";

/** App root (this folder), not a parent that may contain another package-lock.json. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Parent dirs (e.g. /Users/softaims/package-lock.json) must not win lockfile discovery —
  // wrong root breaks output tracing and can break Turbopack HMR / stale UI in dev.
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
