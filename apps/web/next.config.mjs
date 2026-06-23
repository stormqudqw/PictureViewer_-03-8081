/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@altay/api', '@altay/db'],
};

export default nextConfig;
