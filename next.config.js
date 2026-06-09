/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
  async redirects() {
    return [
      {
        source: '/amenfiman',
        destination: '/attendance/p2how745x5decfw7d74p6g',
        permanent: false,
      },
    ]
  },
};

module.exports = nextConfig;
