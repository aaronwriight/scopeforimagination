/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
      },
    ],
  },
  experimental: {
    taint: true,
  },
  webpack(config, { dev }) {
    // Vercel restores `.next/cache` before every build. This site's production
    // webpack cache exceeds 1 GB while its deployable output is about 50 MB, so
    // keep remote production builds bounded by caching only in development.
    if (!dev) {
      config.cache = false
    }

    return config
  },
  // ...other config settings
}

export default nextConfig
