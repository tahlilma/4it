import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Socket-based / heavy libraries run as plain Node modules on the server.
  serverExternalPackages: ["zkteco-js", "exceljs"],
  experimental: {
    // Attendance log files and employee photos can be several MB.
    serverActions: { bodySizeLimit: "20mb" },
    proxyClientMaxBodySize: "20mb",
    // Every page here is per-user and filter-driven (searchParams), streamed behind (app)/loading.tsx.
    // Only validate instant navigation for segments that explicitly export `instant`.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
