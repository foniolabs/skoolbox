/**
 * Static export: the same `out/` folder is bundled into the desktop app (which
 * must work offline with no server) and hosted at app.skoolbox.xyz.
 */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  devIndicators: false,
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
