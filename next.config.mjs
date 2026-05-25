/** @type {import('next').NextConfig} */
const nextConfig = {
  // Stage 9 (in-process scheduler) was abandoned in favour of Vercel Cron Jobs.
  // The `experimental.instrumentationHook` flag is no longer needed.
};

export default nextConfig;
