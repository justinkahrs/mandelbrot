// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/mandelbrot",
  assetPrefix: "/mandelbrot/",
  trailingSlash: true,
  output: "export",
};

export default nextConfig;
