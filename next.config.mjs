/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: "next-build",
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: ["192.168.68.77"],
};

export default nextConfig;