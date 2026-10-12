/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Er is geen ESLint-configuratie meegeleverd; de build controleert wel TypeScript.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
