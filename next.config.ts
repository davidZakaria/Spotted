import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "bullmq", "ioredis", "pdfkit"],
};

export default nextConfig;
