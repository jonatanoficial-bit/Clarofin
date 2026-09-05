import type { NextConfig } from 'next';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // Vinext static export keeps index.html at the repository root. The asset
  // prefix still makes every generated bundle work under GitHub Pages.
  assetPrefix: basePath || undefined,
};

export default nextConfig;
