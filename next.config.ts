import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pas d'optimisation d'images Vercel (brief §4) : les vignettes sont servies
  // depuis R2, jamais transformées par la plateforme d'hébergement.
  images: { unoptimized: true },
};

export default nextConfig;
