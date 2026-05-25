/** @type {import('next').NextConfig} */
const nextConfig = {
  // No externalPackages override needed — we're using node:sqlite, which is
  // a Node.js built-in (not an npm package). Next.js's bundler recognises
  // node: imports natively and leaves them as runtime requires.
};

export default nextConfig;
