import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages export raw TypeScript; Next transpiles them in-place.
  transpilePackages: ['@tripwire/core', '@tripwire/pipeline'],
  webpack: (config) => {
    // The workspace packages use NodeNext-style `./x.js` specifiers for `.ts` files.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
