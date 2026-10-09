import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The 3D world owns one WebGL context; avoid the dev-only double mount.
  reactStrictMode: false,
  // This folder is the project root (ignore lockfiles higher up the disk).
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url))
};

export default nextConfig;
