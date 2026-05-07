import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without this, Next infers the home
  // directory (a stray parent lockfile exists) and Turbopack crawls the whole
  // tree, which is wrong and unstable.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
