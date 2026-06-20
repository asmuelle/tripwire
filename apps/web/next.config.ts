import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages export raw TypeScript; Next transpiles them in-place.
  transpilePackages: ['@tripwire/core', '@tripwire/pipeline'],
  // The workspace packages use NodeNext-style `./x.js` specifiers that actually
  // point at `.ts`/`.tsx` source. webpack's `resolve.extensionAlias` rewrites a
  // `.js` request to the corresponding `.ts`/`.tsx` file. Turbopack has no
  // equivalent (its `resolveExtensions` only adds extensionless candidates, it
  // does not substitute `.js` -> `.ts`), so the build is pinned to webpack via
  // `next build --webpack` in package.json. Keep this config for webpack.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
