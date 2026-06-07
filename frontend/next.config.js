const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Monorepo root so the standalone build traces workspace deps correctly.
  outputFileTracingRoot: path.join(__dirname, '..'),
  transpilePackages: ['@partselect/types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.azurefd.net' }, // PartSelect product CDN
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
  },
};
module.exports = nextConfig;
