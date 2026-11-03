import type { NextConfig } from "next";

// Stage A: fully static site (see docs/decisions/002).
// GitHub Pages serves it under /InisiyaMart, so the workflow sets NEXT_PUBLIC_BASE_PATH.
// Cloudflare Pages / local builds leave it empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
