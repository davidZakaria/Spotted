import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "bullmq", "ioredis", "pdfkit"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: Object.entries(securityHeaders(false)).map(([key, value]) => ({ key, value })),
      },
    ];
  },
};

export default nextConfig;
